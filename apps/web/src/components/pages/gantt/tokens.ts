/**
 * Gantt-view-local style constants. Scoped to this folder. Import `LV` from
 * `../listview/tokens` for shared design tokens; gantt-specific aliases live here.
 *
 * No stylesheet — every gantt element is styled with inline `style={{}}` objects
 * referencing these constants (mirrors the List-view convention).
 */

export type GanttZoom = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'flexible';

/**
 * Which dependency line style the timeline draws. ClickUp's gantt shows
 * waiting-on links solid and linked-relationship links in a lighter style; we
 * keep both so the dependency toggle / critical-path overlay can switch them.
 */
export type DependencyMode = 'waiting' | 'linked';

export const GANTT = {
  rowHeight: 36,
  headerHeight: 56,
  /** Height of the upper "week band" row inside the header. */
  weekBandHeight: 26,
  labelColWidth: 280,
  barHeight: 20,
  milestoneSize: 14,
  bg: 'var(--cu-bg-app)',
  panelBg: 'var(--cu-bg-sidebar)',
  gridBorder: 'var(--cu-border-divider)',
  gridBorderStrong: 'var(--cu-border-strong)',
  barRadius: 'var(--cu-radius-sm)',
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  hover: 'var(--cu-bg-hover)',
  /** Active-control pill background — matches the workspace teal accent, not purple. */
  activeTint: 'var(--cu-accent-light, rgba(78, 205, 196, 0.18))',
  activeText: 'var(--cu-accent, rgb(78, 205, 196))',
  weekendTint: 'rgba(255,255,255,0.022)',
  weekendHatch:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 4px, transparent 4px 8px)',
  todayLine: 'rgb(226, 67, 41)',
  todayBadgeBg: 'rgb(226, 67, 41)',
  milestone: 'rgb(255, 191, 0)',
  linkLine: 'var(--cu-text-muted)',
  /** Critical-path connector / bar outline colour. */
  criticalLine: 'rgb(226, 67, 41)',
  /** Baseline ghost-bar fill (drawn behind the live bar). */
  baselineFill: 'var(--cu-status-blue, rgba(0, 180, 255, 0.32))',
} as const;

/** Per-zoom geometry. `dayWidth` is the px width of a single calendar day. */
export interface ZoomScale {
  /** Width of one day column in px. */
  dayWidth: number;
  /** How many ANCHOR-relative days of padding to render before/after the data. */
  padDays: number;
  /** Top-row date label cadence. */
  primary: 'week' | 'month';
  /** Bottom-row tick cadence. */
  secondary: 'day' | 'week' | 'month';
}

export const ZOOM_SCALES: Record<GanttZoom, ZoomScale> = {
  day: { dayWidth: 40, padDays: 7, primary: 'week', secondary: 'day' },
  week: { dayWidth: 26, padDays: 14, primary: 'week', secondary: 'day' },
  month: { dayWidth: 7, padDays: 31, primary: 'month', secondary: 'week' },
  quarter: { dayWidth: 3, padDays: 62, primary: 'month', secondary: 'week' },
  year: { dayWidth: 1.2, padDays: 120, primary: 'month', secondary: 'month' },
  // "Flexible" auto-fits the data span to the viewport; its dayWidth is a sane
  // starting value that the view's auto-fit pass overrides on selection.
  flexible: { dayWidth: 7, padDays: 31, primary: 'month', secondary: 'week' },
} as const;

/**
 * Zoom order from most-zoomed-in (Day) to most-zoomed-out (Year). `flexible`
 * is intentionally excluded — it is an auto-fit mode, not a fixed scale step,
 * so the +/- timeline stepper never lands on it.
 */
export const ZOOM_ORDER: GanttZoom[] = ['day', 'week', 'month', 'quarter', 'year'];

/** Full time-period list matching ClickUp's Gantt zoom dropdown, in order. */
export const ZOOM_OPTIONS: GanttZoom[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'flexible',
];

/** Singular labels matching ClickUp's time-period dropdown trigger. */
export const ZOOM_LABEL: Record<GanttZoom, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
  flexible: 'Flexible',
};
