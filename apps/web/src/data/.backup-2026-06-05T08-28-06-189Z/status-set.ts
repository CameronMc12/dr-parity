/**
 * Per-list status SET model. ClickUp renders every status a list DEFINES as a
 * board column / list group / table band — including empty ones — in a fixed
 * order. Our task data only knows the statuses that happen to sit on a task, so
 * empty statuses never appeared. This module supplies the authoritative ordered
 * status set per list.
 *
 * Real sets (e.g. Project 1) are transcribed from the captured Board DOM at
 * docs/research/clickup-parity/board/dom.html — its four columns render in DOM
 * order TO DO → IN PROGRESS → TEST → COMPLETE with cu-status-open (grey),
 * cu-status-azure (blue), cu-status-azure (blue), cu-status-green respectively.
 * Lists without an explicit set fall back to the standard ClickUp defaults so
 * every board still shows a full set of columns.
 */

import { statusOrder } from './status-order';

/** A single status a list defines, whether or not a task currently uses it. */
export interface StatusDef {
  /** Stable id (`<listId>:<slug>` for seeded sets, `derived:<slug>` otherwise). */
  id: string;
  /** Display label, lower-case to match the task `status` strings. */
  label: string;
  /** Dot/indicator colour (hex). */
  color: string;
  /** ClickUp status category. */
  type: 'not_started' | 'active' | 'done' | 'closed';
  /** Render order, ascending. */
  orderIndex: number;
}

/** Map a status category to the legacy `statusType` string tasks carry. */
export function statusTypeForDefType(type: StatusDef['type']): string {
  switch (type) {
    case 'not_started':
      return 'open';
    case 'active':
      return 'custom';
    case 'done':
      return 'done';
    case 'closed':
      return 'closed';
  }
}

const STD_GREY = '#87909e';
const STD_BLUE = '#1090e0';
const STD_GREEN = '#6bc950';

/**
 * Standard ClickUp default statuses, used to pad any list that has no explicit
 * set so a board always shows To do / In progress / Complete at minimum.
 */
export const DEFAULT_STATUS_LABELS = ['to do', 'in progress', 'complete'] as const;

function defaultStatusDef(label: string, listId: string, orderIndex: number): StatusDef {
  const lower = label.toLowerCase();
  const isDone = lower === 'complete';
  const isStart = statusOrder(lower) === 0;
  return {
    id: `${listId}:${slug(lower)}`,
    label: lower,
    color: isDone ? STD_GREEN : isStart ? STD_GREY : STD_BLUE,
    type: isDone ? 'done' : isStart ? 'not_started' : 'active',
    orderIndex,
  };
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Project 1 (listId 901523542898) — exact captured set, in DOM column order.
 * TO DO grey/not_started, IN PROGRESS blue/active, TEST blue/active,
 * COMPLETE green/done.
 */
const PROJECT_1_LIST_ID = '901523542898';
const PROJECT_1_STATUSES: StatusDef[] = [
  { id: `${PROJECT_1_LIST_ID}:to-do`, label: 'to do', color: STD_GREY, type: 'not_started', orderIndex: 0 },
  { id: `${PROJECT_1_LIST_ID}:in-progress`, label: 'in progress', color: STD_BLUE, type: 'active', orderIndex: 1 },
  { id: `${PROJECT_1_LIST_ID}:test`, label: 'test', color: STD_BLUE, type: 'active', orderIndex: 2 },
  { id: `${PROJECT_1_LIST_ID}:complete`, label: 'complete', color: STD_GREEN, type: 'done', orderIndex: 3 },
];

/** Explicit, transcribed status sets keyed by listId. */
export const SEEDED_STATUS_SETS: Record<string, StatusDef[]> = {
  [PROJECT_1_LIST_ID]: PROJECT_1_STATUSES,
};

interface DerivedStatus {
  label: string;
  color: string;
  statusType: string;
}

/**
 * Bucket a raw `statusType` string into a StatusDef category.
 * Falls back to orderindex 0 ⇒ not_started for unknown labels.
 */
function categorise(label: string, statusType: string): StatusDef['type'] {
  const t = statusType.toLowerCase();
  if (t === 'closed') return 'closed';
  if (t === 'done') return 'done';
  if (statusOrder(label) === 0) return 'not_started';
  return 'active';
}

/**
 * Derive a list's status set from the statuses present on its tasks PLUS the
 * standard ClickUp defaults, so every list shows a full board even when sparse.
 * Pure: takes the distinct statuses observed and returns ordered StatusDefs.
 *
 * `observed` must be deduplicated by label upstream (cheap Map build) so this
 * stays O(n) and produces a stable ordering.
 */
export function deriveStatusDefs(listId: string, observed: DerivedStatus[]): StatusDef[] {
  const byLabel = new Map<string, StatusDef>();

  for (const o of observed) {
    const label = o.label.toLowerCase();
    if (byLabel.has(label)) continue;
    byLabel.set(label, {
      id: `${listId}:${slug(label)}`,
      label,
      color: o.color || STD_GREY,
      type: categorise(label, o.statusType),
      orderIndex: 0,
    });
  }

  // Pad with the standard defaults so a sparse list still shows a full board.
  DEFAULT_STATUS_LABELS.forEach((label, i) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, defaultStatusDef(label, listId, i));
    }
  });

  return orderDerivedStatusDefs([...byLabel.values()]);
}

/**
 * Sort StatusDefs by their explicit `orderIndex`, with done/closed pinned to the
 * bottom (ClickUp always parks terminal statuses last regardless of declared
 * order). Re-stamps a dense 0-based `orderIndex` so callers can rely on it.
 * Used for SEEDED sets where the captured DOM order is authoritative.
 */
export function orderStatusDefs(defs: StatusDef[]): StatusDef[] {
  const sorted = [...defs].sort((a, b) => {
    const at = a.type === 'done' || a.type === 'closed' ? 1 : 0;
    const bt = b.type === 'done' || b.type === 'closed' ? 1 : 0;
    if (at !== bt) return at - bt;
    return a.orderIndex - b.orderIndex;
  });
  return sorted.map((d, i) => ({ ...d, orderIndex: i }));
}

/**
 * Sort DERIVED StatusDefs into ClickUp's canonical order: not-started first,
 * then active by orderindex rank, with done/closed pinned to the bottom; ties
 * broken by label. Used when a list has no explicit captured set.
 */
function orderDerivedStatusDefs(defs: StatusDef[]): StatusDef[] {
  const sorted = [...defs].sort((a, b) => {
    const at = a.type === 'done' || a.type === 'closed' ? 1 : 0;
    const bt = b.type === 'done' || b.type === 'closed' ? 1 : 0;
    if (at !== bt) return at - bt;
    const cmp = statusOrder(a.label) - statusOrder(b.label);
    if (cmp !== 0) return cmp;
    return a.label.localeCompare(b.label);
  });
  return sorted.map((d, i) => ({ ...d, orderIndex: i }));
}
