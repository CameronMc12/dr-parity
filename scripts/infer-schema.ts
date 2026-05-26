// CLI: read the real ClickUp export, infer per-entity shapes, and emit
//   zod schemas, TS types, SQLite DDL and a mapping note into
//   engine/targets/webapp/backend/schema/generated/.
//
// Usage:
//   npm run schema:infer
//   npm run schema:infer -- --export=docs/research/clickup-export/<timestamp>

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { generateAll, inferFromSamples } from "../engine/targets/webapp/backend/schema/generate.js";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const EXPORT_PARENT = join(REPO_ROOT, "docs/research/clickup-export");
const OUT_DIR = join(REPO_ROOT, "engine/targets/webapp/backend/schema/generated");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return hit?.split("=").slice(1).join("=");
}

function latestExportDir(): string {
  const override = argValue("export");
  if (override) return resolve(REPO_ROOT, override);
  const dirs = readdirSync(EXPORT_PARENT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-/.test(d.name))
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) throw new Error(`No export dir found under ${EXPORT_PARENT}`);
  return join(EXPORT_PARENT, dirs[dirs.length - 1]);
}

function loadJson(dir: string, file: string): unknown {
  const path = join(dir, file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const arr = Object.values(value).find(Array.isArray);
    if (arr) return arr as unknown[];
  }
  return [];
}

/** Flatten a task into the projection-shaped row used for inference. */
function flattenTask(t: Record<string, any>): Record<string, unknown> {
  return {
    id: t.id,
    custom_id: t.custom_id ?? null,
    custom_item_id: t.custom_item_id ?? null,
    name: t.name,
    text_content: t.text_content ?? null,
    description: t.description ?? null,
    status_id: t.status?.id ?? null,
    orderindex: t.orderindex ?? null,
    date_created: t.date_created ?? null,
    date_updated: t.date_updated ?? null,
    date_closed: t.date_closed ?? null,
    date_done: t.date_done ?? null,
    archived: t.archived ?? false,
    creator_id: t.creator?.id != null ? String(t.creator.id) : null,
    assignees: t.assignees ?? [],
    watchers: t.watchers ?? [],
    tags: t.tags ?? [],
    checklists: t.checklists ?? [],
    parent_id: t.parent ?? null,
    top_level_parent_id: t.top_level_parent ?? null,
    priority: t.priority ?? null,
    due_date: t.due_date ?? null,
    start_date: t.start_date ?? null,
    points: t.points ?? null,
    time_estimate: t.time_estimate ?? null,
    time_spent: t.time_spent ?? null,
    dependencies: t.dependencies ?? [],
    linked_tasks: t.linked_tasks ?? [],
    list_id: t.list?.id ?? null,
    folder_id: t.folder?.id ?? null,
    space_id: t.space?.id ?? null,
    team_id: t.team_id ?? null,
    url: t.url ?? null,
    sharing: t.sharing ?? null,
    permission_level: t.permission_level ?? null,
  };
}

function collectSamples(dir: string): Record<string, unknown[]> {
  const workspace = loadJson(dir, "workspace.json") as Record<string, any> | null;
  const spaces = asArray(loadJson(dir, "spaces.json")) as Record<string, any>[];
  const folders = asArray(loadJson(dir, "folders.json")) as Record<string, any>[];
  const lists = asArray(loadJson(dir, "lists.json")) as Record<string, any>[];
  const tasks = asArray(loadJson(dir, "tasks.json")) as Record<string, any>[];
  const cfFile = asArray(loadJson(dir, "custom-fields.json")) as Record<string, any>[];
  const commentFile = asArray(loadJson(dir, "task-comments.json")) as Record<string, any>[];
  const members = asArray(loadJson(dir, "members.json")) as Record<string, any>[];

  const parentTasks = tasks.filter((t) => !t.parent);
  const subtasks = tasks.filter((t) => t.parent);

  // Statuses flattened from spaces + folders + lists.
  const statusRows: Record<string, unknown>[] = [];
  for (const sp of spaces) for (const s of sp.statuses ?? []) statusRows.push({ ...s, scope_id: sp.id });
  for (const f of folders) for (const s of f.statuses ?? []) statusRows.push({ ...s, scope_id: f.id });

  // Custom field defs grouped by listId -> fields (may be nested twice).
  const cfDefs: Record<string, unknown>[] = [];
  for (const entry of cfFile) {
    const raw = entry.fields;
    const defs: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.fields) ? raw.fields : [];
    for (const d of defs) {
      cfDefs.push({
        id: d.id,
        list_id: entry.listId ?? null,
        name: d.name,
        type: d.type,
        type_config: d.type_config ?? null,
        date_created: d.date_created ?? null,
        hide_from_guests: d.hide_from_guests ?? null,
        required: d.required ?? null,
      });
    }
  }

  // Task field values from each task's custom_fields that carry a value.
  const fieldValues: Record<string, unknown>[] = [];
  for (const t of tasks) {
    for (const cf of t.custom_fields ?? []) {
      if (!("value" in cf)) continue;
      fieldValues.push({ task_id: t.id, field_id: cf.id, type: cf.type ?? null, value: cf.value ?? null });
    }
  }

  // Comments flattened from {taskId, comments:{comments:[]}}.
  const commentRows: Record<string, unknown>[] = [];
  for (const entry of commentFile) {
    const inner = entry.comments?.comments ?? entry.comments ?? [];
    for (const c of Array.isArray(inner) ? inner : []) {
      commentRows.push({
        id: c.id,
        task_id: entry.taskId,
        user_id: c.user?.id != null ? String(c.user.id) : null,
        comment_text: c.comment_text ?? null,
        date: c.date ?? null,
        resolved: c.resolved ?? null,
      });
    }
  }

  // Users from workspace members + task creators/assignees.
  const userMap = new Map<string, Record<string, unknown>>();
  const addUser = (u: any) => {
    if (!u || u.id == null) return;
    const id = String(u.id);
    if (!userMap.has(id)) {
      userMap.set(id, {
        id,
        username: u.username ?? null,
        email: u.email ?? null,
        color: u.color ?? null,
        initials: u.initials ?? null,
        profile_picture: u.profilePicture ?? null,
      });
    }
  };
  for (const m of [...(workspace?.members ?? []), ...members]) addUser(m.user);
  for (const t of tasks) {
    addUser(t.creator);
    for (const a of t.assignees ?? []) addUser(a);
  }

  // Memberships.
  const wsId = workspace?.id != null ? String(workspace.id) : null;
  const memberships: Record<string, unknown>[] = [];
  for (const m of [...(workspace?.members ?? []), ...members]) {
    const u = m.user;
    if (!u) continue;
    memberships.push({
      user_id: String(u.id),
      workspace_id: wsId,
      role: u.role ?? null,
      role_key: u.role_key ?? null,
      role_subtype: u.role_subtype ?? null,
      date_joined: u.date_joined ?? null,
      date_invited: u.date_invited ?? null,
      last_active: u.last_active ?? null,
    });
  }

  return {
    Workspace: workspace ? [workspace] : [],
    Space: spaces,
    Folder: folders,
    List: lists,
    Task: parentTasks.map(flattenTask),
    Subtask: subtasks.map(flattenTask),
    Status: statusRows,
    CustomFieldDef: cfDefs,
    TaskFieldValue: fieldValues,
    Comment: commentRows,
    User: [...userMap.values()],
    Membership: memberships,
  };
}

function main(): void {
  const exportDir = latestExportDir();
  console.log(`[schema:infer] export: ${exportDir}`);

  const samples = collectSamples(exportDir);
  const shapes = inferFromSamples(samples);
  const artifacts = generateAll(shapes);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "entities.zod.ts"), artifacts.zod);
  writeFileSync(join(OUT_DIR, "entities.ts"), artifacts.types);
  writeFileSync(join(OUT_DIR, "schema.sql"), artifacts.ddl);
  writeFileSync(join(OUT_DIR, "MAPPING.md"), artifacts.mapping);

  console.log(`[schema:infer] wrote 4 files to ${OUT_DIR}`);
  for (const [entity, rows] of Object.entries(samples)) {
    console.log(`  ${entity.padEnd(16)} ${rows.length} samples, ${shapes[entity].fields.size} fields`);
  }
}

main();
