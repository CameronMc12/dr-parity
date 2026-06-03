/**
 * Workload-view-local style + capacity constants. Scoped to this folder.
 *
 * No stylesheet — every workload element is styled with inline `style={{}}`
 * objects referencing these tokens (mirrors the List/Gantt convention). Colours
 * resolve to the shared `var(--cu-*)` design tokens.
 *
 * ClickUp Workload is a SCHEDULED-LOAD grid: assignee lanes × day columns, each
 * cell summing the assignees' scheduled hours for that day against a daily
 * capacity baseline. Under/at capacity reads green; over reads red.
 */

/** The load metric the lane cells aggregate. ClickUp default is Time Estimates. */
export type WorkloadMetric = 'time' | 'tasks' | 'points';

/** Day-column span of the visible window. ClickUp ships 1 / 2 weeks etc. */
export type WorkloadRangeDays = 7 | 14 | 28;

export const WL = {
  /** Height of one assignee lane row. */
  rowHeight: 88,
  /** Two-row header (month strip + day ticks). */
  headerHeight: 64,
  /** Month-name strip height (the "May 2026   June" row). */
  monthStripHeight: 26,
  /** Day-tick sub-row height inside the header. */
  dayTickHeight: 38,
  /** Left lane-label column (avatar + name + scheduled total). */
  labelColWidth: 268,
  /** Px width of a single day column. */
  dayColWidth: 116,

  bg: 'var(--cu-bg-app)',
  panelBg: 'var(--cu-bg-sidebar)',
  menuBg: 'var(--cu-bg-menu)',
  inputBg: 'var(--cu-bg-input)',

  gridBorder: 'var(--cu-border-divider)',
  gridBorderStrong: 'var(--cu-border-strong)',

  radiusSm: 'var(--cu-radius-sm)',
  radiusMd: 'var(--cu-radius-md)',
  radiusFull: 'var(--cu-radius-full)',

  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  accent: 'var(--cu-accent)',
  indigo: 'var(--cu-indigo)',
  indigoText: 'var(--cu-indigo-text)',

  hover: 'var(--cu-bg-hover)',
  /** Subtle weekend hatch overlaid on day columns. */
  weekendHatch:
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0, rgba(255,255,255,0.018) 6px, transparent 6px, transparent 12px)',
  todayLine: 'var(--cu-status-red)',
  todayTint: 'rgba(210, 30, 36, 0.06)',

  /** Capacity-pill fills (green normal, red over). */
  pillUnderBg: 'rgba(44, 140, 94, 0.16)',
  pillUnderText: 'rgb(86, 196, 142)',
  pillOverBg: 'rgba(210, 30, 36, 0.18)',
  pillOverText: 'rgb(236, 110, 104)',
  pillEmptyText: 'var(--cu-text-muted)',

  /** Right "Tasks" panel chrome. */
  panelWidth: 312,
} as const;

/** Daily capacity baseline (hours) before a lane cell tips into overload. */
export const DAILY_CAPACITY_HOURS = 8;

/** Hours per task when used as the points/tasks metric proxy weight. */
export const HOURS_PER_TASK_UNIT = 1;

/** Range-window options for the day-span dropdown (matches ClickUp wording). */
export const RANGE_OPTIONS: { value: WorkloadRangeDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 28, label: '30 days' },
];

/** Metric options for the load dropdown. */
export const METRIC_OPTIONS: { value: WorkloadMetric; label: string }[] = [
  { value: 'time', label: 'Time Estimates' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'points', label: 'Points' },
];

/** How many days sit before ANCHOR_NOW so "today" lands two columns in. */
export const DAYS_BEFORE_ANCHOR = 1;
