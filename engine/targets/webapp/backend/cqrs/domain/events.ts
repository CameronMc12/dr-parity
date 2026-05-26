import { z } from "zod";

// Event type registry. Past-tense facts. Each carries a Zod schema so projectors
// and replay can trust payload shape.

export const TASK_STREAM = "task";

export const TaskCreatedSchema = z.object({
  taskId: z.string(),
  listId: z.string(),
  name: z.string(),
  status: z.string(),
});

export const TaskStatusChangedSchema = z.object({
  taskId: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
});

export const EventSchemas = {
  TaskCreated: TaskCreatedSchema,
  TaskStatusChanged: TaskStatusChangedSchema,
} as const;

export type EventType = keyof typeof EventSchemas;
export type TaskCreated = z.infer<typeof TaskCreatedSchema>;
export type TaskStatusChanged = z.infer<typeof TaskStatusChangedSchema>;

export function parseEventPayload<T extends EventType>(
  type: T,
  payload: unknown,
): z.infer<(typeof EventSchemas)[T]> {
  return EventSchemas[type].parse(payload) as z.infer<(typeof EventSchemas)[T]>;
}
