/**
 * End-to-end proof of the owned CQRS + event-sourcing core.
 *
 * Proves four properties:
 *   1. APPEND  — commands produce events in the append-only store.
 *   2. PROJECT — the TasksProjector builds a queryable `tasks` read table.
 *   3. IDEMPOTENT — CreateTask twice with the same key => exactly one TaskCreated.
 *   4. REPLAY-SAFE — dropping the projection + replaying the event log
 *      reproduces an identical read model.
 *
 * Runtime is deterministic: a seeded Clock + IdGen mean the same command
 * sequence always yields the same event ids and timestamps.
 */
import {
  EventStore,
  DeterministicClock,
  DeterministicIdGen,
  CommandBus,
  CreateTaskHandler,
  SetTaskStatusHandler,
  TasksProjector,
  TaskQueries,
} from "../engine/targets/webapp/backend/cqrs/index.js";

const WS = "ws_demo";
const ACTOR = "user_demo";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

function snapshotTasks(queries: TaskQueries, listId: string) {
  return queries.listTasks(listId).map((t) => ({
    taskId: t.taskId,
    status: t.status,
    name: t.name,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

function main(): void {
  // In-memory store keeps the demo hermetic and fast.
  const clock = new DeterministicClock();
  const idGen = new DeterministicIdGen();
  const store = new EventStore(":memory:", clock, idGen);

  const bus = new CommandBus({ store, idGen })
    .register(new CreateTaskHandler({ store, idGen }))
    .register(new SetTaskStatusHandler({ store, idGen }));

  const projector = new TasksProjector(store);
  const queries = new TaskQueries(store);

  const LIST = "list_inbox";

  console.log("\n[1] APPEND + PROJECT");
  bus.dispatch({
    type: "CreateTask",
    actorId: ACTOR,
    workspaceId: WS,
    payload: { listId: LIST, name: "Write blueprint", status: "open", taskId: "task_a" },
  });
  bus.dispatch({
    type: "CreateTask",
    actorId: ACTOR,
    workspaceId: WS,
    payload: { listId: LIST, name: "Ship demo", status: "open", taskId: "task_b" },
  });
  projector.catchUp();

  let tasks = queries.listTasks(LIST);
  assert(tasks.length === 2, "two tasks projected after two CreateTask commands");
  assert(queries.getTask("task_a")?.status === "open", "task_a status is open");

  console.log("\n[2] IDEMPOTENCY");
  const r1 = bus.dispatch({
    type: "CreateTask",
    actorId: ACTOR,
    workspaceId: WS,
    idempotencyKey: "create-task-c",
    payload: { listId: LIST, name: "Idempotent task", status: "open", taskId: "task_c" },
  });
  const r2 = bus.dispatch({
    type: "CreateTask",
    actorId: ACTOR,
    workspaceId: WS,
    idempotencyKey: "create-task-c",
    payload: { listId: LIST, name: "Idempotent task", status: "open", taskId: "task_c" },
  });
  assert(!r1.idempotent && r1.events.length === 1, "first CreateTask appended one event");
  assert(r2.idempotent, "second CreateTask short-circuited via idempotency key");

  const taskCreatedCount = store
    .readAll(0)
    .filter((e) => e.type === "TaskCreated" && (e.payload as { taskId: string }).taskId === "task_c").length;
  assert(taskCreatedCount === 1, "exactly ONE TaskCreated event for task_c despite two dispatches");

  console.log("\n[3] STATE TRANSITION");
  bus.dispatch({
    type: "SetTaskStatus",
    actorId: ACTOR,
    workspaceId: WS,
    payload: { taskId: "task_a", status: "in_progress" },
  });
  bus.dispatch({
    type: "SetTaskStatus",
    actorId: ACTOR,
    workspaceId: WS,
    payload: { taskId: "task_a", status: "done" },
  });
  projector.catchUp();
  assert(queries.getTask("task_a")?.status === "done", "task_a projection updated to done");

  // No redundant event when status is unchanged (invariant in the handler).
  const noop = bus.dispatch({
    type: "SetTaskStatus",
    actorId: ACTOR,
    workspaceId: WS,
    payload: { taskId: "task_a", status: "done" },
  });
  assert(noop.events.length === 0, "setting same status produces no redundant event");

  console.log("\n[4] REPLAY-SAFE REBUILD");
  const before = snapshotTasks(queries, LIST);
  console.log("  read model before rebuild:");
  for (const t of before) console.log(`    ${t.taskId}  ${t.status}  "${t.name}"`);

  const totalEvents = store.readAll(0).length;
  const rebuiltCount = projector.rebuild(); // DROP tasks table + replay full event log
  const after = snapshotTasks(queries, LIST);

  assert(rebuiltCount === totalEvents, `replayed all ${totalEvents} events on rebuild`);
  assert(
    JSON.stringify(before) === JSON.stringify(after),
    "rebuilt read model is byte-identical to pre-drop read model",
  );

  console.log("  read model after rebuild:");
  for (const t of after) console.log(`    ${t.taskId}  ${t.status}  "${t.name}"`);

  console.log("\n[5] EVENT LOG (source of truth)");
  for (const e of store.readAll(0)) {
    console.log(`  #${e.globalSeq} ${e.eventId} ${e.type} @ ${e.occurredAt} :: ${JSON.stringify(e.payload)}`);
  }

  store.close();
  console.log("\n✓ ALL CHECKS PASSED — append + project + idempotency + replay-rebuild verified.\n");
}

main();
