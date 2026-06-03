/**
 * Date helpers shared by the Calendar and Gantt views.
 *
 * The seed corpus is date-starved: only 15/198 tasks carry a dueDate and 9 a
 * startDate, so a purely real-date Calendar/Gantt would render almost nothing.
 * To keep those views meaningful we layer a DETERMINISTIC fallback span on top
 * of the real data:
 *
 *   - Real dates always win. If a task has startDate and/or dueDate they are
 *     used verbatim (a missing endpoint is filled from the present one).
 *   - When a task has no dates, `deriveSpan` synthesises a stable span from a
 *     hash of the task id, anchored to ANCHOR_NOW. The same id always yields the
 *     same span, so renders are reproducible across reloads and SSR/CSR.
 *
 * All epoch values are integer milliseconds (matching the Task date fields).
 */

import type { Task } from '@/store/workspace/types';

export const DAY_MS = 86_400_000;

/**
 * Fixed "today" anchor for deterministic derivation. Pinned (not Date.now()) so
 * synthesised spans are identical on server and client and never drift between
 * renders. 2026-06-02T00:00:00.000Z.
 */
export const ANCHOR_NOW = 1_780_358_400_000;

/** A resolved [start, end] span in epoch ms, always start <= end. */
export interface TaskSpan {
  start: number;
  end: number;
  /** True when at least one endpoint came from real task data. */
  real: boolean;
}

/** djb2 string hash → unsigned 32-bit int. Stable and fast. */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i += 1) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Strip a span back to local midnight (calendar grids compare whole days). */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Resolve a task to a renderable span. Real start/dueDate take precedence; a
 * dateless task gets a deterministic 1-7 day span placed within ±21 days of the
 * anchor, derived from its id hash.
 */
export function deriveSpan(task: Task): TaskSpan {
  const hasStart = typeof task.startDate === 'number';
  const hasDue = typeof task.dueDate === 'number';

  if (hasStart || hasDue) {
    const start = (task.startDate ?? task.dueDate) as number;
    const end = (task.dueDate ?? task.startDate) as number;
    return start <= end
      ? { start, end, real: true }
      : { start: end, end: start, real: true };
  }

  const h = hashId(task.id);
  const offsetDays = (h % 43) - 21; // -21 .. +21
  const durationDays = (h >> 6) % 7; // 0 .. 6
  const start = ANCHOR_NOW + offsetDays * DAY_MS;
  const end = start + durationDays * DAY_MS;
  return { start, end, real: false };
}

/** Inclusive list of local-midnight day timestamps a span touches. */
export function daysInSpan(span: TaskSpan): number[] {
  const first = startOfDay(span.start);
  const last = startOfDay(span.end);
  const days: number[] = [];
  for (let d = first; d <= last; d += DAY_MS) days.push(d);
  return days;
}

export interface MonthRange {
  /** Local-midnight timestamp of the 1st of the month. */
  monthStart: number;
  /** Local-midnight timestamp of the last day of the month. */
  monthEnd: number;
  /** 6×7 grid of local-midnight day timestamps (Sunday-led, ClickUp default). */
  weeks: number[][];
}

/**
 * Build a Sunday-led 6-week calendar grid for the month containing `anchorMs`.
 * Days from adjacent months fill the leading/trailing cells.
 */
export function monthRange(anchorMs: number): MonthRange {
  const d = new Date(anchorMs);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();

  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const weeks: number[][] = [];
  let cursor = startOfDay(gridStart.getTime());
  for (let w = 0; w < 6; w += 1) {
    const week: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor += DAY_MS;
    }
    weeks.push(week);
  }
  return { monthStart, monthEnd: endOfDay(monthEnd), weeks };
}

/** Clamp a span to [min, max] (both epoch ms). Returns null if fully outside. */
export function clampSpan(
  span: TaskSpan,
  min: number,
  max: number,
): TaskSpan | null {
  const start = Math.max(span.start, min);
  const end = Math.min(span.end, max);
  if (start > end) return null;
  return { start, end, real: span.real };
}

/** True if a span overlaps a single day (local-midnight timestamp). */
export function spanTouchesDay(span: TaskSpan, dayMs: number): boolean {
  return span.start <= endOfDay(dayMs) && span.end >= startOfDay(dayMs);
}
