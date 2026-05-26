import type { IdGen } from "./store/clock.js";
import type { EventStore } from "./store/event-store.js";
import { CommandBus } from "./domain/command-bus.js";
import type { HandlerDeps } from "./domain/handler.js";
import {
  AddCommentHandler,
  ArchiveTaskHandler,
  AssignTaskHandler,
  CreateTaskHandler,
  DeleteTaskHandler,
  MoveTaskHandler,
  SetTaskStatusHandler,
  UpdateTaskHandler,
} from "./domain/task-handlers.js";

/**
 * Build a CommandBus with every task command handler registered. One place to
 * extend as new commands are added, used by both the seed and the live server.
 */
export function buildCommandBus(store: EventStore, idGen: IdGen): CommandBus {
  const deps: HandlerDeps = { store, idGen };
  return new CommandBus(deps)
    .register(new CreateTaskHandler(deps))
    .register(new SetTaskStatusHandler(deps))
    .register(new UpdateTaskHandler(deps))
    .register(new AssignTaskHandler(deps))
    .register(new MoveTaskHandler(deps))
    .register(new ArchiveTaskHandler(deps))
    .register(new DeleteTaskHandler(deps))
    .register(new AddCommentHandler(deps));
}
