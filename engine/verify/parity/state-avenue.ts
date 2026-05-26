/**
 * State/data avenue: given a command, its expected post-state, and the actual
 * projection the candidate backend produced, score equality.
 *
 * This is a PLACEHOLDER HOOK. The owned CQRS/ES backend does not exist yet, so
 * by default no StateCase inputs are supplied and the avenue is skipped. The
 * interface below is the contract the backend will wire into later: feed it
 * captured CommandObservations (command + captured postState) plus the
 * candidate's projected post-state, and it scores projection equality.
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
};

export type StateAvenueInput = {
  cases: StateCase[];
  weight: number;
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
  const { cases, weight } = input;
  if (cases.length === 0) {
    return {
      avenue: 'state',
      score: 0,
      sampleSize: 0,
      gaps: [],
      notes: ['no state cases supplied; wire the owned backend to enable this avenue'],
      skipped: true,
    };
  }

  const gaps: Gap[] = [];
  let sum = 0;
  for (const c of cases) {
    const eq = projectionEquality(c.expectedPostState, c.actualProjection);
    sum += eq;
    if (eq < 0.99) {
      gaps.push({
        avenue: 'state',
        label: c.command + (c.streamId ? ` (${c.streamId})` : ''),
        locator: c.streamId ?? c.command,
        reason: `projection ${(eq * 100).toFixed(0)}% equal to captured post-state`,
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
    notes: [],
    skipped: false,
  };
}
