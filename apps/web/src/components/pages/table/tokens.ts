/**
 * Shared dark-theme tokens + layout constants for the Table view. Mirrors the
 * `var(--cu-*)` palette every other view reads. Table-specific bits: a visible
 * gridline colour and a zebra tint so the spreadsheet feel reads 1:1 with
 * ClickUp's Table view (the thing that distinguishes it from List).
 */

export const TBL = {
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  border: 'var(--cu-border-divider)',
  hover: 'var(--cu-bg-hover)',
  appBg: 'var(--cu-bg-app)',
  strong: 'var(--cu-bg-strong)',
  /** Vertical + horizontal gridlines — the spreadsheet skeleton. */
  gridline: 'var(--cu-border-divider)',
  /** Sticky header background (sits above scrolling rows). */
  headerBg: 'var(--cu-bg-app)',
  /** Group badge pill. */
  pillBg: 'rgb(42, 42, 42)',
  indigoBg: 'var(--cu-indigo, rgb(50,36,129))',
  indigoText: 'var(--cu-indigo-text, rgb(167,160,249))',
  /** Menu surface for the bottom create-row task-type dropdown. */
  menuBg: 'var(--cu-bg-menu)',
} as const;

/**
 * Lead `#` column: a SINGLE 40px column that shows the row number by default and
 * swaps to a select checkbox on hover / when selected (ClickUp merges row-number
 * + multi-select into one column — there is no separate checkbox column).
 */
export const NUM_WIDTH = 40;
/** Built-in column track width (Name 214, every other built-in 200). */
export const NAME_WIDTH = 214;
export const COL_WIDTH = 200;
/** Trailing "+ add column" header cell width (ClickUp gives it the slack). */
export const ADD_COL_WIDTH = 297;
/** Row + header are both 32px in ClickUp's Table grid. */
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 32;
/** Bottom full-width create row ("+ create task"). */
export const CREATE_ROW_HEIGHT = 35;
export const HOVER_TRANSITION = 'background 120ms';

/** Min / max a column can be dragged to when resizing. */
export const MIN_COL_WIDTH = 64;
export const MAX_COL_WIDTH = 640;
/** Default width for a custom-field (`cf:*`) column (no COLUMN_DEFS track). */
export const CUSTOM_COL_WIDTH = 150;
