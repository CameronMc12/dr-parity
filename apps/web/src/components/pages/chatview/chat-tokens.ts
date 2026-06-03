/**
 * Chat view design tokens. ClickUp chat is a calm, neutral conversation surface:
 * generous left gutter for the avatar column, 13px body copy, muted timestamps,
 * accent only on the active composer and send affordance. All values map onto
 * the shared `--cu-*` token set so the view stays in lockstep with the rest of
 * the workspace and both light / dark themes.
 */

export const CHAT = {
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',
  hoverBg: 'var(--cu-bg-hover)',
  inputBg: 'var(--cu-bg-input)',
  menuBg: 'var(--cu-bg-menu)',
  accent: 'var(--cu-accent)',
  accentSubtle: 'var(--cu-accent-subtle)',
  danger: 'var(--cu-danger)',
  radiusSm: 'var(--cu-radius-sm, 4px)',
  radiusMd: 'var(--cu-radius-md, 8px)',
  shadowSm: 'var(--cu-shadow-sm)',
  transition: 'background 120ms ease, color 120ms ease, opacity 120ms ease',
  avatarSize: 36,
  gutter: 56,
} as const;

/** Stable emoji reaction palette shown on message hover. */
export const REACTIONS = ['👍', '🎉', '👀', '❤️', '✅'] as const;
