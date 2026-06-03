/**
 * Board-view-local style constants. Scoped to this folder only (no global
 * stylesheet). All colours reference design-system `var(--cu-*)` tokens so the
 * board flips with the forced dark theme. Per-column status tints are computed
 * from `task.statusColor` at render time (see `columnTint`).
 */

export const BOARD = {
  // layout
  columnWidth: 280,
  columnGap: 12,
  columnPadX: 20,
  cardGap: 8,
  cardRadius: 'var(--cu-radius-md)',
  collapsedWidth: 44,

  // surfaces
  bg: 'var(--cu-bg-app)',
  cardBg: 'var(--cu-bg-menu)',
  cardHoverBg: 'var(--cu-bg-hover)',
  columnBg: 'var(--cu-bg-sidebar)',
  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',

  // text
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  accent: 'var(--cu-accent)',

  // misc
  shadowCard: '0 1px 2px rgba(0,0,0,0.35)',
  shadowCardHover: '0 4px 12px rgba(0,0,0,0.45)',
  dropRing: 'var(--cu-accent)',
  overdue: 'rgb(226, 67, 41)',
  completeGreen: 'rgb(107, 201, 80)',
  iconHoverBg: 'var(--cu-bg-hover)',
} as const;

/** Card-size setting (ClickUp `board__card-size__{small|medium|large}`). */
export type CardSize = 'small' | 'medium' | 'large';

/** Per-size card metrics so Customize can resize every card live. */
export const CARD_SIZE: Record<CardSize, { padY: number; padX: number; gap: number; nameSize: number; nameClamp: number }> = {
  small: { padY: 8, padX: 10, gap: 6, nameSize: 12, nameClamp: 2 },
  medium: { padY: 10, padX: 12, gap: 8, nameSize: 13, nameClamp: 3 },
  large: { padY: 14, padX: 14, gap: 10, nameSize: 14, nameClamp: 4 },
};

/** Translucent column-header tint from a status colour (ClickUp colored_columns). */
export function columnTint(color: string): string {
  return `color-mix(in srgb, ${color} 14%, transparent)`;
}

/** Slightly stronger tint for the column body background. */
export function columnBodyTint(color: string): string {
  return `color-mix(in srgb, ${color} 6%, var(--cu-bg-sidebar))`;
}

/** Tinted capsule background behind a status-pill label. */
export function statusPillBg(color: string): string {
  return `color-mix(in srgb, ${color} 20%, transparent)`;
}
