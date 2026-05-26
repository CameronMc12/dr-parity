import { z } from "zod";

// Command registry. Imperative intent. One Zod schema per command validates the
// payload at the bus boundary before any handler runs.

export const CreateTaskSchema = z.object({
  listId: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1).default("open"),
  description: z.string().optional(),
  taskId: z.string().optional(),
});

export const SetTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1),
});

export const UpdateTaskSchema = z
  .object({
    taskId: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "UpdateTask requires at least one of: name, description",
  });

export const AssignTaskSchema = z.object({
  taskId: z.string().min(1),
  assigneeId: z.number().int(),
});

export const MoveTaskSchema = z.object({
  taskId: z.string().min(1),
  listId: z.string().min(1),
});

export const ArchiveTaskSchema = z.object({
  taskId: z.string().min(1),
  archived: z.boolean().default(true),
});

export const DeleteTaskSchema = z.object({
  taskId: z.string().min(1),
});

export const AddCommentSchema = z.object({
  taskId: z.string().min(1),
  text: z.string().min(1),
});

export const CommandSchemas = {
  CreateTask: CreateTaskSchema,
  SetTaskStatus: SetTaskStatusSchema,
  UpdateTask: UpdateTaskSchema,
  AssignTask: AssignTaskSchema,
  MoveTask: MoveTaskSchema,
  ArchiveTask: ArchiveTaskSchema,
  DeleteTask: DeleteTaskSchema,
  AddComment: AddCommentSchema,
} as const;

export type CommandType = keyof typeof CommandSchemas;
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;
export type SetTaskStatusInput = z.input<typeof SetTaskStatusSchema>;
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>;
export type AssignTaskInput = z.input<typeof AssignTaskSchema>;
export type MoveTaskInput = z.input<typeof MoveTaskSchema>;
export type ArchiveTaskInput = z.input<typeof ArchiveTaskSchema>;
export type DeleteTaskInput = z.input<typeof DeleteTaskSchema>;
export type AddCommentInput = z.input<typeof AddCommentSchema>;

export interface Command<T extends CommandType = CommandType> {
  type: T;
  payload: unknown;
  actorId: string;
  workspaceId: string;
  /** Optional idempotency key; same key + workspace returns the prior result. */
  idempotencyKey?: string;
  correlationId?: string;
}
