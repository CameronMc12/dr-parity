/**
 * Pure chip-placement logic. Maps tasks onto the day cells they occupy and
 * applies a per-cell overflow cap so dense days collapse to "+N more".
 *
 * ClickUp colours chips by task status (`colorTasksBy:"taskStatus"`) and places
 * a task on every day its span covers. We mirror that: a task touching N grid
 * days produces a chip on each of those N cells. Tasks with real dates are
 * flagged via span.real (rendered with a solid stripe; synthesised ones dimmer).
 */

import { DAY_MS, deriveSpan, spanTouchesDay, type Task } from '@/lib/view-data';

const DAY_MS_LOCAL = DAY_MS;

export interface DayChip {
  task: Task;
  /** Local-midnight timestamp of the cell this chip sits on. */
  dayMs: number;
  /** Status colour for the chip background/stripe. */
  color: string;
  /** True when the underlying span came from real task dates. */
  real: boolean;
  /** First grid-day this task touches (left edge of a multi-day run). */
  isSpanStart: boolean;
  /** Last grid-day this task touches (right edge of a multi-day run). */
  isSpanEnd: boolean;
}

export interface DayChipBucket {
  /** Chips that fit within the cap. */
  visible: DayChip[];
  /** All chips for the day (drives the "+N more" popover). */
  all: DayChip[];
  /** Hidden overflow count, 0 when everything fits. */
  overflow: number;
}

/** Map<dayMs, DayChipBucket> for fast per-cell lookup during render. */
export type ChipIndex = Map<number, DayChipBucket>;

function statusColor(task: Task): string {
  return task.statusColor || 'var(--cu-status-open, #87909e)';
}

/**
 * Build a per-day chip index for the visible grid. `gridDays` is the flat list
 * of every cell timestamp (6×7 = 42 for month, 7 for week). `cap` bounds how
 * many chips a single cell shows before collapsing to overflow.
 */
export function buildChipIndex(
  tasks: Task[],
  gridDays: number[],
  cap: number,
): ChipIndex {
  const byDay = new Map<number, DayChip[]>();
  for (const day of gridDays) byDay.set(day, []);

  for (const task of tasks) {
    const span = deriveSpan(task);
    // Only the grid days this span actually touches.
    const touched = gridDays.filter((day) => spanTouchesDay(span, day));
    const firstTouched = touched[0];
    const lastTouched = touched[touched.length - 1];
    if (firstTouched === undefined || lastTouched === undefined) continue;
    // A run's left edge is a real start only when the previous day isn't covered.
    const spanStartsInGrid = !spanTouchesDay(span, firstTouched - DAY_MS_LOCAL);
    const spanEndsInGrid = !spanTouchesDay(span, lastTouched + DAY_MS_LOCAL);

    for (const day of touched) {
      byDay.get(day)?.push({
        task,
        dayMs: day,
        color: statusColor(task),
        real: span.real,
        isSpanStart: day === firstTouched && spanStartsInGrid,
        isSpanEnd: day === lastTouched && spanEndsInGrid,
      });
    }
  }

  const index: ChipIndex = new Map();
  for (const [day, chips] of byDay) {
    const all = sortChips(chips);
    const visible = all.slice(0, cap);
    index.set(day, { visible, all, overflow: Math.max(0, all.length - cap) });
  }
  return index;
}

/** Real-dated tasks float to the top, then a stable order by id. */
function sortChips(chips: DayChip[]): DayChip[] {
  return [...chips].sort((a, b) => {
    if (a.real !== b.real) return a.real ? -1 : 1;
    if (a.task.order !== b.task.order) return a.task.order - b.task.order;
    return a.task.id.localeCompare(b.task.id);
  });
}

/** Cap chips per cell from its height: each chip + gap, minus the day-number row. */
export function chipsPerCell(
  cellHeight: number,
  chipHeight: number,
  chipGap: number,
  reservedTop: number,
): number {
  const usable = cellHeight - reservedTop;
  const per = Math.floor(usable / (chipHeight + chipGap));
  return Math.max(1, per);
}
