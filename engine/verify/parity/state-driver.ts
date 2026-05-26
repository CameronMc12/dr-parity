/**
 * Drive StateCases against the OWNED CQRS backend in-process and produce the
 * real {expectedPostState, actualProjection} pairs the state scorer compares.
 *
 * Why in-process: the owned backend's domain layer (CommandBus + EventStore +
 * TasksProjector + TaskQueries) IS the deterministic backend. Driving it
 * directly removes HTTP/tmux flakiness and gives a clean read-model snapshot →
 * apply command → re-read round-trip exactly as the blueprint specifies. The
 * same domain layer is what the HTTP command API (sibling work) wraps.
 *
 * Round-trip per case:
 *   1. snapshot the read-model (projection for the target task) BEFORE,
 *   2. apply the command through the bus, catch the projector up,
 *   3. re-read the projection AFTER,
 *   4. hand (expectedPostState, actualProjection=after) to the scorer.
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
  type CommandType,
} from '../../targets/webapp/backend/cqrs/index';
import type { StateCase } from './state-avenue';
import type { CommandSpec, StateCaseSet } from './state-cases';

const ACTOR = 'parity-actor';
const WORKSPACE = '90152566819';

export type DrivenStateCases = {
  cases: StateCase[];
  source: 'captured' | 'synthetic';
  notes: string[];
  /** true when the backend domain layer could not be started at all. */
  backendFailed: boolean;
};

type Backend = {
  bus: CommandBus;
  projector: TasksProjector;
  queries: TaskQueries;
  store: EventStore;
};

/** Stand up a fresh, deterministic in-memory CQRS backend. */
function startBackend(): Backend {
  const clock = new DeterministicClock();
  const idGen = new DeterministicIdGen();
  const store = new EventStore(':memory:', clock, idGen);
  const bus = new CommandBus({ store, idGen })
    .register(new CreateTaskHandler({ store, idGen }))
    .register(new SetTaskStatusHandler({ store, idGen }));
  const projector = new TasksProjector(store);
  const queries = new TaskQueries(store);
  return { bus, projector, queries, store };
}

function dispatch(backend: Backend, type: CommandType, payload: unknown): void {
  backend.bus.dispatch({ type, payload, actorId: ACTOR, workspaceId: WORKSPACE });
  backend.projector.catchUp();
}

/** Apply one spec end-to-end and return the scorer's case (expected vs actual). */
function driveSpec(backend: Backend, spec: CommandSpec): StateCase {
  if (spec.command === 'CreateTask') {
    dispatch(backend, 'CreateTask', spec.payload);
    const after = backend.queries.getTask(spec.payload.taskId);
    return {
      command: 'CreateTask',
      streamId: spec.payload.taskId,
      expectedPostState: spec.expect,
      actualProjection: after,
    };
  }
  // SetTaskStatus: ensure the task exists, snapshot pre-status, mutate, re-read.
  dispatch(backend, 'CreateTask', spec.setup);
  const before = backend.queries.getTask(spec.payload.taskId);
  dispatch(backend, 'SetTaskStatus', spec.payload);
  const after = backend.queries.getTask(spec.payload.taskId);
  return {
    command: 'SetTaskStatus',
    streamId: spec.payload.taskId,
    expectedPostState: spec.expect,
    actualProjection: after
      ? { taskId: after.taskId, status: after.status }
      : after,
    // sanity: status must have actually changed away from the seeded value
    note: before && after && before.status === after.status
      ? 'status did not change after SetTaskStatus'
      : undefined,
  };
}

/**
 * Drive the whole case set against the backend. Each case gets its own backend
 * instance so id/clock determinism is per-case and cases never bleed into each
 * other.
 */
export function driveStateCases(caseSet: StateCaseSet): DrivenStateCases {
  const cases: StateCase[] = [];
  const notes = [...caseSet.notes];
  for (const spec of caseSet.specs) {
    let backend: Backend | null = null;
    try {
      backend = startBackend();
      const driven = driveSpec(backend, spec);
      if (driven.note) notes.push(`${driven.command} (${driven.streamId}): ${driven.note}`);
      cases.push(driven);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // A throw here means the command was rejected: that IS a state mismatch.
      const taskId = spec.command === 'CreateTask' ? spec.payload.taskId : spec.payload.taskId;
      cases.push({
        command: spec.command,
        streamId: taskId,
        expectedPostState: spec.expect,
        actualProjection: null,
      });
      notes.push(`${spec.command}: command threw — ${msg}`);
    } finally {
      backend?.store.close();
    }
  }
  return { cases, source: caseSet.source, notes, backendFailed: false };
}
