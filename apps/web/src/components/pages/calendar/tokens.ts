/**
 * Calendar-view-local style constants. Scoped to this folder. Import `LV` from
 * `../listview/tokens` for shared design tokens; calendar-specific aliases live
 * here. All colours reference `--cu-*` vars so dark/light flips automatically.
 */

export const CAL = {
  // grid geometry
  cellMinHeight: 110,
  chipHeight: 22,
  chipGap: 3,
  weekdayHeaderHeight: 34,

  // sidebar geometry
  sidebarWidth: 280,
  sidebarRailWidth: 44,

  // surfaces / lines (oracle: cal-cell + cal-header)
  bg: 'var(--cu-bg-app)',
  gridBorder: 'var(--cu-border-divider)',
  headerBg: 'var(--cu-bg-app)',
  // In real ClickUp every cell shares the same surface; only the date number is
  // muted for out-of-month / past days. No darker fill for trailing days.
  inMonthBg: 'var(--cu-bg-app)',
  outMonthBg: 'var(--cu-bg-app)',
  hoverBg: 'var(--cu-bg-hover)',
  // The "today" cell in the capture is a 1px box outline, NOT a tinted fill.
  // The outline colour is a neutral/dark border, NOT the orange brand accent.
  todayBg: 'var(--cu-bg-app)',
  todayOutline: 'var(--cu-border-strong, var(--cu-text-primary))',
  panelBg: 'var(--cu-bg-menu)',
  inputBg: 'var(--cu-bg-input)',

  // text
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  // accents
  todayRing: 'var(--cu-accent)',
  accent: 'var(--cu-accent)',
  overdue: 'var(--cu-status-red, #e85b5b)',
} as const;

/** Sunday-led weekday labels (ClickUp default `showWeekends:true`). */
export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Short weekday labels for the narrow week view. */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
