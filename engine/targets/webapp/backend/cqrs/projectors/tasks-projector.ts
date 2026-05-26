import type { DatabaseSync } from "node:sqlite";
import type { EventStore } from "../store/event-store.js";
import type { StoredEvent } from "../store/types.js";
import { type TaskCreated, type TaskStatusChanged } from "../domain/events.js";

const PROJECTOR_NAME = "TasksProjector";

const TASKS_DDL = `
CREATE TABLE IF NOT EXISTS tasks (
  task_id    TEXT PRIMARY KEY,
  list_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
    if (ev.type === "TaskCreated") {
      const p = ev.payload as TaskCreated;
      this.db
        .prepare(
          `INSERT INTO tasks (task_id, list_id, name, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(task_id) DO NOTHING`,
        )
        .run(p.taskId, p.listId, p.name, p.status, ev.occurredAt, ev.occurredAt);
    } else if (ev.type === "TaskStatusChanged") {
      const p = ev.payload as TaskStatusChanged;
      this.db
        .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?")
        .run(p.toStatus, ev.occurredAt, p.taskId);
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
