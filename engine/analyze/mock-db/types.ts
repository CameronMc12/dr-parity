/**
 * Normalized mock-db schema for the DR-PARITY-SEED ClickUp clone.
 *
 * Every collection is keyed by real ClickUp id. Values prefer REAL captured
 * data; fields that were never seen in the captures fall back to the seed
 * fixture (engine/seed/fixture.ts) and are flagged via `_source`.
 */

export type EntitySource = 'captured' | 'fixture';

export interface MockUser {
  id: string;
  username: string;
  email: string | null;
  color: string | null;
  initials: string | null;
  profilePicture: string | null;
  timezone?: string | null;
  _source: EntitySource;
}

export interface MockWorkspace {
  id: string;
  name: string;
  color: string | null;
  ownerId: string;
  dateCreated: string | null;
  memberIds: string[];
  _source: EntitySource;
}

export interface MockStatus {
  id: string;
  status: string;
  color: string | null;
  type: string; // open | custom | closed | done | unstarted
  orderindex: number | null;
  projectId: string | null;
  _source: EntitySource;
}

export interface MockSpace {
  id: string;
  name: string;
  workspaceId: string;
  color: string | null;
  private: boolean;
  orderindex: number | null;
  content: string | null;
  statusIds: string[];
  folderIds: string[];
  folderlessListIds: string[];
  _source: EntitySource;
}

export interface MockFolder {
  id: string;
  name: string;
  spaceId: string;
  orderindex: number | null;
  hidden: boolean;
  content: string | null;
  listIds: string[];
  _source: EntitySource;
}

export interface MockList {
  id: string;
  name: string;
  folderId: string | null;
  spaceId: string;
  orderindex: number | null;
  content: string | null;
  statusIds: string[];
  taskIds: string[];
  _source: EntitySource;
}

export interface MockChecklistItem {
  id: string;
  name: string;
  resolved: boolean;
}

export interface MockChecklist {
  id: string;
  name: string;
  resolved: number;
  unresolved: number;
  items: MockChecklistItem[];
}

export interface MockCustomFieldValue {
  fieldId: string | null;
  name: string;
  type: string;
  value: string | number | boolean | null;
}

export interface MockTask {
  id: string;
  name: string;
  description: string | null;
  listId: string | null;
  statusId: string | null;
  status: string | null;
  priority: number | null; // 1=urgent .. 4=low, null=none
  parentId: string | null;
  subtaskIds: string[];
  assigneeIds: string[];
  tagNames: string[];
  startDate: string | null;
  dueDate: string | null;
  dateCreated: string | null;
  checklists: MockChecklist[];
  customFieldValues: MockCustomFieldValue[];
  commentCount: number;
  dependsOnIds: string[];
  _source: EntitySource;
}

export interface MockCustomFieldOption {
  id: string | null;
  name: string;
  color: string | null;
  orderindex: number | null;
}

export interface MockCustomField {
  id: string;
  name: string;
  type: string;
  options: MockCustomFieldOption[];
  _source: EntitySource;
}

export interface MockTag {
  name: string;
  fg: string;
  bg: string;
  spaceId: string | null;
  _source: EntitySource;
}

export interface MockComment {
  id: string;
  taskId: string | null;
  text: string;
  userId: string | null;
  date: string | null;
  resolved: boolean;
  _source: EntitySource;
}

export interface MockGoal {
  id: string;
  name: string;
  prettyId: string | null;
  description: string | null;
  dueDate: string | null;
  startDate: string | null;
  dateCreated: string | null;
  ownerId: string | null;
  private: boolean;
  _source: EntitySource;
}

export interface MockDocPage {
  id: string;
  name: string;
  content: string | null;
  docId: string;
  orderindex: number | null;
  _source: EntitySource;
}

export interface MockDoc {
  id: string;
  name: string;
  workspaceId: string;
  pageIds: string[];
  _source: EntitySource;
}

export type Keyed<T> = Record<string, T>;

export interface MockDb {
  meta: {
    generatedAt: string;
    teamId: string;
    spaceId: string;
    sourceRuns: string[];
    marker: string;
  };
  workspace: MockWorkspace | null;
  users: Keyed<MockUser>;
  spaces: Keyed<MockSpace>;
  folders: Keyed<MockFolder>;
  lists: Keyed<MockList>;
  statuses: Keyed<MockStatus>;
  tasks: Keyed<MockTask>;
  customFields: Keyed<MockCustomField>;
  tags: Keyed<MockTag>;
  comments: Keyed<MockComment>;
  goals: Keyed<MockGoal>;
  docs: Keyed<MockDoc>;
  pages: Keyed<MockDocPage>;
}

/** One captured request/response line from network.jsonl. */
export interface NetLine {
  kind: 'request' | 'response';
  method?: string;
  url: string;
  status?: number;
  body?: string;
  bodyEncoding?: 'utf8' | 'base64' | string;
  bodySize?: number;
  capturedAt?: string;
}

/** A captured response with its decoded, JSON-parsed body. */
export interface CapturedResponse {
  url: string;
  status: number;
  method: string;
  json: unknown;
  run: string;
}

/** surface-map endpoints.json entry. */
export interface SurfaceEndpoint {
  service: string;
  version: string;
  method: string;
  pathTemplate: string;
  exampleUrl: string;
  count: number;
  sampleResponseBodyShape: unknown;
  sampleRequestBodyShape: unknown;
}

export interface EndpointMapEntry {
  service: string;
  method: string;
  pathTemplate: string;
  exampleUrl: string;
  hasCapturedResponse: boolean;
  status: number | null;
  example: unknown;
}

export type EndpointMap = Record<string, EndpointMapEntry[]>;
