/**
 * Map-view-local style constants. Scoped to this folder. All colours reference
 * `--cu-*` vars so dark/light flips automatically.
 */

export const MAP = {
  // surfaces / lines
  bg: 'var(--cu-bg-app)',
  border: 'var(--cu-border-divider)',
  panelBg: 'var(--cu-bg-strong)',
  oceanBg: 'var(--cu-grey-100, #191919)',
  landFill: 'var(--cu-bg-hover)',
  landStroke: 'var(--cu-border-strong)',
  graticule: 'var(--cu-border-divider)',
  hoverBg: 'var(--cu-bg-hover)',
  rowActiveBg: 'var(--cu-bg-active)',

  // text
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  // accents
  accent: 'var(--cu-accent)',
  pinDefault: 'var(--cu-accent)',

  // geometry
  panelWidth: 320,
  pinSize: 14,
  rowHeight: 44,
} as const;
