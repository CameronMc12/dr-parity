import { z } from "zod";

// Event type registry. Past-tense facts. Each carries a Zod schema so projectors
// and replay can trust payload shape.

export const TASK_STREAM = "task";

export const TaskCreatedSchema = z.object({
  taskId: z.string(),
  listId: z.string(),
  name: z.string(),
  status: z.string(),
  description: z.string().optional(),
});

export const TaskStatusChangedSchema = z.object({
  taskId: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
});

export const TaskRenamedSchema = z.object({
  taskId: z.string(),
  fromName: z.string(),
  toName: z.string(),
});

export const TaskDescriptionSetSchema = z.object({
  taskId: z.string(),
  description: z.string(),
});

export const TaskAssignedSchema = z.object({
  taskId: z.string(),
  assigneeId: z.number().int(),
});

export const TaskMovedSchema = z.object({
  taskId: z.string(),
  fromListId: z.string(),
  toListId: z.string(),
});

export const TaskArchivedSchema = z.object({
  taskId: z.string(),
  archived: z.boolean(),
});

export const TaskDeletedSchema = z.object({
  taskId: z.string(),
});

export const CommentAddedSchema = z.object({
  taskId: z.string(),
  commentId: z.string(),
  text: z.string(),
  authorId: z.string(),
});

export const EventSchemas = {
  TaskCreated: TaskCreatedSchema,
  TaskStatusChanged: TaskStatusChangedSchema,
  TaskRenamed: TaskRenamedSchema,
  TaskDescriptionSet: TaskDescriptionSetSchema,
  TaskAssigned: TaskAssignedSchema,
  TaskMoved: TaskMovedSchema,
  TaskArchived: TaskArchivedSchema,
  TaskDeleted: TaskDeletedSchema,
  CommentAdded: CommentAddedSchema,
} as const;

export type EventType = keyof typeof EventSchemas;
export type TaskCreated = z.infer<typeof TaskCreatedSchema>;
export type TaskStatusChanged = z.infer<typeof TaskStatusChangedSchema>;
export type TaskRenamed = z.infer<typeof TaskRenamedSchema>;
export type TaskDescriptionSet = z.infer<typeof TaskDescriptionSetSchema>;
export type TaskAssigned = z.infer<typeof TaskAssignedSchema>;
export type TaskMoved = z.infer<typeof TaskMovedSchema>;
export type TaskArchived = z.infer<typeof TaskArchivedSchema>;
export type TaskDeleted = z.infer<typeof TaskDeletedSchema>;
export type CommentAdded = z.infer<typeof CommentAddedSchema>;

export function parseEventPayload<T extends EventType>(
  type: T,
  payload: unknown,
): z.infer<(typeof EventSchemas)[T]> {
  return EventSchemas[type].parse(payload) as z.infer<(typeof EventSchemas)[T]>;
}
