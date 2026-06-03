/**
 * Timeline-view-local style + geometry constants. Scoped to this folder.
 *
 * The Timeline view packs multiple non-overlapping tasks onto a single lane row
 * (unlike Gantt, which is one task per row). Lanes are grouped by a field
 * (Assignee by default, or Status). Every value is a `var(--cu-*)` token or a
 * literal mirrored from the Gantt/Calendar token sets so the three time-axis
 * views stay visually consistent.
 */

export type TimelineZoom = 'day' | 'week' | 'month';

/**
 * Swimlane grouping field. `none` collapses every task onto a single flat track
 * (ClickUp's default Timeline). The rest split tasks into one lane per value.
 */
export type TimelineGroupBy = 'none' | 'status' | 'assignee' | 'priority';

export const TL = {
  /** Height of a single packed bar. */
  barHeight: 26,
  /** Vertical gap between stacked rows inside one lane. */
  rowGap: 6,
  /** Vertical padding inside a lane (top + bottom each). */
  lanePadY: 8,
  /** Minimum lane height when a lane has a single row. */
  laneMinHeight: 42,
  /** Two-row header: month band + day/week tick row. */
  headerHeight: 56,
  monthBandHeight: 24,
  /** Width of the sticky left rail holding lane labels. */
  railWidth: 240,
  /** Width of the right Tasks panel when open (matches ClickUp's 360px sidebar). */
  backlogWidth: 360,
  /** Height of a draggable backlog row (single-line status circle + name). */
  backlogRowHeight: 34,
  bg: 'var(--cu-bg-app)',
  railBg: 'var(--cu-bg-sidebar)',
  headerBg: 'var(--cu-bg-sidebar)',
  gridBorder: 'var(--cu-border-divider)',
  gridBorderStrong: 'var(--cu-border-strong)',
  barRadius: 'var(--cu-radius-sm)',
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  hover: 'var(--cu-bg-hover)',
  weekendTint: 'rgba(255,255,255,0.022)',
  todayLine: 'var(--cu-status-red, rgb(226, 67, 41))',
  laneFallback: '#87909e',
} as const;

/** Per-zoom geometry. `dayWidth` is the px width of a single calendar day. */
export interface ZoomScale {
  /** Width of one day column in px. */
  dayWidth: number;
  /** ANCHOR-relative padding days rendered before/after the data span. */
  padDays: number;
  /** Bottom tick-row cadence. */
  secondary: 'day' | 'week' | 'month';
}

export const ZOOM_SCALES: Record<TimelineZoom, ZoomScale> = {
  day: { dayWidth: 44, padDays: 5, secondary: 'day' },
  week: { dayWidth: 20, padDays: 14, secondary: 'week' },
  month: { dayWidth: 7, padDays: 31, secondary: 'month' },
} as const;

/** Fine-to-coarse order. Drives +/- zoom stepping and the granularity dropdown. */
export const ZOOM_ORDER: TimelineZoom[] = ['day', 'week', 'month'];

/** Default granularity matches ClickUp's Timeline default. */
export const DEFAULT_ZOOM: TimelineZoom = 'day';

/** Plural granularity labels, matching ClickUp's dropdown wording. */
export const ZOOM_LABEL: Record<TimelineZoom, string> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
};

export const GROUP_BY_ORDER: TimelineGroupBy[] = ['none', 'status', 'assignee', 'priority'];

export const GROUP_BY_LABEL: Record<TimelineGroupBy, string> = {
  none: 'None',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
};

/**
 * Right-panel ("Tasks") tab. ClickUp's Timeline sidebar splits unplaced work
 * into three tabs:
 *   - Unscheduled : no dates at all
 *   - Overdue     : scheduled but due before ANCHOR_NOW
 *   - Unassigned  : no assignee yet
 */
export type TaskPanelTab = 'unscheduled' | 'overdue' | 'unassigned';

export const TASK_PANEL_TAB_ORDER: TaskPanelTab[] = ['unscheduled', 'overdue', 'unassigned'];

export const TASK_PANEL_TAB_LABEL: Record<TaskPanelTab, string> = {
  unscheduled: 'Unscheduled',
  overdue: 'Overdue',
  unassigned: 'Unassigned',
};

/** Sort field for the right "Tasks" panel ("Sort by …" dropdown). */
export type TaskSortField = 'status' | 'priority' | 'name' | 'dueDate';

export const TASK_SORT_ORDER: TaskSortField[] = ['status', 'priority', 'name', 'dueDate'];

export const TASK_SORT_LABEL: Record<TaskSortField, string> = {
  status: 'Status',
  priority: 'Priority',
  name: 'Name',
  dueDate: 'Due date',
};

export const DEFAULT_TASK_SORT: TaskSortField = 'status';
