/**
 * State/data avenue: apply a command against the OWNED CQRS backend, re-read the
 * projection, and score it against the expected post-state.
 *
 * The cases are produced by `state-driver.ts`, which drives the backend's domain
 * layer (CommandBus + EventStore + TasksProjector + TaskQueries) in-process and
 * hands this scorer real {expectedPostState, actualProjection} pairs. Cases are
 * sourced from captured mutating writes when the crawl has them, else synthetic
 * CRUD (see `state-cases.ts`). The avenue only skips when no cases could be
 * built at all (e.g. the backend domain layer failed to start).
 */

import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

/** One state-parity case: apply a command, compare projections. */
export type StateCase = {
  /** Command name, e.g. "CreateTask". */
  command: string;
  /** Optional id for the entity/stream the command targeted. */
  streamId?: string;
  /** Captured/reference post-state projection (source of truth). */
  expectedPostState: unknown;
  /** The candidate backend's projection after applying the command. */
  actualProjection: unknown;
  /** Optional driver note surfaced into the avenue notes. */
  note?: string;
};

export type StateAvenueInput = {
  cases: StateCase[];
  weight: number;
  /** Optional notes carried through to the avenue score (case source, etc.). */
  notes?: string[];
};

const VOLATILE_KEY = /(^|_)(id|token|ts|time|date|updated|created|seq|rev|version)($|_)/i;

/** Deep equality ignoring volatile keys, returning 0..1 over compared leaves. */
function projectionEquality(expected: unknown, actual: unknown): number {
  const leaves = compare(expected, actual);
  return leaves.total > 0 ? leaves.matched / leaves.total : 1;
}

function compare(a: unknown, b: unknown, depth = 0): { matched: number; total: number } {
  if (depth > 10) return { matched: 1, total: 1 };
  if (a === null || a === undefined || typeof a !== 'object') {
    return { matched: a === b ? 1 : 0, total: 1 };
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return { matched: 0, total: 1 };
    let matched = 0;
    let total = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const r = compare(a[i], b[i], depth + 1);
      matched += r.matched;
      total += r.total;
    }
    return total > 0 ? { matched, total } : { matched: 1, total: 1 };
  }
  const objA = a as Record<string, unknown>;
  const objB = (b ?? {}) as Record<string, unknown>;
  let matched = 0;
  let total = 0;
  for (const [k, v] of Object.entries(objA)) {
    if (VOLATILE_KEY.test(k)) continue;
    const r = compare(v, objB[k], depth + 1);
    matched += r.matched;
    total += r.total;
  }
  return total > 0 ? { matched, total } : { matched: 1, total: 1 };
}

export function scoreStateAvenue(input: StateAvenueInput): AvenueScore {
  const { cases, weight, notes = [] } = input;
  if (cases.length === 0) {
    return {
      avenue: 'state',
      score: 0,
      sampleSize: 0,
      gaps: [],
      notes: [...notes, 'no state cases supplied; backend domain layer produced nothing to score'],
      skipped: true,
    };
  }

  const gaps: Gap[] = [];
  let sum = 0;
  for (const c of cases) {
    const eq = projectionEquality(c.expectedPostState, c.actualProjection);
    sum += eq;
    if (eq < 0.99) {
      const missing = c.actualProjection == null;
      gaps.push({
        avenue: 'state',
        label: c.command + (c.streamId ? ` (${c.streamId})` : ''),
        locator: c.streamId ?? c.command,
        reason: missing
          ? 'command produced no projection row (rejected or not persisted)'
          : `projection ${(eq * 100).toFixed(0)}% equal to expected post-state`,
        severity: clampScore((1 - eq) * weight * 100),
      });
    }
  }

  gaps.sort((a, b) => b.severity - a.severity);
  return {
    avenue: 'state',
    score: clampScore((sum / cases.length) * 100),
    sampleSize: cases.length,
    gaps,
    notes,
    skipped: false,
  };
}

/**
 * High-level entry: build the case set from the crawl (captured or synthetic),
 * drive the owned CQRS backend in-process, then score. This is what the tracking
 * orchestrator calls. Skips gracefully only when no cases could be produced.
 */
export async function scoreStateAvenueFromCrawl(opts: {
  crawlDir: string | null;
  weight: number;
}): Promise<AvenueScore> {
  const { buildStateCaseSet } = await import('./state-cases');
  const { driveStateCases } = await import('./state-driver');
  const caseSet = await buildStateCaseSet(opts.crawlDir);
  const driven = driveStateCases(caseSet);
  const sourceNote = `state cases sourced: ${driven.source} (${driven.cases.length} case(s))`;
  return scoreStateAvenue({
    cases: driven.cases,
    weight: opts.weight,
    notes: [sourceNote, ...driven.notes],
  });
}
