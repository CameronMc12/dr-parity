/**
 * Form-view design tokens. Centralises the var(--cu-*) references so the rail,
 * preview, and inputs stay 1:1 with ClickUp's form builder.
 */

export const FORM_TOKENS = {
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  textDisabled: 'var(--cu-text-disabled)',
  border: 'var(--cu-border)',
  borderDivider: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',
  bgApp: 'var(--cu-bg-app)',
  bgCard: 'var(--cu-bg-menu)',
  bgInput: 'var(--cu-bg-input)',
  bgHover: 'var(--cu-bg-hover)',
  bgActive: 'var(--cu-bg-active)',
  accent: 'var(--cu-accent)',
  accentDark: 'var(--cu-accent-dark)',
  danger: 'var(--cu-danger, #e23f29)',
  radiusSm: 'var(--cu-radius-sm)',
  radiusMd: 'var(--cu-radius-md)',
  radiusLg: 'var(--cu-radius-lg)',
  shadowMd: 'var(--cu-shadow-md)',
  shadowLg: 'var(--cu-shadow-lg)',
  font: 'var(--cu-font)',
} as const;

/** Shared 120ms hover transition used across the view. */
export const HOVER_TRANSITION = 'background-color 120ms ease, border-color 120ms ease, color 120ms ease';
