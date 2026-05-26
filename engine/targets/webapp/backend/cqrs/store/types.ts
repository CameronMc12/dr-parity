// Core event-store types shared across store, domain, and projectors.

export interface EventContext {
  actorId: string;
  workspaceId: string;
  correlationId: string;
  causationId: string | null;
  captureFlowId: string | null;
}

/** What a handler hands to the store: type + payload. The store fills the rest. */
export interface EventInput {
  streamType: string;
  type: string;
  payload: unknown;
}

/** A fully persisted event as read back from the store. */
export interface StoredEvent {
  eventId: string;
  streamType: string;
  streamId: string;
  seq: number;
  type: string;
  payload: unknown;
  actorId: string;
  workspaceId: string;
  correlationId: string;
  causationId: string | null;
  occurredAt: string;
  captureFlowId: string | null;
  globalSeq: number;
}

export interface OutboxRow {
  outboxId: number;
  eventId: string;
  streamId: string;
  type: string;
  payload: unknown;
  occurredAt: string;
  published: number;
}

/** Optimistic-concurrency failure: expected seq did not match the stream head. */
export class ConcurrencyError extends Error {
  constructor(
    public readonly streamId: string,
    public readonly expectedSeq: number,
    public readonly actualSeq: number,
  ) {
    super(
      `Concurrency conflict on stream "${streamId}": expected seq ${expectedSeq}, found ${actualSeq}`,
    );
    this.name = "ConcurrencyError";
  }
}
