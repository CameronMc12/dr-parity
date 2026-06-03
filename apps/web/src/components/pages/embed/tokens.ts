/**
 * Embed-view-local style constants. Scoped to this folder. All values reference
 * design-system CSS vars (--cu-*) so the view renders in the forced dark theme.
 *
 * Geometry mirrors the real ClickUp embed view 1:1 (captured light → rendered
 * dark): the empty surface, its illustration, title/description rhythm, the
 * "Edit source" outline button, the source-config popover, and the slim URL bar.
 */

export const EMBED = {
  /** Empty-state surface. Capture: --cu-background-subtle. Dark: app bg. */
  emptyBg: 'var(--cu-bg-app)',
  /** Active embed wrapper. */
  bg: 'var(--cu-bg-app)',
  panel: 'var(--cu-bg-menu)',
  hover: 'var(--cu-bg-hover)',
  input: 'var(--cu-bg-input)',
  strong: 'var(--cu-bg-strong)',

  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',

  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  accent: 'var(--cu-accent)',
  accentSubtle: 'var(--cu-accent-subtle, rgba(78,205,196,0.10))',

  /**
   * Illustration fills. In the real capture the rounded square and the triangle
   * are the SAME flat soft grey (`--cu-background-subtle-*`), with the triangle
   * reading a hair lighter as the foreground shape. Mirror that here: both stay
   * in the elevated-surface band with only a marginal step between them. Using
   * `border-strong` (a much lighter muted-border grey) for the triangle, as
   * before, split the mark into two disjoint tones — that is the discrepancy.
   */
  illoRect: 'var(--cu-bg-strong)',
  illoPath: 'var(--cu-border-divider)',

  /** Hover transition used app-wide. */
  transition: 'background 120ms',

  /** Slim URL bar height above an active embed. */
  urlBarHeight: 40,
  /** Source-config popover width. */
  configWidth: 360,
} as const;
