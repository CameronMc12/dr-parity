/**
 * Workspace store type contract. All entity shapes the local-first workspace
 * store manages. Derived from the real ClickUp export at
 * docs/research/clickup-export/2026-05-25T16-21-00-615Z/.
 */

import type { ViewConfig, ViewConfigActions } from './view-config.types';
import type { CustomFieldsActions } from './custom-fields';

export interface Assignee {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Member extends Assignee {
  email: string;
  roleKey: string;
}

export type StatusType = 'open' | 'custom' | 'closed' | 'done';

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface TaskTag {
  name: string;
  color: string;
}

/** A single tracked-time entry. `durationMs` is the accrued span. */
export interface TimeEntry {
  id: string;
  authorId: string;
  startedAt: number;
  durationMs: number;
}

export type ActivityKind =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'dates'
  | 'tags'
  | 'description'
  | 'estimate'
  | 'time'
  | 'relationship'
  | 'name'
  | 'created';

/** Auto-logged change record rendered in the activity feed. */
export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusType: string;
  listId: string;
  priority: string | null;
  priorityColor: string | null;
  dueDate: number | null;
  startDate: number | null;
  assignees: Assignee[];
  dateCreated: number | null;
  dateUpdated: number | null;
  parent: string | null;
  archived: boolean;
  /** Manual sort index within a list/group. Lower renders first. */
  order: number;
  /** Tags shown as chips on the row. Optional; seed tasks may omit it. */
  tags?: TaskTag[];
  /** Rich-text-free task body. Optional; seed tasks may omit it. */
  description?: string;
  /** Local-only comment thread appended via the panel composer. */
  comments?: TaskComment[];
  /** Estimated effort in minutes. */
  timeEstimate?: number | null;
  /** Tracked-time entries (start/stop timer + manual adds). */
  timeEntries?: TimeEntry[];
  /** Ids of other tasks this task is linked to. */
  linkedTaskIds?: string[];
  /** Auto-logged change feed, newest appended last. */
  activity?: ActivityEntry[];
}

/** Patch shape for updateTask — every field optional, id is fixed. */
export type TaskPatch = Partial<Omit<Task, 'id'>>;

/** Input for createTask. listId + name required; everything else defaulted. */
export interface CreateTaskInput {
  name: string;
  listId: string;
  status?: string;
  statusColor?: string;
  statusType?: string;
  priority?: string | null;
  priorityColor?: string | null;
  dueDate?: number | null;
  startDate?: number | null;
  assignees?: Assignee[];
  parent?: string | null;
  order?: number;
  tags?: TaskTag[];
}

// --- Tree ---------------------------------------------------------------

export type TreeNodeKind = 'space' | 'folder' | 'list';

export interface ListNode {
  id: string;
  name: string;
  /** Cached task count; recomputed from tasks on read where needed. */
  count: number;
}

export interface FolderNode {
  id: string;
  name: string;
  lists: ListNode[];
}

export interface SpaceNode {
  id: string;
  name: string;
  color: string;
  folderlessLists: ListNode[];
  folders: FolderNode[];
}

export interface WorkspaceTree {
  spaces: SpaceNode[];
}

// --- Chat ---------------------------------------------------------------

export interface Channel {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  text: string;
  createdAt: number;
}

// --- Docs (read-only seed) ---------------------------------------------

export interface DocNode {
  id: string;
  name: string;
  location: string;
  emoji: string | null;
  pageCount: number;
  updated: number;
}

// --- Recents (read-only seed) ------------------------------------------

export interface RecentItem {
  id: string;
  name: string;
  kind: 'doc' | 'task' | 'list' | 'space';
  location: string;
}

// --- Store state --------------------------------------------------------

export type { ViewConfig } from './view-config.types';

export interface WorkspaceState extends ViewConfigActions, CustomFieldsActions {
  // entities
  tasks: Record<string, Task>;
  tree: WorkspaceTree;
  channels: Channel[];
  messages: Record<string, Message[]>; // keyed by channelId
  docs: DocNode[];
  members: Member[];
  recents: RecentItem[];

  // ui state (persisted)
  favorites: string[]; // nodeIds
  expanded: Record<string, boolean>; // nodeId -> open
  currentMemberId: string;

  // id generation (deterministic, persisted)
  idCounter: number;

  // --- task actions ---
  createTask: (input: CreateTaskInput) => Task;
  updateTask: (id: string, patch: TaskPatch) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  moveTask: (id: string, listId: string) => void;
  setTags: (id: string, tags: TaskTag[]) => void;
  addTag: (id: string, tag: TaskTag) => void;
  removeTag: (id: string, name: string) => void;
  /** Re-sequence `order` across the given task ids (group-local DnD reorder). */
  reorderTasks: (orderedIds: string[]) => void;
  setTimeEstimate: (id: string, minutes: number | null) => void;
  addTimeEntry: (id: string, durationMs: number, startedAt?: number) => void;
  linkTask: (id: string, targetId: string) => void;
  unlinkTask: (id: string, targetId: string) => void;
  addComment: (id: string, text: string) => void;

  // --- tree actions ---
  createSpace: (name: string, color?: string) => SpaceNode;
  createFolder: (spaceId: string, name: string) => FolderNode | null;
  createList: (parent: { spaceId: string; folderId?: string }, name: string) => ListNode | null;
  renameNode: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleExpanded: (nodeId: string) => void;

  // --- chat actions ---
  createChannel: (name: string) => Channel;
  renameChannel: (id: string, name: string) => void;
  deleteChannel: (id: string) => void;
  sendMessage: (channelId: string, text: string) => Message;

  // --- favorites ---
  toggleFavorite: (nodeId: string) => void;

  // --- dev ---
  resetWorkspace: () => void;
}
