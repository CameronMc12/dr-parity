import type { EventContext } from "../store/types.js";
import type { EventStore } from "../store/event-store.js";
import {
  TASK_STREAM,
  type TaskAssigned,
  type TaskCreated,
  type TaskDescriptionSet,
  type TaskMoved,
  type TaskRenamed,
  type TaskStatusChanged,
} from "./events.js";
import { CommandHandler, type Decision } from "./handler.js";

export interface TaskState {
  taskId: string;
  listId: string;
  name: string;
  status: string;
  description: string | null;
  assigneeIds: number[];
  archived: boolean;
  deleted: boolean;
}

/** Fold a task stream into current state. Replay-safe (pure over the event log). */
export function foldTask(streamId: string, store: EventStore): TaskState | null {
  const loaded = store.loadStream<TaskState>(streamId);
  let state = loaded.snapshotState;
  for (const ev of loaded.events) {
    switch (ev.type) {
      case "TaskCreated": {
        const p = ev.payload as TaskCreated;
        state = {
          taskId: p.taskId,
          listId: p.listId,
          name: p.name,
          status: p.status,
          description: p.description ?? null,
          assigneeIds: [],
          archived: false,
          deleted: false,
        };
        break;
      }
      case "TaskStatusChanged":
        if (state) state = { ...state, status: (ev.payload as TaskStatusChanged).toStatus };
        break;
      case "TaskRenamed":
        if (state) state = { ...state, name: (ev.payload as TaskRenamed).toName };
        break;
      case "TaskDescriptionSet":
        if (state)
          state = { ...state, description: (ev.payload as TaskDescriptionSet).description };
        break;
      case "TaskAssigned": {
        if (!state) break;
        const id = (ev.payload as TaskAssigned).assigneeId;
        if (!state.assigneeIds.includes(id))
          state = { ...state, assigneeIds: [...state.assigneeIds, id] };
        break;
      }
      case "TaskMoved":
        if (state) state = { ...state, listId: (ev.payload as TaskMoved).toListId };
        break;
      case "TaskArchived":
        if (state) state = { ...state, archived: (ev.payload as { archived: boolean }).archived };
        break;
      case "TaskDeleted":
        if (state) state = { ...state, deleted: true };
        break;
      default:
        break;
    }
  }
  return state;
}

function streamFor(taskId: string): string {
  return `${TASK_STREAM}:${taskId}`;
}

function requireTask(streamId: string, store: EventStore, taskId: string): TaskState {
  const state = foldTask(streamId, store);
  if (!state || state.deleted) {
    throw new Error(`Task "${taskId}" does not exist`);
  }
  return state;
}

export class CreateTaskHandler extends CommandHandler<"CreateTask"> {
  readonly commandType = "CreateTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { listId: string; name: string; status: string; description?: string; taskId?: string };
    const taskId = p.taskId ?? this.deps.idGen.next("task");
    const streamId = streamFor(taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    if (headSeq > 0) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    const event: TaskCreated = {
      taskId,
      listId: p.listId,
      name: p.name,
      status: p.status,
      ...(p.description !== undefined ? { description: p.description } : {}),
    };
    return {
      streamId,
      expectedSeq: 0,
      events: [{ streamType: TASK_STREAM, type: "TaskCreated", payload: event }],
    };
  }
}

export class SetTaskStatusHandler extends CommandHandler<"SetTaskStatus"> {
  readonly commandType = "SetTaskStatus" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string; status: string };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = requireTask(streamId, this.deps.store, p.taskId);
    if (state.status === p.status) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    const event: TaskStatusChanged = {
      taskId: p.taskId,
      fromStatus: state.status,
      toStatus: p.status,
    };
    return {
      streamId,
      expectedSeq: headSeq,
      events: [{ streamType: TASK_STREAM, type: "TaskStatusChanged", payload: event }],
    };
  }
}

export class UpdateTaskHandler extends CommandHandler<"UpdateTask"> {
  readonly commandType = "UpdateTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string; name?: string; description?: string };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = requireTask(streamId, this.deps.store, p.taskId);
    const events: Decision["events"] = [];
    if (p.name !== undefined && p.name !== state.name) {
      const ev: TaskRenamed = { taskId: p.taskId, fromName: state.name, toName: p.name };
      events.push({ streamType: TASK_STREAM, type: "TaskRenamed", payload: ev });
    }
    if (p.description !== undefined && p.description !== state.description) {
      const ev: TaskDescriptionSet = { taskId: p.taskId, description: p.description };
      events.push({ streamType: TASK_STREAM, type: "TaskDescriptionSet", payload: ev });
    }
    return { streamId, expectedSeq: headSeq, events };
  }
}

export class AssignTaskHandler extends CommandHandler<"AssignTask"> {
  readonly commandType = "AssignTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string; assigneeId: number };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = requireTask(streamId, this.deps.store, p.taskId);
    if (state.assigneeIds.includes(p.assigneeId)) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    const ev: TaskAssigned = { taskId: p.taskId, assigneeId: p.assigneeId };
    return {
      streamId,
      expectedSeq: headSeq,
      events: [{ streamType: TASK_STREAM, type: "TaskAssigned", payload: ev }],
    };
  }
}

export class MoveTaskHandler extends CommandHandler<"MoveTask"> {
  readonly commandType = "MoveTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string; listId: string };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = requireTask(streamId, this.deps.store, p.taskId);
    if (state.listId === p.listId) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    const ev: TaskMoved = { taskId: p.taskId, fromListId: state.listId, toListId: p.listId };
    return {
      streamId,
      expectedSeq: headSeq,
      events: [{ streamType: TASK_STREAM, type: "TaskMoved", payload: ev }],
    };
  }
}

export class ArchiveTaskHandler extends CommandHandler<"ArchiveTask"> {
  readonly commandType = "ArchiveTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string; archived: boolean };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = requireTask(streamId, this.deps.store, p.taskId);
    if (state.archived === p.archived) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    return {
      streamId,
      expectedSeq: headSeq,
      events: [
        { streamType: TASK_STREAM, type: "TaskArchived", payload: { taskId: p.taskId, archived: p.archived } },
      ],
    };
  }
}

export class DeleteTaskHandler extends CommandHandler<"DeleteTask"> {
  readonly commandType = "DeleteTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { taskId: string };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    const state = foldTask(streamId, this.deps.store);
    if (!state || state.deleted) {
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    return {
      streamId,
      expectedSeq: headSeq,
      events: [{ streamType: TASK_STREAM, type: "TaskDeleted", payload: { taskId: p.taskId } }],
    };
  }
}

export class AddCommentHandler extends CommandHandler<"AddComment"> {
  readonly commandType = "AddComment" as const;

  decide(payload: unknown, ctx: EventContext): Decision {
    const p = payload as { taskId: string; text: string };
    const streamId = streamFor(p.taskId);
    const headSeq = this.deps.store.headSeq(streamId);
    requireTask(streamId, this.deps.store, p.taskId);
    const commentId = this.deps.idGen.next("comment");
    return {
      streamId,
      expectedSeq: headSeq,
      events: [
        {
          streamType: TASK_STREAM,
          type: "CommentAdded",
          payload: { taskId: p.taskId, commentId, text: p.text, authorId: ctx.actorId },
        },
      ],
    };
  }
}
