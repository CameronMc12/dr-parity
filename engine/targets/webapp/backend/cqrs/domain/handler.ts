import type { EventStore } from "../store/event-store.js";
import type { IdGen } from "../store/clock.js";
import type { EventContext, EventInput, StoredEvent } from "../store/types.js";
import type { Command, CommandType } from "./commands.js";

export interface HandlerDeps {
  store: EventStore;
  idGen: IdGen;
}

/** What a handler decides to do: which stream, expected head seq, and new events. */
export interface Decision {
  streamId: string;
  expectedSeq: number;
  events: EventInput[];
}

/**
 * Base command handler. Subclasses validate the (already schema-parsed) payload
 * against current stream state and return a Decision. The bus owns persistence.
 */
export abstract class CommandHandler<T extends CommandType> {
  abstract readonly commandType: T;

  constructor(protected readonly deps: HandlerDeps) {}

  /** Pure-ish: read stream state via deps.store, return events to append. */
  abstract decide(payload: unknown, ctx: EventContext): Decision;

  protected ctxFor(command: Command, causationId: string | null): EventContext {
    return {
      actorId: command.actorId,
      workspaceId: command.workspaceId,
      correlationId: command.correlationId ?? command.idempotencyKey ?? "corr",
      causationId,
      captureFlowId: null,
    };
  }
}

export interface CommandResult {
  events: StoredEvent[];
  idempotent: boolean;
}
