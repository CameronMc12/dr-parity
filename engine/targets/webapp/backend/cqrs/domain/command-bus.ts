import type { EventStore } from "../store/event-store.js";
import type { IdGen } from "../store/clock.js";
import { CommandSchemas, type Command, type CommandType } from "./commands.js";
import type { CommandHandler, CommandResult, HandlerDeps } from "./handler.js";

/**
 * Routes commands to handlers. Responsibilities:
 *  1. Validate payload against the command's Zod schema (boundary trust).
 *  2. Short-circuit on idempotency key (same key + workspace => prior result).
 *  3. Run the handler's decide(), append events under optimistic concurrency.
 *  4. Record idempotency result + command_log in the same logical flow.
 */
export class CommandBus {
  private readonly handlers = new Map<CommandType, CommandHandler<CommandType>>();
  private readonly store: EventStore;
  private readonly idGen: IdGen;

  constructor(deps: HandlerDeps) {
    this.store = deps.store;
    this.idGen = deps.idGen;
  }

  register<T extends CommandType>(handler: CommandHandler<T>): this {
    this.handlers.set(handler.commandType, handler as CommandHandler<CommandType>);
    return this;
  }

  dispatch(command: Command): CommandResult {
    const schema = CommandSchemas[command.type];
    if (!schema) throw new Error(`Unknown command type: ${command.type}`);

    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No handler registered for: ${command.type}`);

    if (command.idempotencyKey) {
      const prior = this.lookupIdempotency(command.idempotencyKey, command.workspaceId);
      if (prior) return { events: prior, idempotent: true };
    }

    const payload = schema.parse(command.payload);
    const ctx = handler["ctxFor"](command, null);
    const decision = handler.decide(payload, ctx);

    const events = this.store.appendEvents(
      decision.streamId,
      decision.expectedSeq,
      decision.events,
      ctx,
    );

    this.recordCommandLog(command, payload);
    if (command.idempotencyKey) {
      this.recordIdempotency(command, events);
    }

    return { events, idempotent: false };
  }

  private lookupIdempotency(key: string, workspaceId: string) {
    const row = this.store.connection
      .prepare(
        "SELECT result FROM idempotency_keys WHERE idempotency_key = ? AND workspace_id = ?",
      )
      .get(key, workspaceId) as { result: string } | undefined;
    return row ? (JSON.parse(row.result) as CommandResult["events"]) : null;
  }

  private recordIdempotency(command: Command, events: CommandResult["events"]): void {
    this.store.connection
      .prepare(
        `INSERT OR IGNORE INTO idempotency_keys
          (idempotency_key, workspace_id, command_type, result, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        command.idempotencyKey!,
        command.workspaceId,
        command.type,
        JSON.stringify(events),
        events[0]?.occurredAt ?? "",
      );
  }

  private recordCommandLog(command: Command, payload: unknown): void {
    const commandId = this.idGen.next("cmd");
    this.store.connection
      .prepare(
        `INSERT INTO command_log
          (command_id, command_type, actor_id, workspace_id, correlation_id, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        commandId,
        command.type,
        command.actorId,
        command.workspaceId,
        command.correlationId ?? command.idempotencyKey ?? "corr",
        JSON.stringify(payload),
        "applied",
        commandId,
      );
  }
}
