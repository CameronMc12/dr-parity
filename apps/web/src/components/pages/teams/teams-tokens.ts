/** Teams-hub-local style constants mapped to the shared design tokens. */

export const T = {
  textPrimary: 'var(--cu-text-primary, rgb(32,32,32))',
  textSecondary: 'var(--cu-text-secondary, rgb(80,80,80))',
  textMuted: 'var(--cu-text-muted, rgb(130,130,130))',
  border: 'var(--cu-border-divider, rgb(232,232,232))',
  hoverBg: 'var(--cu-bg-hover, rgb(248,248,248))',
  activeBg: 'var(--cu-bg-active, rgb(240,240,240))',
  appBg: 'var(--cu-bg-app, rgb(255,255,255))',
  /** Faint skeleton-bar fill on the card cover. */
  skeleton: 'rgba(0,0,0,0.07)',
  /** Solid near-black CTA. */
  dark: 'var(--cu-text-primary, rgb(24,24,24))',
} as const;

/** Gallery card geometry, sampled 1:1 from the oracle. */
export const CARD = {
  minWidth: 230,
  maxWidth: 292,
  height: 224,
  radius: 12,
  coverHeight: 130,
} as const;
