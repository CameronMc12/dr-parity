/**
 * Per-status orderindex extracted from the real ClickUp export
 * (docs/research/clickup-export/2026-05-25T16-21-00-615Z/folders.json + lists.json).
 *
 * ClickUp's List view renders status groups by DESCENDING orderindex with
 * done/closed buckets pinned to the bottom — e.g. AB Content Management shows
 * analyzing(3), running(2), drafting(1), Open(0), then complete(closed). The
 * map below lets `groupByStatus` reproduce that exact order from each task's
 * status string alone.
 */
export const STATUS_ORDER: Record<string, number> = {
  'to do': 0,
  open: 0,
  considering: 1,
  drafting: 1,
  'in design': 1,
  'in development': 1,
  'in progress': 1,
  testing: 1,
  triage: 1,
  'waiting for client': 1,
  'in review': 2,
  'need info': 2,
  running: 2,
  scoping: 2,
  analyzing: 3,
  'awaiting prioritization': 3,
  deployed: 3,
  fail: 3,
  prioritized: 3,
  'ready for testing': 3,
  complete: 4,
  pass: 4,
  skip: 5,
  'cannot reproduce': 6,
  'in review-high': 6,
  'not a bug': 7,
  'not doing': 8,
  'ready for deployment': 8,
  closed: 9,
};

/** orderindex for a status name (case-insensitive). Unknown → 0. */
export function statusOrder(status: string): number {
  return STATUS_ORDER[status.toLowerCase()] ?? 0;
}
