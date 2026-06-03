/**
 * Team-view-local style constants. Scoped to this folder. Maps to the shared
 * design-system `var(--cu-*)` tokens so the view tracks the forced dark theme.
 *
 * Geometry mirrors the real ClickUp Team view (`cu-user-box` / `cu-workload-box`):
 * 250px cards, 4px radius, 15px gutters, elevation-2 shadow. Only the palette is
 * swapped to our dark tokens — every dimension matches the capture.
 */

export const TEAM = {
  bg: 'var(--cu-bg-app)',
  cardBg: 'var(--cu-bg-menu)',
  hoverBg: 'var(--cu-bg-hover)',
  toolbarBg: 'var(--cu-bg-app)',

  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',

  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  accent: 'var(--cu-accent)',

  // control radii (toolbar buttons / menus / inputs)
  radiusSm: 'var(--cu-radius-sm, 6px)',
  radius: 'var(--cu-radius-lg, 8px)',

  // donut / capacity track colour + done fill
  track: 'var(--cu-border-strong, rgba(255,255,255,0.12))',
  done: 'var(--cu-status-green, #2ec971)',
} as const;

/**
 * Card geometry, 1:1 with the capture.
 * .cu-user-box   { border-radius:4px; margin:0 15px 15px 0; width:250px }
 * .cu-workload-box{ border-radius:4px; min-height:230px; min-width:250px }
 * .cu-dashboard-box__boxes { display:flex; flex-wrap:wrap }
 */
export const TEAM_CARD = {
  width: 250,
  radius: 4,
  /** Right + bottom gutter between boxes (capture uses margin:0 15px 15px 0). */
  gutter: 15,
  /** Outer padding of the boxes container. */
  pad: 20,
  /** Card drop shadow (our dark-mode elevation-2 equivalent). */
  shadow: '0 1px 4px rgba(0,0,0,0.45)',
} as const;
