/**
 * Type contracts for the apps/web data feeder. Two halves:
 *   1. ClickUp export source shapes (the JSON the engine wrote under
 *      docs/research/clickup-export/<iso>/).
 *   2. The apps/web target shapes (must match
 *      apps/web/src/store/workspace/types.ts exactly so the app keeps
 *      typechecking after a regeneration).
 *
 * Only the fields the feeder reads/writes are modelled. Unknown export fields
 * are intentionally omitted.
 */

// --- Export source shapes ----------------------------------------------------

export interface ExportUser {
  id: number;
  username: string;
  email: string;
  color: string;
  initials: string;
  role_key?: string;
}

export interface ExportMemberEntry {
  user: ExportUser;
}

export interface ExportWorkspace {
  id: string;
  name: string;
  color: string;
  members: ExportMemberEntry[];
}

export interface ExportStatus {
  status: string;
  color: string;
  type: string;
  orderindex?: number;
}

export interface ExportPriority {
  priority: string;
  color: string;
  id: string;
  orderindex: string;
}

export interface ExportTag {
  name: string;
  tag_fg: string;
  tag_bg: string;
}

export interface ExportAssignee {
  id: number;
  username: string;
  color: string;
  initials: string;
  email: string;
}

export interface ExportTask {
  id: string;
  name: string;
  status: ExportStatus | null;
  priority: ExportPriority | null;
  due_date: string | null;
  start_date: string | null;
  date_created: string | null;
  date_updated: string | null;
  archived: boolean;
  parent: string | null;
  orderindex?: string;
  assignees: ExportAssignee[];
  tags: ExportTag[];
  description?: string;
  time_estimate?: number | null;
  list: { id: string; name: string };
  folder?: { id: string; name: string; hidden?: boolean };
  space?: { id: string };
}

export interface ExportListNode {
  id: string;
  name: string;
  tasks?: { id: string }[];
}

export interface ExportFolderNode {
  id: string;
  name: string;
  lists?: ExportListNode[];
}

export interface ExportSpaceNode {
  id: string;
  name: string;
  folders?: ExportFolderNode[];
  folderlessLists?: ExportListNode[];
}

export interface ExportTree {
  workspace?: unknown;
  spaces: ExportSpaceNode[];
}

export interface ExportSpace {
  id: string;
  name: string;
  color: string;
}

export interface ExportDocParent {
  id: string;
  /** 1=task, 4=space, 5=folder, 15=other. */
  type: number;
}

export interface ExportDoc {
  id: string;
  name: string;
  date_updated: number;
  parent: ExportDocParent;
}

export interface ExportDocPage {
  id: string;
  name: string;
  content: string;
  order_index: number;
  date_updated: number | null;
}

export interface ExportDocPages {
  docId: string;
  name: string;
  pages: ExportDocPage[];
}

// --- Target shapes (mirror apps/web/src/store/workspace/types.ts) ------------

export interface TargetAssignee {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface TargetMember extends TargetAssignee {
  email: string;
  roleKey: string;
}

export interface TargetTaskTag {
  name: string;
  color: string;
}

export interface TargetTask {
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
  assignees: TargetAssignee[];
  dateCreated: number | null;
  dateUpdated: number | null;
  parent: string | null;
  archived: boolean;
  tags?: TargetTaskTag[];
  description?: string;
  timeEstimate?: number | null;
}

export interface TargetListNode {
  id: string;
  name: string;
  count: number;
}

export interface TargetFolderNode {
  id: string;
  name: string;
  lists: TargetListNode[];
}

export interface TargetSpaceNode {
  id: string;
  name: string;
  color: string;
  folderlessLists: TargetListNode[];
  folders: TargetFolderNode[];
}

export interface TargetWorkspaceTree {
  spaces: TargetSpaceNode[];
}

export interface TargetDocNode {
  id: string;
  name: string;
  location: string;
  emoji: string | null;
  pageCount: number;
  updated: number;
}

export interface TargetDocPage {
  id: string;
  name: string;
  content: string;
  orderIndex: number;
  dateUpdated: number | null;
}

export interface TargetDocPages {
  docId: string;
  name: string;
  pages: TargetDocPage[];
}

/** Loaded + validated export bundle handed to the mappers. */
export interface ExportBundle {
  dir: string;
  workspace: ExportWorkspace;
  members: ExportMemberEntry[];
  tasks: ExportTask[];
  tree: ExportTree;
  spaces: ExportSpace[];
  docs: ExportDoc[];
  docPages: ExportDocPages[];
}
