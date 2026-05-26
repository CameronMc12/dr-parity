import type { DatabaseSync } from "node:sqlite";
import type { EventStore } from "../store/event-store.js";
import type { StoredEvent } from "../store/types.js";
import {
  type TaskCreated,
  type TaskMoved,
  type TaskRenamed,
  type TaskStatusChanged,
} from "../domain/events.js";

const PROJECTOR_NAME = "TasksProjector";

const TASKS_DDL = `
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL,
  description TEXT,
  assignees   TEXT NOT NULL DEFAULT '[]',
  archived    INTEGER NOT NULL DEFAULT 0,
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id);
`;

/**
 * Builds and maintains the `tasks` read table from the event stream.
 * Consumes events in global order, advances a checkpoint => replay-safe.
 * Dropping `tasks` and replaying from seq 0 reproduces identical rows.
 */
export class TasksProjector {
  private readonly db: DatabaseSync;

  constructor(private readonly store: EventStore) {
    this.db = store.connection;
    this.db.exec(TASKS_DDL);
  }

  /** Apply all events newer than the saved checkpoint. */
  catchUp(): number {
    const checkpoint = this.checkpoint();
    const events = this.store.readAll(checkpoint);
    let applied = 0;
    for (const ev of events) {
      this.apply(ev);
      this.advanceCheckpoint(ev.globalSeq);
      applied += 1;
    }
    return applied;
  }

  /** Drop the read table + checkpoint, then rebuild from the full event log. */
  rebuild(): number {
    this.db.exec("DROP TABLE IF EXISTS tasks;");
    this.db.exec(TASKS_DDL);
    this.db
      .prepare("DELETE FROM projector_checkpoints WHERE projector_name = ?")
      .run(PROJECTOR_NAME);
    return this.catchUp();
  }

  private apply(ev: StoredEvent): void {
    switch (ev.type) {
      case "TaskCreated": {
        const p = ev.payload as TaskCreated;
        this.db
          .prepare(
            `INSERT INTO tasks (task_id, list_id, name, status, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(task_id) DO NOTHING`,
          )
          .run(p.taskId, p.listId, p.name, p.status, p.description ?? null, ev.occurredAt, ev.occurredAt);
        break;
      }
      case "TaskStatusChanged": {
        const p = ev.payload as TaskStatusChanged;
        this.db
          .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?")
          .run(p.toStatus, ev.occurredAt, p.taskId);
        break;
      }
      case "TaskRenamed": {
        const p = ev.payload as TaskRenamed;
        this.db
          .prepare("UPDATE tasks SET name = ?, updated_at = ? WHERE task_id = ?")
          .run(p.toName, ev.occurredAt, p.taskId);
        break;
      }
      case "TaskDescriptionSet": {
        const p = ev.payload as { taskId: string; description: string };
        this.db
          .prepare("UPDATE tasks SET description = ?, updated_at = ? WHERE task_id = ?")
          .run(p.description, ev.occurredAt, p.taskId);
        break;
      }
      case "TaskAssigned": {
        const p = ev.payload as { taskId: string; assigneeId: number };
        const row = this.db
          .prepare("SELECT assignees FROM tasks WHERE task_id = ?")
          .get(p.taskId) as { assignees: string } | undefined;
        if (!row) break;
        const ids = JSON.parse(row.assignees) as number[];
        if (!ids.includes(p.assigneeId)) ids.push(p.assigneeId);
        this.db
          .prepare("UPDATE tasks SET assignees = ?, updated_at = ? WHERE task_id = ?")
          .run(JSON.stringify(ids), ev.occurredAt, p.taskId);
        break;
      }
      case "TaskMoved": {
        const p = ev.payload as TaskMoved;
        this.db
          .prepare("UPDATE tasks SET list_id = ?, updated_at = ? WHERE task_id = ?")
          .run(p.toListId, ev.occurredAt, p.taskId);
        break;
      }
      case "TaskArchived": {
        const p = ev.payload as { taskId: string; archived: boolean };
        this.db
          .prepare("UPDATE tasks SET archived = ?, updated_at = ? WHERE task_id = ?")
          .run(p.archived ? 1 : 0, ev.occurredAt, p.taskId);
        break;
      }
      case "TaskDeleted": {
        const p = ev.payload as { taskId: string };
        this.db
          .prepare("UPDATE tasks SET deleted = 1, updated_at = ? WHERE task_id = ?")
          .run(ev.occurredAt, p.taskId);
        break;
      }
      default:
        break;
    }
  }

  private checkpoint(): number {
    const row = this.db
      .prepare(
        "SELECT last_global_seq FROM projector_checkpoints WHERE projector_name = ?",
      )
      .get(PROJECTOR_NAME) as { last_global_seq: number } | undefined;
    return row?.last_global_seq ?? 0;
  }

  private advanceCheckpoint(globalSeq: number): void {
    this.db
      .prepare(
        `INSERT INTO projector_checkpoints (projector_name, last_global_seq)
         VALUES (?, ?)
         ON CONFLICT(projector_name) DO UPDATE SET last_global_seq = excluded.last_global_seq`,
      )
      .run(PROJECTOR_NAME, globalSeq);
  }
}
