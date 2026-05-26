import type { EventStore } from "../store/event-store.js";

export interface TaskRow {
  taskId: string;
  listId: string;
  name: string;
  status: string;
  description: string | null;
  assignees: number[];
  archived: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RawTaskRow {
  task_id: string;
  list_id: string;
  name: string;
  status: string;
  description: string | null;
  assignees: string;
  archived: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}

function toTaskRow(r: RawTaskRow): TaskRow {
  return {
    taskId: r.task_id,
    listId: r.list_id,
    name: r.name,
    status: r.status,
    description: r.description,
    assignees: JSON.parse(r.assignees) as number[],
    archived: r.archived === 1,
    deleted: r.deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Read-side queries against the `tasks` projection. No event-store access. */
export class TaskQueries {
  constructor(private readonly store: EventStore) {}

  getTask(taskId: string): TaskRow | null {
    const row = this.store.connection
      .prepare("SELECT * FROM tasks WHERE task_id = ?")
      .get(taskId) as RawTaskRow | undefined;
    return row ? toTaskRow(row) : null;
  }

  /** Live tasks for a list (deleted rows excluded), ordered by id for stability. */
  listTasks(listId: string): TaskRow[] {
    const rows = this.store.connection
      .prepare("SELECT * FROM tasks WHERE list_id = ? AND deleted = 0 ORDER BY task_id ASC")
      .all(listId) as unknown as RawTaskRow[];
    return rows.map(toTaskRow);
  }

  /** Every live task across all lists. */
  allTasks(): TaskRow[] {
    const rows = this.store.connection
      .prepare("SELECT * FROM tasks WHERE deleted = 0 ORDER BY task_id ASC")
      .all() as unknown as RawTaskRow[];
    return rows.map(toTaskRow);
  }
}
