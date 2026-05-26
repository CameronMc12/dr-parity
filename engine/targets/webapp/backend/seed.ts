/**
 * Seed a StoreSnapshot from a ClickUp export directory.
 *
 * Reuses `loadExport` (the proven export loader the bridge already uses) for
 * workspace/space/folder/list/task indexing, then folds in the additional
 * entities the backend serves: workspace metadata, members, and per-list custom
 * fields. The result is a flat snapshot the JsonStore (or a future SQLite store)
 * can hold and query.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadExport, type ExportTask } from '../replay/bridge/load-export';
import type {
  StoreCustomFieldSet,
  StoreDoc,
  StoreDocPages,
  StoreMember,
  StoreSnapshot,
} from './store-types';

function readJson<T>(dir: string, file: string, fallback: T): T {
  const path = join(dir, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

type MemberWrapper = { user?: StoreMember };
type WorkspaceJson = Record<string, unknown> & { members?: MemberWrapper[] };

function extractMembers(workspace: WorkspaceJson, membersFile: MemberWrapper[]): StoreMember[] {
  const out: StoreMember[] = [];
  const seen = new Set<number>();
  const collect = (wrappers: MemberWrapper[] | undefined): void => {
    for (const w of wrappers ?? []) {
      const u = w.user;
      if (!u || seen.has(u.id)) continue;
      seen.add(u.id);
      out.push(u);
    }
  };
  collect(workspace.members);
  collect(membersFile);
  return out;
}

export function seedSnapshot(exportDir: string): StoreSnapshot {
  const data = loadExport(exportDir);
  const workspace = readJson<WorkspaceJson>(exportDir, 'workspace.json', {});
  const membersFile = readJson<MemberWrapper[]>(exportDir, 'members.json', []);
  const members = extractMembers(workspace, membersFile);

  const owner: StoreMember | null = members[0]
    ? members[0]
    : data.owner
      ? {
          id: data.owner.id,
          username: data.owner.username,
          email: data.owner.email,
          color: data.owner.color,
          profilePicture: null,
          initials: data.owner.username
            .split(/\s+/)
            .map((p) => p[0])
            .filter(Boolean)
            .join('')
            .slice(0, 2)
            .toUpperCase(),
          role: 1,
          role_key: 'owner',
        }
      : null;

  const rawCustomFields = readJson<StoreCustomFieldSet[]>(exportDir, 'custom-fields.json', []);
  const customFields: StoreCustomFieldSet[] = rawCustomFields.map((cf) => {
    const wrapped = cf as unknown as { listId?: string; fields?: { fields?: unknown[] } | unknown[] };
    const inner = wrapped.fields;
    const fields = Array.isArray(inner)
      ? inner
      : Array.isArray((inner as { fields?: unknown[] })?.fields)
        ? ((inner as { fields: unknown[] }).fields)
        : [];
    return { listId: String(wrapped.listId ?? ''), fields };
  });

  const tree = readJson<Record<string, unknown> | null>(exportDir, 'tree.json', null);

  // Read tasks.json directly (loadExport's map drops tasks with no list id; for
  // the snapshot we keep the full list and let the store index by list.id).
  const tasks = readJson<ExportTask[]>(exportDir, 'tasks.json', []);

  // Doc metadata + per-doc pages-with-content. Powers the doc deep-link render
  // chain (POST docs/bulk + GET docs/v1/view/{docId}/page) entirely from owned
  // export data. Both files are optional — an export without them just yields
  // empty arrays and the doc handlers stay gated (no regression).
  const docs = readJson<StoreDoc[]>(exportDir, 'docs.json', []);
  const docPages = readJson<StoreDocPages[]>(exportDir, 'doc-pages.json', []);

  return {
    workspaceId: data.workspaceId,
    workspace,
    owner,
    members,
    spaces: data.spaces,
    folders: data.folders,
    lists: data.lists,
    tasks,
    customFields,
    tree,
    docs,
    docPages,
  };
}
