/**
 * Pure day-axis + scheduled-load math for the Workload view.
 *
 * The grid is assignee rows × day columns. Days are built around the fixed
 * ANCHOR_NOW so layout is identical on server and client. Each task resolves to
 * a span via `deriveSpan` and contributes its scheduled hours to every assignee
 * on the task, for every day its span overlaps. Hours come from `timeEstimate`
 * (minutes → hours); the seed corpus carries no estimates, so a DETERMINISTIC
 * synthetic estimate (hashed off the task id, like deriveSpan) is layered on so
 * the lanes read as a real ClickUp Workload rather than a wall of "0h".
 *
 * Nothing here touches React — all stable, memo-friendly derivation.
 */

import {
  ANCHOR_NOW,
  DAY_MS,
  deriveSpan,
  startOfDay,
  type Task,
} from '@/lib/view-data';
import type { Member } from '@/store/workspace/types';
import {
  DAYS_BEFORE_ANCHOR,
  HOURS_PER_TASK_UNIT,
  type WorkloadMetric,
  type WorkloadRangeDays,
} from './tokens';

/** Synthetic lane id for tasks with no assignee. */
export const UNASSIGNED_ID = '__wl_unassigned__';

const DOW_SHORT: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS_SHORT: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** One day column. */
export interface Day {
  /** Local-midnight start. */
  start: number;
  /** Local-midnight end (23:59:59.999). */
  end: number;
  /** Single-letter weekday, e.g. "M". */
  dow: string;
  /** Day-of-month number, e.g. 31. */
  dom: number;
  /** True when ANCHOR_NOW falls on this day. */
  isToday: boolean;
  /** Saturday / Sunday → subtle hatch. */
  isWeekend: boolean;
}

/** A row of the grid: one member (or the synthetic Unassigned lane). */
export interface Lane {
  id: string;
  name: string;
  initials: string;
  color: string;
  unassigned: boolean;
}

/** Pretty "May 31 – Jun 6" label spanning the current visible window. */
export function rangeLabel(days: Day[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  const s = new Date(first.start);
  const e = new Date(last.start);
  const left = `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}`;
  const right =
    s.getMonth() === e.getMonth()
      ? `${e.getDate()}`
      : `${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}`;
  return `${left} – ${right}`;
}

/** A contiguous run of days that share a month, for the month-name strip. */
export interface MonthSegment {
  /** "May 2026" for the first segment, "June" for subsequent same-year runs. */
  label: string;
  /** Number of day columns this month spans within the visible window. */
  span: number;
}

const MONTHS_LONG: string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Group the day axis into month runs for the strip above the day ticks. The
 * first run carries its year ("May 2026"); later runs drop the year unless the
 * year itself changes ("June", then "January 2027").
 */
export function monthSegments(days: Day[]): MonthSegment[] {
  interface Run extends MonthSegment {
    month: number;
    year: number;
  }
  const runs: Run[] = [];
  let prevYear = -1;
  for (const day of days) {
    const d = new Date(day.start);
    const month = d.getMonth();
    const year = d.getFullYear();
    const last = runs[runs.length - 1];
    if (last && last.month === month && last.year === year) {
      last.span += 1;
      continue;
    }
    const withYear = runs.length === 0 || year !== prevYear;
    runs.push({
      label: withYear ? `${MONTHS_LONG[month]} ${year}` : `${MONTHS_LONG[month]}`,
      span: 1,
      month,
      year,
    });
    prevYear = year;
  }
  return runs.map(({ label, span }) => ({ label, span }));
}

/**
 * Build the day axis: `count` consecutive day columns starting `offset` days
 * before ANCHOR_NOW. `offset` clamps so today sits a column or two in.
 */
export function buildDays(
  range: WorkloadRangeDays,
  windowStart: number,
): Day[] {
  const days: Day[] = [];
  for (let i = 0; i < range; i += 1) {
    const start = windowStart + i * DAY_MS;
    const d = new Date(start);
    const dow = d.getDay();
    days.push({
      start,
      end: start + DAY_MS - 1,
      dow: DOW_SHORT[dow] as string,
      dom: d.getDate(),
      isToday: ANCHOR_NOW >= start && ANCHOR_NOW <= start + DAY_MS - 1,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

/** Default window start: `DAYS_BEFORE_ANCHOR` days before today, at midnight. */
export function defaultWindowStart(): number {
  return startOfDay(ANCHOR_NOW) - DAYS_BEFORE_ANCHOR * DAY_MS;
}

/** Shift a window start by whole weeks (for the range < / > stepper). */
export function shiftWindow(windowStart: number, deltaWeeks: number): number {
  return windowStart + deltaWeeks * 7 * DAY_MS;
}

/**
 * Build the ordered lane list: every member, then the Unassigned lane (only when
 * at least one task is unassigned). Members keep store order.
 */
export function buildLanes(members: Member[], tasks: Task[]): Lane[] {
  const lanes: Lane[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    initials: m.initials,
    color: m.color,
    unassigned: false,
  }));
  if (tasks.some((t) => t.assignees.length === 0)) {
    lanes.push({
      id: UNASSIGNED_ID,
      name: 'Unassigned',
      initials: '?',
      color: 'var(--cu-text-muted)',
      unassigned: true,
    });
  }
  return lanes;
}

/** djb2 hash → unsigned 32-bit int. Mirrors view-dates for reproducibility. */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i += 1) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * How a task's load is spread across the days of its span.
 *
 *   - 'Daily Scheduled' → the estimate is divided evenly across each day, so a
 *     cell reads the task's per-day slice (ClickUp default; respects capacity).
 *   - 'Total Scheduled' → the FULL estimate lands on every overlapping day, so
 *     each day reads the task's whole weight regardless of span length.
 */
export type ScheduleMode = 'Daily Scheduled' | 'Total Scheduled';

/**
 * Scheduled hours a task contributes per DAY of its span, under a given metric
 * and schedule mode.
 *
 *   - time   → timeEstimate (minutes) ÷ 60.
 *   - tasks  → a flat unit weight per day (count-as-load proxy).
 *   - points → a deterministic 1-3 "points" weight per day from the id hash.
 *
 * 'Daily Scheduled' divides the total by the span day count; 'Total Scheduled'
 * applies the full per-task total to every day in the span. When `timeEstimate`
 * is absent under the time metric we synthesise a stable 2-6h total from the id
 * hash so date-starved seed data still charts.
 */
export function hoursPerDayFor(
  task: Task,
  metric: WorkloadMetric,
  spanDays: number,
  scheduleMode: ScheduleMode,
): number {
  const divisor = scheduleMode === 'Total Scheduled' ? 1 : Math.max(1, spanDays);
  if (metric === 'tasks') return HOURS_PER_TASK_UNIT;
  if (metric === 'points') {
    const total = 1 + (hashId(task.id) % 3); // 1..3 total
    return total / divisor;
  }
  const estMinutes =
    typeof task.timeEstimate === 'number' && task.timeEstimate > 0
      ? task.timeEstimate
      : (2 + (hashId(task.id) % 5)) * 60; // synthetic 2..6h total
  return estMinutes / 60 / divisor;
}

/** Distribution result: per lane, per day, scheduled hours + the day's tasks. */
export interface WorkloadMatrix {
  /** `hours[laneId][dayIndex]` → summed scheduled hours in that cell. */
  hours: Map<string, number[]>;
  /** `tasksByCell[laneId][dayIndex]` → the tasks overlapping that cell. */
  tasksByCell: Map<string, Task[][]>;
  /** Per-lane total scheduled hours across the visible window. */
  laneTotals: Map<string, number>;
  /** Members (by id) who have zero scheduled load in the window. */
  emptyLaneIds: Set<string>;
}

const EPSILON = 0.0001;

/** True when a task has no real start/due dates (an unscheduled "backlog" item). */
export function isBacklogTask(task: Task): boolean {
  return deriveSpan(task).real === false;
}

/**
 * Distribute task hours across the lane × day grid. A task with N assignees lands
 * in N lanes; a task spanning M days contributes hours to each of those M days.
 * Unassigned tasks go to the Unassigned lane. Pure — keyed on
 * (tasks, lanes, days, metric, scheduleMode, includeBacklog).
 *
 * `scheduleMode` controls per-day spreading (see `hoursPerDayFor`).
 * `includeBacklog === false` drops unscheduled tasks (no real dates) so the grid
 * charts only committed work; `true` keeps them on their synthesised span.
 */
export function buildMatrix(
  tasks: Task[],
  lanes: Lane[],
  days: Day[],
  metric: WorkloadMetric,
  scheduleMode: ScheduleMode,
  includeBacklog: boolean,
): WorkloadMatrix {
  const hours = new Map<string, number[]>();
  const tasksByCell = new Map<string, Task[][]>();
  for (const lane of lanes) {
    hours.set(lane.id, days.map(() => 0));
    tasksByCell.set(lane.id, days.map(() => []));
  }

  const laneIds = new Set(lanes.map((l) => l.id));

  for (const task of tasks) {
    const span = deriveSpan(task);
    if (!includeBacklog && span.real === false) continue;
    const spanDayCount =
      Math.floor((startOfDay(span.end) - startOfDay(span.start)) / DAY_MS) + 1;
    const perDay = hoursPerDayFor(task, metric, spanDayCount, scheduleMode);

    const targetLaneIds =
      task.assignees.length > 0
        ? task.assignees.map((a) => a.id).filter((id) => laneIds.has(id))
        : laneIds.has(UNASSIGNED_ID)
          ? [UNASSIGNED_ID]
          : [];

    for (const laneId of targetLaneIds) {
      const laneHours = hours.get(laneId);
      const laneTasks = tasksByCell.get(laneId);
      if (!laneHours || !laneTasks) continue;
      for (let i = 0; i < days.length; i += 1) {
        const day = days[i];
        if (!day) continue;
        if (span.start <= day.end && span.end >= day.start) {
          laneHours[i] = (laneHours[i] ?? 0) + perDay;
          laneTasks[i]?.push(task);
        }
      }
    }
  }

  const laneTotals = new Map<string, number>();
  const emptyLaneIds = new Set<string>();
  for (const lane of lanes) {
    const laneHours = hours.get(lane.id) ?? [];
    const total = laneHours.reduce((a, b) => a + b, 0);
    laneTotals.set(lane.id, total);
    if (total < EPSILON) emptyLaneIds.add(lane.id);
  }

  return { hours, tasksByCell, laneTotals, emptyLaneIds };
}

/** The four side-panel buckets ClickUp surfaces beside the workload grid. */
export type PanelTab = 'Unscheduled' | 'No estimate' | 'Overdue' | 'Unassigned';

export const PANEL_TABS: readonly PanelTab[] = [
  'Unscheduled',
  'No estimate',
  'Overdue',
  'Unassigned',
];

/**
 * Bucket a task list into the four panel tabs. A task can appear in several
 * buckets at once (e.g. unscheduled AND unassigned) — ClickUp shows it under
 * whichever tab is active. Pure; safe to memoise on `tasks`.
 *
 *   - Unscheduled → no real start/due dates (deriveSpan.real === false).
 *   - No estimate → no positive timeEstimate.
 *   - Overdue     → a real due date that falls before ANCHOR_NOW and is open.
 *   - Unassigned  → zero assignees.
 */
export function bucketPanelTasks(tasks: Task[]): Record<PanelTab, Task[]> {
  const buckets: Record<PanelTab, Task[]> = {
    Unscheduled: [],
    'No estimate': [],
    Overdue: [],
    Unassigned: [],
  };
  for (const task of tasks) {
    if (deriveSpan(task).real === false) buckets.Unscheduled.push(task);
    if (!(typeof task.timeEstimate === 'number' && task.timeEstimate > 0)) {
      buckets['No estimate'].push(task);
    }
    if (
      typeof task.dueDate === 'number' &&
      task.dueDate < ANCHOR_NOW &&
      !isClosedStatus(task)
    ) {
      buckets.Overdue.push(task);
    }
    if (task.assignees.length === 0) buckets.Unassigned.push(task);
  }
  return buckets;
}

/** True when a task's status reads as closed/done (so it can't be "overdue"). */
function isClosedStatus(task: Task): boolean {
  const s = task.status.toLowerCase();
  return s === 'closed' || s === 'done' || s === 'complete';
}

/** Sort keys offered by the panel's "Sort by" dropdown. */
export type PanelSort = 'Status' | 'Name' | 'Due date';

export const PANEL_SORTS: readonly PanelSort[] = ['Status', 'Name', 'Due date'];

/** Stable, non-mutating sort of a panel bucket by the chosen key + direction. */
export function sortPanelTasks(
  tasks: Task[],
  sort: PanelSort,
  asc: boolean,
): Task[] {
  const dir = asc ? 1 : -1;
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (sort === 'Name') return dir * a.name.localeCompare(b.name);
    if (sort === 'Due date') {
      return dir * ((a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
    }
    return dir * a.status.localeCompare(b.status);
  });
  return copy;
}

/** Format scheduled hours as a compact ClickUp-style "Nh" / "N.5h" pill label. */
export function formatHours(value: number, metric: WorkloadMetric): string {
  if (metric === 'tasks') {
    const n = Math.round(value);
    return `${n}`;
  }
  if (metric === 'points') {
    return `${Math.round(value)}`;
  }
  if (value < EPSILON) return '0h';
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`;
}
