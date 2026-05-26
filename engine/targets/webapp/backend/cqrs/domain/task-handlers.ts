import type { EventContext } from "../store/types.js";
import { TASK_STREAM, type TaskCreated, type TaskStatusChanged } from "./events.js";
import { CommandHandler, type Decision } from "./handler.js";

interface TaskState {
  taskId: string;
  listId: string;
  name: string;
  status: string;
}

function foldTask(streamId: string, store: import("../store/event-store.js").EventStore): TaskState | null {
  const loaded = store.loadStream<TaskState>(streamId);
  let state = loaded.snapshotState;
  for (const ev of loaded.events) {
    if (ev.type === "TaskCreated") {
      const p = ev.payload as TaskCreated;
      state = { taskId: p.taskId, listId: p.listId, name: p.name, status: p.status };
    } else if (ev.type === "TaskStatusChanged" && state) {
      state = { ...state, status: (ev.payload as TaskStatusChanged).toStatus };
    }
  }
  return state;
}

export class CreateTaskHandler extends CommandHandler<"CreateTask"> {
  readonly commandType = "CreateTask" as const;

  decide(payload: unknown, _ctx: EventContext): Decision {
    const p = payload as { listId: string; name: string; status: string; taskId?: string };
    const taskId = p.taskId ?? this.deps.idGen.next("task");
    const streamId = `${TASK_STREAM}:${taskId}`;
    const headSeq = this.deps.store.headSeq(streamId);
    if (headSeq > 0) {
      // Stream already exists; treat as a no-op create (caller should use idempotency).
      return { streamId, expectedSeq: headSeq, events: [] };
    }
    const event: TaskCreated = { taskId, listId: p.listId, name: p.name, status: p.status };
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
    const streamId = `${TASK_STREAM}:${p.taskId}`;
    const headSeq = this.deps.store.headSeq(streamId);
    const state = foldTask(streamId, this.deps.store);
    if (!state) {
      throw new Error(`Cannot set status: task "${p.taskId}" does not exist`);
    }
    if (state.status === p.status) {
      return { streamId, expectedSeq: headSeq, events: [] }; // invariant: no redundant event
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
