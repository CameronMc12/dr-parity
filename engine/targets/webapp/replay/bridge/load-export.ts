/**
 * Load the ClickUp export (public-API shapes) from an export directory and index
 * it for the bridge mappers: spaces, folders, lists, and tasks grouped by list.
 *
 * The export carries the user's REAL data in public-API shapes. The mappers
 * overlay this onto the captured internal-shape templates so the bundle renders
 * lists/tasks it never saw at capture time.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ExportStatus = {
  id: string;
  status: string;
  color?: string;
  orderindex?: number;
  type?: string;
};

export type ExportTask = {
  id: string;
  name: string;
  custom_id?: string | null;
  text_content?: string;
  description?: string;
  status: ExportStatus;
  orderindex?: string;
  date_created?: string;
  date_updated?: string;
  date_closed?: string | null;
  date_done?: string | null;
  archived?: boolean;
  creator?: { id: number; username: string; color: string; email: string };
  assignees?: unknown[];
  tags?: unknown[];
  priority?: unknown;
  due_date?: string | null;
  start_date?: string | null;
  custom_fields?: unknown[];
  team_id?: string;
  list?: { id: string; name?: string };
  folder?: { id: string; name?: string };
  space?: { id: string };
};

export type ExportList = {
  id: string;
  name: string;
  orderindex?: number;
  content?: string;
  status?: unknown;
  task_count?: number;
  folder?: { id: string; name?: string; hidden?: boolean };
  space?: { id: string; name?: string };
  archived?: boolean;
  override_statuses?: boolean;
  statuses?: ExportStatus[];
  permission_level?: string;
};

export type ExportFolder = {
  id: string;
  name: string;
  orderindex?: number;
  hidden?: boolean;
  space?: { id: string; name?: string };
  task_count?: string | number;
  archived?: boolean;
  statuses?: ExportStatus[];
  lists?: ExportList[];
  permission_level?: string;
};

export type ExportSpace = {
  id: string;
  name: string;
  color?: string | null;
  private?: boolean;
  avatar?: unknown;
  statuses?: ExportStatus[];
  multiple_assignees?: boolean;
  features?: unknown;
};

export type ExportData = {
  workspaceId: string;
  spaces: ExportSpace[];
  folders: ExportFolder[];
  lists: ExportList[];
  tasksByList: Map<string, ExportTask[]>;
  listsById: Map<string, ExportList>;
  /** Owner user id derived from any task creator, for synthetic user maps. */
  owner: { id: number; username: string; color: string; email: string } | null;
};

function readJson<T>(dir: string, file: string, fallback: T): T {
  const path = join(dir, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function readWorkspaceId(dir: string): string {
  const ws = readJson<{ id?: string | number; team_id?: string }>(dir, 'workspace.json', {});
  if (ws.id !== undefined) return String(ws.id);
  if (ws.team_id) return String(ws.team_id);
  const summary = readJson<{ workspaceId?: string }>(dir, 'summary.json', {});
  return summary.workspaceId ?? '';
}

export function loadExport(exportDir: string): ExportData {
  if (!existsSync(exportDir)) {
    throw new Error(`Export directory does not exist: ${exportDir}`);
  }

  const workspaceId = readWorkspaceId(exportDir);
  const spaces = readJson<ExportSpace[]>(exportDir, 'spaces.json', []);
  const folders = readJson<ExportFolder[]>(exportDir, 'folders.json', []);
  const lists = readJson<ExportList[]>(exportDir, 'lists.json', []);
  const tasks = readJson<ExportTask[]>(exportDir, 'tasks.json', []);

  const tasksByList = new Map<string, ExportTask[]>();
  let owner: ExportData['owner'] = null;
  for (const task of tasks) {
    const listId = task.list?.id;
    if (!listId) continue;
    const arr = tasksByList.get(listId) ?? [];
    arr.push(task);
    tasksByList.set(listId, arr);
    if (!owner && task.creator) owner = task.creator;
  }

  const listsById = new Map<string, ExportList>();
  for (const list of lists) listsById.set(list.id, list);
  // Folder-embedded lists may carry richer data; index those too.
  for (const folder of folders) {
    for (const list of folder.lists ?? []) {
      if (!listsById.has(list.id)) {
        listsById.set(list.id, { ...list, folder: { id: folder.id, name: folder.name } });
        if (!lists.find((l) => l.id === list.id)) lists.push(list);
      }
    }
  }

  return { workspaceId, spaces, folders, lists, tasksByList, listsById, owner };
}
