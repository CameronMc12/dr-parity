/**
 * Thin typed client for the ClickUp public API (v2 + v3 docs).
 *
 * Auth: personal token in the `Authorization` header WITHOUT a `Bearer` prefix.
 * Every write is throttled (see Throttle) and every non-2xx response throws an
 * error that includes the response body so failures are debuggable.
 *
 * NOTE: the public API has NO endpoint to CREATE custom fields. Fields are read
 * via `getListFields` and values are set on tasks via `setTaskFieldValue`. The
 * fixture's custom-field entries are matched by name; unmatched fields are
 * skipped (and surfaced as known gaps by the runner).
 */

import { Throttle } from './throttle.js';

const V2 = 'https://api.clickup.com/api/v2';
const V3 = 'https://api.clickup.com/api/v3';

export interface ClickUpClientOptions {
  token: string;
  minIntervalMs?: number;
}

export interface CuId {
  id: string;
}

export interface CuUser {
  id: number;
  username: string;
  email: string;
}

export interface CuSpace {
  id: string;
  name: string;
}

export interface CuFolder {
  id: string;
  name: string;
}

export interface CuList {
  id: string;
  name: string;
}

export interface CuTask {
  id: string;
  name: string;
}

export interface CuStatus {
  status: string;
  type: string; // 'open' | 'custom' | 'done' | 'closed'
}

export interface CuTag {
  name: string;
}

export interface CuFieldOption {
  id: string;
  name?: string;
  label?: string;
}

export interface CuCustomField {
  id: string;
  name: string;
  type: string;
  type_config?: { options?: CuFieldOption[] };
}

export interface CuChecklist {
  id: string;
}

export interface CuDoc {
  id: string;
}

function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`ClickUp client: ${label} must be a non-empty string.`);
  }
}

export class ClickUpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`ClickUp API ${status} for ${url}: ${body}`);
    this.name = 'ClickUpApiError';
  }
}

export class ClickUpClient {
  private readonly token: string;
  private readonly throttle: Throttle;

  constructor(opts: ClickUpClientOptions) {
    requireNonEmpty(opts.token, 'token');
    this.token = opts.token;
    this.throttle = new Throttle({ minIntervalMs: opts.minIntervalMs ?? 700 });
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<T> {
    await this.throttle.wait();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new ClickUpApiError(res.status, url, text || '<empty body>');
    }
    if (text.trim() === '') return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ClickUpApiError(res.status, url, `Invalid JSON: ${text}`);
    }
  }

  // ---- identity --------------------------------------------------------

  async getCurrentUser(): Promise<CuUser> {
    const data = await this.request<{ user: CuUser }>('GET', `${V2}/user`);
    return data.user;
  }

  // ---- spaces ----------------------------------------------------------

  async listSpaces(teamId: string): Promise<CuSpace[]> {
    requireNonEmpty(teamId, 'teamId');
    const data = await this.request<{ spaces: CuSpace[] }>(
      'GET',
      `${V2}/team/${teamId}/space?archived=false`,
    );
    return data.spaces ?? [];
  }

  async createSpace(teamId: string, name: string): Promise<CuSpace> {
    requireNonEmpty(teamId, 'teamId');
    requireNonEmpty(name, 'space name');
    return this.request<CuSpace>('POST', `${V2}/team/${teamId}/space`, {
      name,
      multiple_assignees: true,
      features: {
        due_dates: { enabled: true, start_date: true, remap_due_dates: false, remap_closed_due_date: false },
        time_tracking: { enabled: false },
        tags: { enabled: true },
        custom_fields: { enabled: true },
        dependency_warning: { enabled: true },
        checklists: { enabled: true },
      },
    });
  }

  async deleteSpace(spaceId: string): Promise<void> {
    requireNonEmpty(spaceId, 'spaceId');
    await this.request<void>('DELETE', `${V2}/space/${spaceId}`);
  }

  // ---- folders ---------------------------------------------------------

  async listFolders(spaceId: string): Promise<CuFolder[]> {
    requireNonEmpty(spaceId, 'spaceId');
    const data = await this.request<{ folders: CuFolder[] }>(
      'GET',
      `${V2}/space/${spaceId}/folder?archived=false`,
    );
    return data.folders ?? [];
  }

  async createFolder(spaceId: string, name: string): Promise<CuFolder> {
    requireNonEmpty(spaceId, 'spaceId');
    requireNonEmpty(name, 'folder name');
    return this.request<CuFolder>('POST', `${V2}/space/${spaceId}/folder`, { name });
  }

  // ---- lists -----------------------------------------------------------

  async listFolderLists(folderId: string): Promise<CuList[]> {
    requireNonEmpty(folderId, 'folderId');
    const data = await this.request<{ lists: CuList[] }>(
      'GET',
      `${V2}/folder/${folderId}/list?archived=false`,
    );
    return data.lists ?? [];
  }

  async listFolderlessLists(spaceId: string): Promise<CuList[]> {
    requireNonEmpty(spaceId, 'spaceId');
    const data = await this.request<{ lists: CuList[] }>(
      'GET',
      `${V2}/space/${spaceId}/list?archived=false`,
    );
    return data.lists ?? [];
  }

  async createFolderList(folderId: string, name: string, content?: string): Promise<CuList> {
    requireNonEmpty(folderId, 'folderId');
    requireNonEmpty(name, 'list name');
    return this.request<CuList>('POST', `${V2}/folder/${folderId}/list`, { name, content });
  }

  async createFolderlessList(spaceId: string, name: string, content?: string): Promise<CuList> {
    requireNonEmpty(spaceId, 'spaceId');
    requireNonEmpty(name, 'list name');
    return this.request<CuList>('POST', `${V2}/space/${spaceId}/list`, { name, content });
  }

  // ---- tasks -----------------------------------------------------------

  async listTasks(listId: string): Promise<CuTask[]> {
    requireNonEmpty(listId, 'listId');
    const data = await this.request<{ tasks: CuTask[] }>(
      'GET',
      `${V2}/list/${listId}/task?subtasks=true&include_closed=true`,
    );
    return data.tasks ?? [];
  }

  async getListStatuses(listId: string): Promise<CuStatus[]> {
    requireNonEmpty(listId, 'listId');
    const data = await this.request<{ statuses?: CuStatus[] }>('GET', `${V2}/list/${listId}`);
    return data.statuses ?? [];
  }

  async createTask(listId: string, payload: CreateTaskPayload): Promise<CuTask> {
    requireNonEmpty(listId, 'listId');
    requireNonEmpty(payload.name, 'task name');
    return this.request<CuTask>('POST', `${V2}/list/${listId}/task`, stripUndefined(payload));
  }

  // ---- tags ------------------------------------------------------------

  async listSpaceTags(spaceId: string): Promise<CuTag[]> {
    requireNonEmpty(spaceId, 'spaceId');
    const data = await this.request<{ tags: CuTag[] }>('GET', `${V2}/space/${spaceId}/tag`);
    return data.tags ?? [];
  }

  async createSpaceTag(spaceId: string, name: string, fg: string, bg: string): Promise<void> {
    requireNonEmpty(spaceId, 'spaceId');
    requireNonEmpty(name, 'tag name');
    await this.request<void>('POST', `${V2}/space/${spaceId}/tag`, {
      tag: { name, tag_fg: fg, tag_bg: bg },
    });
  }

  async addTagToTask(taskId: string, tagName: string): Promise<void> {
    requireNonEmpty(taskId, 'taskId');
    requireNonEmpty(tagName, 'tagName');
    await this.request<void>('POST', `${V2}/task/${taskId}/tag/${encodeURIComponent(tagName)}`);
  }

  // ---- custom fields ---------------------------------------------------

  async getListFields(listId: string): Promise<CuCustomField[]> {
    requireNonEmpty(listId, 'listId');
    const data = await this.request<{ fields: CuCustomField[] }>('GET', `${V2}/list/${listId}/field`);
    return data.fields ?? [];
  }

  async setTaskFieldValue(taskId: string, fieldId: string, value: unknown): Promise<void> {
    requireNonEmpty(taskId, 'taskId');
    requireNonEmpty(fieldId, 'fieldId');
    await this.request<void>('POST', `${V2}/task/${taskId}/field/${fieldId}`, { value });
  }

  // ---- comments --------------------------------------------------------

  async createTaskComment(taskId: string, text: string, assignee?: number): Promise<void> {
    requireNonEmpty(taskId, 'taskId');
    requireNonEmpty(text, 'comment text');
    await this.request<void>('POST', `${V2}/task/${taskId}/comment`, {
      comment_text: text,
      assignee,
      notify_all: false,
    });
  }

  // ---- checklists ------------------------------------------------------

  async createChecklist(taskId: string, name: string): Promise<CuChecklist> {
    requireNonEmpty(taskId, 'taskId');
    requireNonEmpty(name, 'checklist name');
    const data = await this.request<{ checklist: CuChecklist }>(
      'POST',
      `${V2}/task/${taskId}/checklist`,
      { name },
    );
    return data.checklist;
  }

  async createChecklistItem(checklistId: string, name: string, resolved: boolean): Promise<void> {
    requireNonEmpty(checklistId, 'checklistId');
    requireNonEmpty(name, 'checklist item name');
    await this.request<void>('POST', `${V2}/checklist/${checklistId}/checklist_item`, { name, resolved });
  }

  // ---- dependencies ----------------------------------------------------

  async createDependency(taskId: string, dependsOnId: string): Promise<void> {
    requireNonEmpty(taskId, 'taskId');
    requireNonEmpty(dependsOnId, 'dependsOnId');
    await this.request<void>('POST', `${V2}/task/${taskId}/dependency`, { depends_on: dependsOnId });
  }

  // ---- goals -----------------------------------------------------------

  async createGoal(
    teamId: string,
    name: string,
    description: string,
    dueDateMs: number,
    ownerId: number,
  ): Promise<CuId> {
    requireNonEmpty(teamId, 'teamId');
    requireNonEmpty(name, 'goal name');
    const data = await this.request<{ goal: CuId }>('POST', `${V2}/team/${teamId}/goal`, {
      name,
      description,
      due_date: dueDateMs,
      multiple_owners: true,
      owners: [ownerId],
    });
    return data.goal;
  }

  // ---- docs (v3) -------------------------------------------------------

  async createDoc(workspaceId: string, name: string): Promise<CuDoc> {
    requireNonEmpty(workspaceId, 'workspaceId');
    requireNonEmpty(name, 'doc name');
    return this.request<CuDoc>('POST', `${V3}/workspaces/${workspaceId}/docs`, {
      name,
      visibility: 'PRIVATE',
      create_page: false,
    });
  }

  async createDocPage(
    workspaceId: string,
    docId: string,
    name: string,
    content: string,
  ): Promise<CuId> {
    requireNonEmpty(workspaceId, 'workspaceId');
    requireNonEmpty(docId, 'docId');
    requireNonEmpty(name, 'doc page name');
    return this.request<CuId>('POST', `${V3}/workspaces/${workspaceId}/docs/${docId}/pages`, {
      name,
      content,
      content_format: 'text/md',
    });
  }
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  assignees?: number[];
  status?: string;
  priority?: number | null;
  start_date?: number;
  due_date?: number;
  parent?: string;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
