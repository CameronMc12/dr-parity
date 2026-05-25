import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadConfig,
  fetchJson,
  v2,
  v3,
  throttle,
  type CallRecord,
} from "./lib/clickup-client";
import { trimSample } from "./lib/sample-shape";

const TASKS_PER_PAGE = 100;

interface ExportContext {
  token: string;
  teamId: string;
  outDir: string;
  endpointMap: Map<string, CallRecord>;
}

const countArray = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

const log = (msg: string) => process.stdout.write(`[clickup-export] ${msg}\n`);
const warn = (msg: string) => process.stderr.write(`[clickup-export] WARN ${msg}\n`);

function writeJson(outDir: string, name: string, data: unknown): void {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2), "utf8");
}

/** Record an endpoint call in the map. First call sets template + sample. */
function record(
  ctx: ExportContext,
  pathTemplate: string,
  returns: string,
  countDelta: number,
  sample: unknown,
): void {
  const key = `GET ${pathTemplate}`;
  const existing = ctx.endpointMap.get(key);
  if (existing) {
    existing.count += countDelta;
    if (existing.sample === undefined && sample !== undefined) {
      existing.sample = trimSample(sample);
    }
    return;
  }
  ctx.endpointMap.set(key, {
    method: "GET",
    pathTemplate,
    returns,
    count: countDelta,
    sample: sample === undefined ? undefined : trimSample(sample),
  });
}

async function get<T = unknown>(
  ctx: ExportContext,
  url: string,
): Promise<T | null> {
  await throttle();
  const res = await fetchJson<T>(url, ctx.token);
  if (!res.ok) {
    warn(`${res.status} on ${url.replace(/https:\/\/api\.clickup\.com/, "")} — ${res.body}`);
    return null;
  }
  return res.data;
}

// ---- typed shapes (only the fields we touch) ----

interface NamedEntity {
  id: string;
  name: string;
}
interface Space extends NamedEntity {
  statuses?: unknown[];
}
interface FolderEntity extends NamedEntity {
  lists?: ListEntity[];
}
interface ListEntity extends NamedEntity {
  folder?: { id: string };
  space?: { id: string };
}
interface Task extends NamedEntity {
  status?: { status?: string };
  list?: { id: string };
}

async function run(): Promise<void> {
  const { token, teamId } = loadConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(process.cwd(), "docs/research/clickup-export", stamp);
  mkdirSync(outDir, { recursive: true });

  const ctx: ExportContext = { token, teamId, outDir, endpointMap: new Map() };
  log(`output → ${outDir}`);

  // 1. Workspace + members
  const teamResp = await get<{ teams: Array<NamedEntity & { members?: unknown[] }> }>(
    ctx,
    v2("/team"),
  );
  record(ctx, "/team", "All workspaces (teams) for the token + their members", 1, teamResp);
  const workspace = teamResp?.teams?.find((t) => t.id === teamId) ?? teamResp?.teams?.[0] ?? null;
  const members = workspace?.members ?? [];
  writeJson(outDir, "workspace.json", workspace);
  writeJson(outDir, "members.json", members);

  // 2. Spaces
  const spacesResp = await get<{ spaces: Space[] }>(
    ctx,
    v2(`/team/${teamId}/space?archived=false`),
  );
  record(ctx, "/team/{team_id}/space", "Non-archived spaces in a workspace", 1, spacesResp);
  const spaces = spacesResp?.spaces ?? [];

  const spaceDetails: unknown[] = [];
  const folders: FolderEntity[] = [];
  const lists: ListEntity[] = [];
  const customFields: Array<{ listId: string; fields: unknown }> = [];
  const tasks: Task[] = [];
  const taskComments: Array<{ taskId: string; comments: unknown }> = [];

  // tree scaffold
  const tree = {
    workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
    spaces: [] as Array<{
      id: string;
      name: string;
      folders: Array<{ id: string; name: string; lists: TreeList[] }>;
      folderlessLists: TreeList[];
    }>,
  };

  for (const space of spaces) {
    log(`space ${space.name} (${space.id})`);

    // 2a. space detail (statuses, features)
    const detail = await get(ctx, v2(`/space/${space.id}`));
    record(ctx, "/space/{space_id}", "Space detail: statuses, features, settings", 1, detail);
    if (detail) spaceDetails.push(detail);

    const treeSpace = {
      id: space.id,
      name: space.name,
      folders: [] as Array<{ id: string; name: string; lists: TreeList[] }>,
      folderlessLists: [] as TreeList[],
    };

    // 3. folders + their lists
    const foldersResp = await get<{ folders: FolderEntity[] }>(
      ctx,
      v2(`/space/${space.id}/folder?archived=false`),
    );
    record(ctx, "/space/{space_id}/folder", "Non-archived folders in a space (with nested lists)", 1, foldersResp);
    for (const folder of foldersResp?.folders ?? []) {
      folders.push(folder);
      const treeFolder = { id: folder.id, name: folder.name, lists: [] as TreeList[] };

      // foldered lists (folder payload often inlines lists, but fetch authoritatively)
      const folderLists = await get<{ lists: ListEntity[] }>(ctx, v2(`/folder/${folder.id}/list`));
      record(ctx, "/folder/{folder_id}/list", "Lists inside a folder", 1, folderLists);
      const fl = folderLists?.lists ?? folder.lists ?? [];
      for (const list of fl) {
        lists.push(list);
        treeFolder.lists.push(await exportList(ctx, list, tasks, taskComments, customFields));
      }
      treeSpace.folders.push(treeFolder);
    }

    // 4. folderless lists
    const folderlessResp = await get<{ lists: ListEntity[] }>(
      ctx,
      v2(`/space/${space.id}/list?archived=false`),
    );
    record(ctx, "/space/{space_id}/list", "Folderless lists in a space", 1, folderlessResp);
    for (const list of folderlessResp?.lists ?? []) {
      lists.push(list);
      treeSpace.folderlessLists.push(await exportList(ctx, list, tasks, taskComments, customFields));
    }

    tree.spaces.push(treeSpace);

    // incremental writes so a mid-run failure keeps partial data
    writeJson(outDir, "spaces.json", spaces);
    writeJson(outDir, "folders.json", folders);
    writeJson(outDir, "lists.json", lists);
    writeJson(outDir, "tasks.json", tasks);
    writeJson(outDir, "task-comments.json", taskComments);
    writeJson(outDir, "custom-fields.json", customFields);
    writeJson(outDir, "tree.json", tree);
  }

  writeJson(outDir, "space-details.json", spaceDetails);

  // 5. Docs (v3)
  const { docs, docPages } = await exportDocs(ctx);
  writeJson(outDir, "docs.json", docs);
  writeJson(outDir, "doc-pages.json", docPages);

  // final writes
  writeJson(outDir, "spaces.json", spaces);
  writeJson(outDir, "folders.json", folders);
  writeJson(outDir, "lists.json", lists);
  writeJson(outDir, "tasks.json", tasks);
  writeJson(outDir, "task-comments.json", taskComments);
  writeJson(outDir, "custom-fields.json", customFields);
  writeJson(outDir, "tree.json", tree);

  const summary = {
    workspace: workspace?.name ?? null,
    teamId,
    spaces: spaces.length,
    folders: folders.length,
    lists: lists.length,
    tasks: tasks.length,
    comments: taskComments.reduce<number>(
      (n, t) => n + countArray((t.comments as { comments?: unknown })?.comments),
      0,
    ),
    customFields: customFields.reduce<number>(
      (n, f) => n + countArray((f.fields as { fields?: unknown })?.fields),
      0,
    ),
    docs: docs.length,
    docPages: docPages.reduce<number>(
      (n, d) => n + countArray((d as { pages?: unknown }).pages),
      0,
    ),
  };
  writeJson(outDir, "summary.json", summary);

  writeEndpointMap(ctx);

  log("done");
  log(`summary: ${JSON.stringify(summary)}`);
}

interface TreeList {
  id: string;
  name: string;
  tasks: Array<{ id: string; name: string; status: string | null }>;
}

async function exportList(
  ctx: ExportContext,
  list: ListEntity,
  tasks: Task[],
  taskComments: Array<{ taskId: string; comments: unknown }>,
  customFields: Array<{ listId: string; fields: unknown }>,
): Promise<TreeList> {
  // list detail (statuses)
  const detail = await get(ctx, v2(`/list/${list.id}`));
  record(ctx, "/list/{list_id}", "List detail: statuses, assignee, content", 1, detail);

  // custom fields
  const fields = await get(ctx, v2(`/list/${list.id}/field`));
  record(ctx, "/list/{list_id}/field", "Custom fields accessible from a list", 1, fields);
  if (fields) customFields.push({ listId: list.id, fields });

  const treeList: TreeList = { id: list.id, name: list.name, tasks: [] };

  // paginated tasks
  for (let page = 0; ; page += 1) {
    const url = v2(
      `/list/${list.id}/task?archived=false&include_closed=true&subtasks=true&page=${page}`,
    );
    const resp = await get<{ tasks: Task[]; last_page?: boolean }>(ctx, url);
    record(
      ctx,
      "/list/{list_id}/task",
      "Paginated tasks in a list (archived=false, include_closed=true, subtasks=true)",
      resp?.tasks?.length ?? 0,
      resp,
    );
    const pageTasks = resp?.tasks ?? [];
    if (pageTasks.length === 0) break;

    for (const stub of pageTasks) {
      // full task detail
      const full = await get<Task>(
        ctx,
        v2(`/task/${stub.id}?include_subtasks=true`),
      );
      record(ctx, "/task/{task_id}", "Full task detail (custom fields, assignees, subtasks)", 1, full);
      const task = full ?? stub;
      tasks.push(task);
      treeList.tasks.push({
        id: task.id,
        name: task.name,
        status: task.status?.status ?? null,
      });

      // comments
      const comments = await get(ctx, v2(`/task/${stub.id}/comment`));
      record(ctx, "/task/{task_id}/comment", "Comments on a task", 1, comments);
      if (comments) taskComments.push({ taskId: stub.id, comments });
    }

    if (resp?.last_page === true || pageTasks.length < TASKS_PER_PAGE) break;
  }

  return treeList;
}

async function exportDocs(
  ctx: ExportContext,
): Promise<{ docs: NamedEntity[]; docPages: unknown[] }> {
  const docsResp = await get<{ docs?: NamedEntity[] }>(
    ctx,
    v3(`/workspaces/${ctx.teamId}/docs`),
  );
  record(ctx, "/workspaces/{team_id}/docs (v3)", "Docs in a workspace", docsResp ? 1 : 0, docsResp);
  if (!docsResp) {
    warn("v3 docs unavailable — skipping docs export");
    return { docs: [], docPages: [] };
  }
  const docs = docsResp.docs ?? [];
  const docPages: unknown[] = [];
  for (const doc of docs) {
    const pages = await get(ctx, v3(`/workspaces/${ctx.teamId}/docs/${doc.id}/pages`));
    record(ctx, "/workspaces/{team_id}/docs/{doc_id}/pages (v3)", "Pages within a doc", pages ? 1 : 0, pages);
    docPages.push({ docId: doc.id, name: doc.name, pages });
  }
  return { docs, docPages };
}

function writeEndpointMap(ctx: ExportContext): void {
  const lines: string[] = [
    "# ClickUp Public API — Endpoint Map",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Every public ClickUp REST endpoint this exporter calls. v2 base: `https://api.clickup.com/api/v2`. v3 base: `https://api.clickup.com/api/v3`. Auth header is the raw token (not Bearer). Samples below are structure-only (arrays truncated, long strings clipped). No credentials appear in any output.",
    "",
  ];

  for (const rec of ctx.endpointMap.values()) {
    lines.push(`## \`${rec.method} ${rec.pathTemplate}\``);
    lines.push("");
    lines.push(`- **Returns:** ${rec.returns}`);
    lines.push(`- **Calls made:** ${rec.count}`);
    lines.push("");
    lines.push("Sample shape:");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(rec.sample ?? null, null, 2));
    lines.push("```");
    lines.push("");
  }

  writeFileSync(resolve(ctx.outDir, "ENDPOINT_MAP.md"), lines.join("\n"), "utf8");
}

run().catch((err) => {
  process.stderr.write(`[clickup-export] FATAL ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
