/**
 * Pure date-axis maths for the Timeline view. Turns the visible task spans + a
 * zoom level into a day-indexed axis: total width, x-offset for any epoch ms,
 * and the two header rows (month band + day/week/month ticks).
 *
 * All date helpers come from the shared `@/lib/view-data` layer (deriveSpan,
 * startOfDay, DAY_MS, ANCHOR_NOW) so the Timeline never invents its own dates.
 */

import { ANCHOR_NOW, DAY_MS, deriveSpan, startOfDay } from '@/lib/view-data';
import type { Task, TaskSpan } from '@/lib/view-data';
import { ZOOM_SCALES, type TimelineZoom } from './tokens';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface Tick {
  /** Local-midnight timestamp where this tick begins. */
  start: number;
  /** Pixel x where this tick begins (relative to axis origin). */
  x: number;
  /** Pixel width of this tick. */
  width: number;
  label: string;
}

export interface TimelineAxis {
  /** First day rendered (local-midnight ms). */
  origin: number;
  /** Last day rendered (local-midnight ms). */
  endDay: number;
  /** Width of one day in px (from the active zoom). */
  dayWidth: number;
  /** Total chart width in px. */
  width: number;
  /** Number of whole days on the axis. */
  dayCount: number;
  /** Top header band — one cell per month. */
  months: Tick[];
  /** Bottom header band — day / week / month ticks per zoom. */
  ticks: Tick[];
  /** Local-midnight timestamps that fall on a weekend (Sat/Sun). */
  weekendDays: number[];
}

/** x-offset (px from origin) of an epoch-ms instant on the axis. */
export function xForMs(axis: TimelineAxis, ms: number): number {
  return ((ms - axis.origin) / DAY_MS) * axis.dayWidth;
}

/** Pixel geometry for a span's bar: left x + width (min one day wide). */
export function barRect(axis: TimelineAxis, span: TaskSpan): { x: number; width: number } {
  const startX = xForMs(axis, startOfDay(span.start));
  const endX = xForMs(axis, startOfDay(span.end) + DAY_MS);
  return { x: startX, width: Math.max(axis.dayWidth, endX - startX) };
}

/** Convert a horizontal pixel delta back into a whole-day delta. */
export function pxToDays(axis: TimelineAxis, px: number): number {
  return Math.round(px / axis.dayWidth);
}

function isWeekend(dayMs: number): boolean {
  const wd = new Date(dayMs).getDay();
  return wd === 0 || wd === 6;
}

/** Build the month band (top header row). */
function buildMonths(origin: number, endDay: number, dayWidth: number): Tick[] {
  const out: Tick[] = [];
  let cursor = origin;
  while (cursor <= endDay) {
    const d = new Date(cursor);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const segStart = Math.max(cursor, monthStart);
    const segEnd = Math.min(endDay + DAY_MS, nextMonth);
    const x = ((segStart - origin) / DAY_MS) * dayWidth;
    const width = ((segEnd - segStart) / DAY_MS) * dayWidth;
    out.push({
      start: segStart,
      x,
      width,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    });
    cursor = nextMonth;
  }
  return out;
}

/** Build the secondary tick row (day numbers / week-of / month) per zoom. */
function buildTicks(
  origin: number,
  endDay: number,
  dayWidth: number,
  zoom: TimelineZoom,
): Tick[] {
  const out: Tick[] = [];
  if (zoom === 'day') {
    for (let day = origin; day <= endDay; day += DAY_MS) {
      const d = new Date(day);
      out.push({
        start: day,
        x: ((day - origin) / DAY_MS) * dayWidth,
        width: dayWidth,
        label: String(d.getDate()),
      });
    }
    return out;
  }
  if (zoom === 'week') {
    let cursor = origin - new Date(origin).getDay() * DAY_MS;
    while (cursor <= endDay) {
      const segStart = Math.max(cursor, origin);
      const segEnd = Math.min(endDay + DAY_MS, cursor + 7 * DAY_MS);
      const d = new Date(cursor);
      out.push({
        start: segStart,
        x: ((segStart - origin) / DAY_MS) * dayWidth,
        width: ((segEnd - segStart) / DAY_MS) * dayWidth,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
      cursor += 7 * DAY_MS;
    }
    return out;
  }
  return buildMonths(origin, endDay, dayWidth).map((m) => ({
    ...m,
    // getMonth() is always 0-11 and MONTHS is exhaustive, so this never misses.
    label: MONTHS[new Date(m.start).getMonth()]!,
  }));
}

/** Inclusive min/max local-midnight bounds (ms) of a task set's spans. */
export interface DataBounds {
  min: number;
  max: number;
}

/**
 * Earliest span start and latest span end across a task set, always widened to
 * include ANCHOR_NOW so the "today" line is reachable. Pure; used to seed the
 * scrollable window. Returns local-midnight ms.
 */
export function dataBounds(tasks: Task[]): DataBounds {
  let min = ANCHOR_NOW;
  let max = ANCHOR_NOW;
  for (const t of tasks) {
    const span = deriveSpan(t);
    if (span.start < min) min = span.start;
    if (span.end > max) max = span.end;
  }
  return { min: startOfDay(min), max: startOfDay(max) };
}

/** A scrollable window of whole days, expressed as local-midnight bounds. */
export interface TimelineRange {
  /** First day in the window (local-midnight ms). */
  start: number;
  /** Last day in the window (local-midnight ms). */
  end: number;
}

/**
 * Build the timeline axis for an explicit day window at a zoom level. The window
 * is owned by `useTimelineRange` and grows lazily as the user scrolls, so the
 * axis itself stays a pure projection of `range` → pixels. ANCHOR_NOW is *not*
 * forced into the window here; the range seeding guarantees it is present.
 */
export function buildAxis(range: TimelineRange, zoom: TimelineZoom): TimelineAxis {
  const { dayWidth } = ZOOM_SCALES[zoom];
  const origin = startOfDay(range.start);
  const endDay = startOfDay(range.end);
  const dayCount = Math.round((endDay - origin) / DAY_MS) + 1;
  const width = dayCount * dayWidth;

  const weekendDays: number[] = [];
  for (let day = origin; day <= endDay; day += DAY_MS) {
    if (isWeekend(day)) weekendDays.push(day);
  }

  return {
    origin,
    endDay,
    dayWidth,
    width,
    dayCount,
    months: buildMonths(origin, endDay, dayWidth),
    ticks: buildTicks(origin, endDay, dayWidth, zoom),
    weekendDays,
  };
}
