import { DatabaseSync } from "node:sqlite";
import type { Clock, IdGen } from "./clock.js";
import { applySchema } from "./schema.js";
import {
  ConcurrencyError,
  type EventContext,
  type EventInput,
  type StoredEvent,
  type OutboxRow,
} from "./types.js";

export interface Snapshot<S> {
  seq: number;
  state: S;
}

export interface LoadedStream<S> {
  /** Snapshot state, if any, that the caller should fold remaining events onto. */
  snapshotState: S | null;
  /** Seq the snapshot was taken at (0 if none). */
  fromSeq: number;
  /** Events after the snapshot (or all events if no snapshot). */
  events: StoredEvent[];
  /** Current head seq of the stream (0 if empty). */
  headSeq: number;
}

export class EventStore {
  private readonly db: DatabaseSync;

  constructor(
    location: string,
    private readonly clock: Clock,
    private readonly idGen: IdGen,
  ) {
    this.db = new DatabaseSync(location);
    applySchema(this.db);
  }

  /**
   * Append events to a stream under optimistic concurrency.
   * expectedSeq must equal the current head seq, else ConcurrencyError.
   * Events + their outbox rows are written in a single transaction.
   */
  appendEvents(
    streamId: string,
    expectedSeq: number,
    events: EventInput[],
    ctx: EventContext,
  ): StoredEvent[] {
    if (events.length === 0) return [];

    const tx = this.db.exec.bind(this.db);
    tx("BEGIN IMMEDIATE;");
    try {
      const actualSeq = this.headSeq(streamId);
      if (actualSeq !== expectedSeq) {
        throw new ConcurrencyError(streamId, expectedSeq, actualSeq);
      }

      const insertEvent = this.db.prepare(
        `INSERT INTO events
          (event_id, stream_type, stream_id, seq, type, payload, actor_id,
           workspace_id, correlation_id, causation_id, occurred_at, capture_flow_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertOutbox = this.db.prepare(
        `INSERT INTO outbox (event_id, stream_id, type, payload, occurred_at)
         VALUES (?, ?, ?, ?, ?)`,
      );

      const stored: StoredEvent[] = [];
      let seq = expectedSeq;
      for (const ev of events) {
        seq += 1;
        const eventId = this.idGen.next("evt");
        const occurredAt = this.clock.now();
        const payloadJson = JSON.stringify(ev.payload);

        insertEvent.run(
          eventId,
          ev.streamType,
          streamId,
          seq,
          ev.type,
          payloadJson,
          ctx.actorId,
          ctx.workspaceId,
          ctx.correlationId,
          ctx.causationId,
          occurredAt,
          ctx.captureFlowId,
        );
        insertOutbox.run(eventId, streamId, ev.type, payloadJson, occurredAt);

        const row = this.db
          .prepare("SELECT global_seq FROM events WHERE event_id = ?")
          .get(eventId) as { global_seq: number };

        stored.push({
          eventId,
          streamType: ev.streamType,
          streamId,
          seq,
          type: ev.type,
          payload: ev.payload,
          actorId: ctx.actorId,
          workspaceId: ctx.workspaceId,
          correlationId: ctx.correlationId,
          causationId: ctx.causationId,
          occurredAt,
          captureFlowId: ctx.captureFlowId,
          globalSeq: row.global_seq,
        });
      }

      tx("COMMIT;");
      return stored;
    } catch (err) {
      tx("ROLLBACK;");
      throw err;
    }
  }

  headSeq(streamId: string): number {
    const row = this.db
      .prepare("SELECT MAX(seq) AS head FROM events WHERE stream_id = ?")
      .get(streamId) as { head: number | null };
    return row.head ?? 0;
  }

  /** Total events persisted. Used to prime an id generator past existing ids. */
  eventCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
    return row.n;
  }

  /** Rehydrate a stream from snapshot (if present) + subsequent events. */
  loadStream<S>(streamId: string): LoadedStream<S> {
    const snapRow = this.db
      .prepare("SELECT seq, state FROM snapshots WHERE stream_id = ?")
      .get(streamId) as { seq: number; state: string } | undefined;

    const fromSeq = snapRow?.seq ?? 0;
    const snapshotState = snapRow ? (JSON.parse(snapRow.state) as S) : null;

    const rows = this.db
      .prepare(
        "SELECT * FROM events WHERE stream_id = ? AND seq > ? ORDER BY seq ASC",
      )
      .all(streamId, fromSeq) as unknown as RawEventRow[];

    const events = rows.map(toStoredEvent);
    const headSeq = events.length > 0 ? events[events.length - 1]!.seq : fromSeq;
    return { snapshotState, fromSeq, events, headSeq };
  }

  /** Read every event after a global seq, in global order. Drives projectors. */
  readAll(fromGlobalSeq = 0): StoredEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE global_seq > ? ORDER BY global_seq ASC")
      .all(fromGlobalSeq) as unknown as RawEventRow[];
    return rows.map(toStoredEvent);
  }

  saveSnapshot<S>(streamId: string, snapshot: Snapshot<S>): void {
    this.db
      .prepare(
        `INSERT INTO snapshots (stream_id, seq, state, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(stream_id) DO UPDATE SET
           seq = excluded.seq, state = excluded.state, created_at = excluded.created_at`,
      )
      .run(streamId, snapshot.seq, JSON.stringify(snapshot.state), this.clock.now());
  }

  readOutbox(limit = 100): OutboxRow[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM outbox WHERE published = 0 ORDER BY outbox_id ASC LIMIT ?",
      )
      .all(limit) as unknown as RawOutboxRow[];
    return rows.map((r) => ({
      outboxId: r.outbox_id,
      eventId: r.event_id,
      streamId: r.stream_id,
      type: r.type,
      payload: JSON.parse(r.payload),
      occurredAt: r.occurred_at,
      published: r.published,
    }));
  }

  markOutboxPublished(outboxIds: number[]): void {
    const stmt = this.db.prepare("UPDATE outbox SET published = 1 WHERE outbox_id = ?");
    for (const id of outboxIds) stmt.run(id);
  }

  /** Direct handle for projectors that own their own read tables. */
  get connection(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

interface RawEventRow {
  global_seq: number;
  event_id: string;
  stream_type: string;
  stream_id: string;
  seq: number;
  type: string;
  payload: string;
  actor_id: string;
  workspace_id: string;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  capture_flow_id: string | null;
}

interface RawOutboxRow {
  outbox_id: number;
  event_id: string;
  stream_id: string;
  type: string;
  payload: string;
  occurred_at: string;
  published: number;
}

function toStoredEvent(r: RawEventRow): StoredEvent {
  return {
    eventId: r.event_id,
    streamType: r.stream_type,
    streamId: r.stream_id,
    seq: r.seq,
    type: r.type,
    payload: JSON.parse(r.payload),
    actorId: r.actor_id,
    workspaceId: r.workspace_id,
    correlationId: r.correlation_id,
    causationId: r.causation_id,
    occurredAt: r.occurred_at,
    captureFlowId: r.capture_flow_id,
    globalSeq: r.global_seq,
  };
}
