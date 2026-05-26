// Owned deterministic CQRS + event-sourcing core for the webapp target.
// Capture is scaffolding; this is the real domain runtime. No Date.now / random.
export * from "./store/index.js";
export { CommandBus } from "./domain/command-bus.js";
export { CommandHandler } from "./domain/handler.js";
export type { Decision, HandlerDeps, CommandResult } from "./domain/handler.js";
export { CommandSchemas, type Command, type CommandType } from "./domain/commands.js";
export { EventSchemas, parseEventPayload, type EventType } from "./domain/events.js";
export { CreateTaskHandler, SetTaskStatusHandler } from "./domain/task-handlers.js";
export { TasksProjector } from "./projectors/tasks-projector.js";
export { TaskQueries, type TaskRow } from "./queries/task-queries.js";
