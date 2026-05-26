import { z } from "zod";

// Command registry. Imperative intent. One Zod schema per command validates the
// payload at the bus boundary before any handler runs.

export const CreateTaskSchema = z.object({
  listId: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1).default("open"),
  taskId: z.string().optional(),
});

export const SetTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1),
});

export const CommandSchemas = {
  CreateTask: CreateTaskSchema,
  SetTaskStatus: SetTaskStatusSchema,
} as const;

export type CommandType = keyof typeof CommandSchemas;
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;
export type SetTaskStatusInput = z.input<typeof SetTaskStatusSchema>;

export interface Command<T extends CommandType = CommandType> {
  type: T;
  payload: unknown;
  actorId: string;
  workspaceId: string;
  /** Optional idempotency key; same key + workspace returns the prior result. */
  idempotencyKey?: string;
  correlationId?: string;
}
