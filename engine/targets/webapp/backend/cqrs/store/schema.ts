import type { DatabaseSync } from "node:sqlite";

// All metadata/event tables. Projection tables are owned by their projectors.
const DDL = `
CREATE TABLE IF NOT EXISTS events (
  global_seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        TEXT NOT NULL UNIQUE,
  stream_type     TEXT NOT NULL,
  stream_id       TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  type            TEXT NOT NULL,
  payload         TEXT NOT NULL,
  actor_id        TEXT NOT NULL,
  workspace_id    TEXT NOT NULL,
  correlation_id  TEXT NOT NULL,
  causation_id    TEXT,
  occurred_at     TEXT NOT NULL,
  capture_flow_id TEXT,
  UNIQUE(stream_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_stream ON events(stream_id, seq);

CREATE TABLE IF NOT EXISTS snapshots (
  stream_id   TEXT PRIMARY KEY,
  seq         INTEGER NOT NULL,
  state       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  outbox_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT NOT NULL,
  stream_id   TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, outbox_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT NOT NULL,
  workspace_id    TEXT NOT NULL,
  command_type    TEXT NOT NULL,
  result          TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (idempotency_key, workspace_id)
);

CREATE TABLE IF NOT EXISTS projector_checkpoints (
  projector_name TEXT PRIMARY KEY,
  last_global_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS command_log (
  command_id     TEXT PRIMARY KEY,
  command_type   TEXT NOT NULL,
  actor_id       TEXT NOT NULL,
  workspace_id   TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload        TEXT NOT NULL,
  status         TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
`;

export function applySchema(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(DDL);
}
