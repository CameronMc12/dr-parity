/**
 * Store interface for the OWNED ClickUp replay backend.
 *
 * The backend serves the bundle's internal-shape reads from the user's REAL
 * export data. The store abstracts persistence so we can start on a JSON-backed
 * implementation today (no native deps) and swap to SQLite (better-sqlite3)
 * later WITHOUT touching the request handlers or mappers. Both implementations
 * satisfy this same `BackendStore` interface.
 *
 * Entity rows mirror the export's public-API shapes (the bridge mappers already
 * know how to overlay these onto captured internal-shape templates). The store
 * is purely a typed query surface over those rows; it performs NO shape mapping.
 */

import type {
  ExportFolder,
  ExportList,
  ExportSpace,
  ExportTask,
} from '../replay/bridge/load-export';

/** A workspace member (the export carries `{ user: {...} }` wrappers). */
export type StoreMember = {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string | null;
  initials: string;
  role: number;
  role_key?: string;
  [key: string]: unknown;
};

/** Custom-field defs for one list (export shape: `{ listId, fields:{fields:[]} }`). */
export type StoreCustomFieldSet = {
  listId: string;
  fields: unknown[];
};

/** Read surface the request handlers query. Mapping to internal shapes happens
 *  in the handlers via the reused bridge mappers — never here. */
export interface BackendStore {
  workspaceId(): string;
  workspace(): Record<string, unknown> | null;
  owner(): StoreMember | null;
  members(): StoreMember[];
  spaces(): ExportSpace[];
  folders(): ExportFolder[];
  lists(): ExportList[];
  listById(listId: string): ExportList | undefined;
  tasksByList(listId: string): ExportTask[];
  allTasks(): ExportTask[];
  taskToListId(taskId: string): string | undefined;
  customFieldsForList(listId: string): unknown[];
  /** Raw export tree.json (sidebar source) if present. */
  tree(): Record<string, unknown> | null;
}

/** Seeded snapshot the JSON store holds in memory (and SQLite would persist). */
export type StoreSnapshot = {
  workspaceId: string;
  workspace: Record<string, unknown> | null;
  owner: StoreMember | null;
  members: StoreMember[];
  spaces: ExportSpace[];
  folders: ExportFolder[];
  lists: ExportList[];
  tasks: ExportTask[];
  customFields: StoreCustomFieldSet[];
  tree: Record<string, unknown> | null;
};
