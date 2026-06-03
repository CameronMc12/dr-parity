/**
 * Dashboard-view-local style constants. Scoped to this folder. All colours map
 * to design-system `var(--cu-*)` tokens so the dashboard flips with the forced
 * dark theme. Grid geometry (12 cols, ~80px rows) lives here too.
 */

export const DASH = {
  // grid geometry
  cols: 12,
  rowHeight: 80,
  gridGap: 12,
  gridPad: 16,

  // surfaces
  bg: 'var(--cu-bg-app)',
  cardBg: 'var(--cu-bg-menu)',
  cardHoverBg: 'var(--cu-bg-hover)',
  toolbarBg: 'var(--cu-bg-app)',
  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',

  // text
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  // accents
  accent: 'var(--cu-accent)',
  accentSubtle: 'var(--cu-accent-subtle, rgba(78,205,196,0.12))',

  // radius / shadow
  radius: 'var(--cu-radius-lg)',
  radiusSm: 'var(--cu-radius-sm)',
  shadow: 'var(--cu-shadow-md, 0 1px 3px rgba(0,0,0,0.4))',
  shadowHover: '0 6px 18px rgba(0,0,0,0.5)',

  // status palette (charts)
  red: 'var(--cu-status-red)',
  green: 'var(--cu-status-green)',
  yellow: 'var(--cu-status-yellow)',
  blue: 'var(--cu-status-blue)',
  purple: 'var(--cu-status-purple)',
} as const;

/** Chart series palette cycled when a slice has no intrinsic colour. */
export const CHART_PALETTE = [
  'var(--cu-status-blue)',
  'var(--cu-status-green)',
  'var(--cu-status-yellow)',
  'var(--cu-status-red)',
  'var(--cu-status-purple)',
  'var(--cu-accent)',
] as const;

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] ?? CHART_PALETTE[0];
}
