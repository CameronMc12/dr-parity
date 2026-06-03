/**
 * Pure timeline-axis maths for the Gantt chart. Turns the visible task spans +
 * a zoom level into a day-indexed axis: total width, x-offset for any epoch ms,
 * and the two header rows.
 *
 * Header layout mirrors ClickUp:
 *   - TOP band: week spans ("W22  May 31 – Jun 6") for day/week zoom, or month
 *     spans for month zoom.
 *   - BOTTOM ticks: a cell per day ("Fr 29 / Sa 30 / …") for day/week zoom, or a
 *     cell per week for month zoom.
 *
 * All date helpers come from the shared `@/lib/view-data` layer (deriveSpan,
 * startOfDay, DAY_MS, ANCHOR_NOW) so the Gantt never invents its own dates.
 */

import { ANCHOR_NOW, DAY_MS, deriveSpan, startOfDay } from '@/lib/view-data';
import type { Task, TaskSpan } from '@/lib/view-data';
import { ZOOM_SCALES, type GanttZoom } from './tokens';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface BandCell {
  /** Local-midnight timestamp where this band begins. */
  start: number;
  x: number;
  width: number;
  label: string;
}

export interface DayTick {
  /** Local-midnight timestamp of the day. */
  day: number;
  x: number;
  width: number;
  /** Two-letter weekday label, e.g. "Fr". */
  weekday: string;
  /** Day-of-month number, e.g. 29. */
  date: number;
  weekend: boolean;
  /** True for the ANCHOR_NOW day (renders a red TODAY badge). */
  today: boolean;
}

export interface TimelineAxis {
  origin: number;
  endDay: number;
  dayWidth: number;
  width: number;
  dayCount: number;
  /** Top header band (weeks for day/week zoom, months for month zoom). */
  bands: BandCell[];
  /** Bottom header ticks: a cell per day (day/week) or per week (month). */
  dayTicks: DayTick[];
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

function isWeekend(dayMs: number): boolean {
  const wd = new Date(dayMs).getDay();
  return wd === 0 || wd === 6;
}

/** ISO-week number for the week containing `dayMs`. */
function isoWeek(dayMs: number): number {
  const d = new Date(dayMs);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * DAY_MS));
}

function fmtDay(dayMs: number): string {
  const d = new Date(dayMs);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Top band: one cell per Sunday-led week, labelled "W22  May 31 – Jun 6". */
function buildWeekBands(origin: number, endDay: number, dayWidth: number): BandCell[] {
  const out: BandCell[] = [];
  let cursor = origin - new Date(origin).getDay() * DAY_MS;
  while (cursor <= endDay) {
    const segStart = Math.max(cursor, origin);
    const segEnd = Math.min(endDay + DAY_MS, cursor + 7 * DAY_MS);
    const weekEnd = cursor + 6 * DAY_MS;
    out.push({
      start: segStart,
      x: ((segStart - origin) / DAY_MS) * dayWidth,
      width: ((segEnd - segStart) / DAY_MS) * dayWidth,
      label: `W${isoWeek(cursor)}  ${fmtDay(cursor)} – ${fmtDay(weekEnd)}`,
    });
    cursor += 7 * DAY_MS;
  }
  return out;
}

/** Top band for month zoom: one cell per calendar month. */
function buildMonthBands(origin: number, endDay: number, dayWidth: number): BandCell[] {
  const out: BandCell[] = [];
  let cursor = origin;
  while (cursor <= endDay) {
    const d = new Date(cursor);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const segStart = Math.max(cursor, monthStart);
    const segEnd = Math.min(endDay + DAY_MS, nextMonth);
    out.push({
      start: segStart,
      x: ((segStart - origin) / DAY_MS) * dayWidth,
      width: ((segEnd - segStart) / DAY_MS) * dayWidth,
      label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`,
    });
    cursor = nextMonth;
  }
  return out;
}

/** Bottom ticks for day/week zoom: a cell per day. */
function buildDayTicks(origin: number, endDay: number, dayWidth: number): DayTick[] {
  const today = startOfDay(ANCHOR_NOW);
  const out: DayTick[] = [];
  for (let day = origin; day <= endDay; day += DAY_MS) {
    const d = new Date(day);
    out.push({
      day,
      x: ((day - origin) / DAY_MS) * dayWidth,
      width: dayWidth,
      weekday: WEEKDAY_SHORT[d.getDay()] ?? '',
      date: d.getDate(),
      weekend: isWeekend(day),
      today: day === today,
    });
  }
  return out;
}

/** Bottom ticks for year zoom: a cell per calendar month ("Jan", "Feb", …). */
function buildMonthTicks(origin: number, endDay: number, dayWidth: number): DayTick[] {
  const today = startOfDay(ANCHOR_NOW);
  const out: DayTick[] = [];
  let cursor = origin;
  while (cursor <= endDay) {
    const d = new Date(cursor);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const segStart = Math.max(cursor, monthStart);
    const segEnd = Math.min(endDay + DAY_MS, nextMonth);
    out.push({
      day: segStart,
      x: ((segStart - origin) / DAY_MS) * dayWidth,
      width: ((segEnd - segStart) / DAY_MS) * dayWidth,
      weekday: MONTHS_SHORT[d.getMonth()] ?? '',
      date: 1,
      weekend: false,
      today: today >= monthStart && today < nextMonth,
    });
    cursor = nextMonth;
  }
  return out;
}

/** Bottom ticks for month zoom: a cell per Sunday-led week (week number only). */
function buildWeekTicks(origin: number, endDay: number, dayWidth: number): DayTick[] {
  const today = startOfDay(ANCHOR_NOW);
  const out: DayTick[] = [];
  let cursor = origin - new Date(origin).getDay() * DAY_MS;
  while (cursor <= endDay) {
    const segStart = Math.max(cursor, origin);
    const segEnd = Math.min(endDay + DAY_MS, cursor + 7 * DAY_MS);
    const containsToday = today >= cursor && today < cursor + 7 * DAY_MS;
    out.push({
      day: segStart,
      x: ((segStart - origin) / DAY_MS) * dayWidth,
      width: ((segEnd - segStart) / DAY_MS) * dayWidth,
      weekday: `W${isoWeek(cursor)}`,
      date: new Date(cursor).getDate(),
      weekend: false,
      today: containsToday,
    });
    cursor += 7 * DAY_MS;
  }
  return out;
}

/**
 * Compute the full timeline axis for a set of tasks at a zoom level. The axis
 * spans the earliest span start to the latest span end, padded by the zoom's
 * `padDays`, and always includes ANCHOR_NOW so the "today" line is visible.
 *
 * When `dayWidthOverride` is supplied (Auto fit), it replaces the zoom's
 * `dayWidth` so all spans fit a target width.
 */
export function buildAxis(
  tasks: Task[],
  zoom: GanttZoom,
  dayWidthOverride?: number,
): TimelineAxis {
  const scale = ZOOM_SCALES[zoom];
  const dayWidth = dayWidthOverride ?? scale.dayWidth;
  const padDays = scale.padDays;
  let min = ANCHOR_NOW;
  let max = ANCHOR_NOW;
  for (const t of tasks) {
    const span = deriveSpan(t);
    if (span.start < min) min = span.start;
    if (span.end > max) max = span.end;
  }
  const origin = startOfDay(min) - padDays * DAY_MS;
  const endDay = startOfDay(max) + padDays * DAY_MS;
  const dayCount = Math.round((endDay - origin) / DAY_MS) + 1;
  const width = dayCount * dayWidth;

  const weekendDays: number[] = [];
  for (let day = origin; day <= endDay; day += DAY_MS) {
    if (isWeekend(day)) weekendDays.push(day);
  }

  const bands =
    scale.primary === 'month'
      ? buildMonthBands(origin, endDay, dayWidth)
      : buildWeekBands(origin, endDay, dayWidth);
  const dayTicks =
    scale.secondary === 'month'
      ? buildMonthTicks(origin, endDay, dayWidth)
      : scale.secondary === 'week'
        ? buildWeekTicks(origin, endDay, dayWidth)
        : buildDayTicks(origin, endDay, dayWidth);

  return { origin, endDay, dayWidth, width, dayCount, bands, dayTicks, weekendDays };
}

/**
 * Day width that fits the full data span (plus padding) into `targetWidth` px.
 * Used by the toolbar's "Auto fit" action. Clamped to a sane min/max.
 */
export function autoFitDayWidth(
  tasks: Task[],
  zoom: GanttZoom,
  targetWidth: number,
): number {
  const padDays = ZOOM_SCALES[zoom].padDays;
  let min = ANCHOR_NOW;
  let max = ANCHOR_NOW;
  for (const t of tasks) {
    const span = deriveSpan(t);
    if (span.start < min) min = span.start;
    if (span.end > max) max = span.end;
  }
  const origin = startOfDay(min) - padDays * DAY_MS;
  const endDay = startOfDay(max) + padDays * DAY_MS;
  const dayCount = Math.round((endDay - origin) / DAY_MS) + 1;
  if (dayCount <= 0 || targetWidth <= 0) return ZOOM_SCALES[zoom].dayWidth;
  return Math.max(3, Math.min(80, targetWidth / dayCount));
}

/** Convert a horizontal pixel delta back into a whole-day delta. */
export function pxToDays(axis: TimelineAxis, px: number): number {
  return Math.round(px / axis.dayWidth);
}
