import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { loadExport } from "../../replay/bridge/load-export.js";
import { DeterministicClock, DeterministicIdGen } from "./store/clock.js";
import { EventStore } from "./store/event-store.js";
import { TASK_STREAM, type TaskCreated } from "./domain/events.js";
import { TasksProjector } from "./projectors/tasks-projector.js";

export interface SeedEventStoreResult {
  eventsDbPath: string;
  appended: number;
  projected: number;
  lists: number;
}

/**
 * Seed the CQRS event store from a ClickUp export directory by emitting one
 * TaskCreated event per export task, then rebuilding the tasks projection.
 *
 * Deterministic: tasks are sorted by id and appended via a DeterministicClock /
 * DeterministicIdGen, so the same export produces an identical event log every
 * run. Re-seeding the same db is a no-op per task (a stream that already exists
 * is skipped), so the seed is idempotent.
 *
 * `fresh` (default true) deletes the existing db first so a re-seed always
 * reflects the current export with no stale streams.
 */
export function seedEventStore(
  exportDir: string,
  eventsDbPath: string,
  fresh = true,
): SeedEventStoreResult {
  if (fresh && eventsDbPath !== ":memory:") {
    for (const suffix of ["", "-wal", "-shm"]) {
      const f = eventsDbPath + suffix;
      if (existsSync(f)) rmSync(f);
    }
  }
  if (eventsDbPath !== ":memory:") mkdirSync(dirname(eventsDbPath), { recursive: true });

  const data = loadExport(exportDir);
  const clock = new DeterministicClock();
  const idGen = new DeterministicIdGen();
  const store = new EventStore(eventsDbPath, clock, idGen);

  const lists = new Set<string>();
  let appended = 0;

  const sortedTasks = [...data.tasksByList.entries()]
    .flatMap(([listId, tasks]) => tasks.map((t) => ({ listId, task: t })))
    .sort((a, b) => a.task.id.localeCompare(b.task.id));

  for (const { listId, task } of sortedTasks) {
    if (!task.id || !listId) continue;
    const streamId = `${TASK_STREAM}:${task.id}`;
    if (store.headSeq(streamId) > 0) continue; // idempotent
    const payload: TaskCreated = {
      taskId: task.id,
      listId,
      name: task.name ?? "Untitled",
      status: task.status?.status ?? "open",
      ...(task.description ? { description: task.description } : {}),
    };
    store.appendEvents(
      streamId,
      0,
      [{ streamType: TASK_STREAM, type: "TaskCreated", payload }],
      {
        actorId: data.owner ? String(data.owner.id) : "seed",
        workspaceId: data.workspaceId,
        correlationId: "seed",
        causationId: null,
        captureFlowId: "export-seed",
      },
    );
    appended += 1;
    lists.add(listId);
  }

  const projector = new TasksProjector(store);
  const projected = projector.rebuild();
  store.close();

  return { eventsDbPath, appended, projected, lists: lists.size };
}
