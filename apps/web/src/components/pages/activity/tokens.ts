/**
 * Activity-view design tokens. All colors reference the shared --cu-* theme
 * variables so the feed tracks the workspace theme (ClickUp 1:1) with zero
 * hard-coded palette values.
 */

import type { ActivityAction } from './activity-feed';

export const ACT = {
  bg: 'var(--cu-bg-app)',
  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',
  border: 'var(--cu-border-divider)',
  hover: 'var(--cu-bg-hover)',
  accent: 'var(--cu-accent)',
} as const;

/** Per-action timeline-dot color. */
export const ACTION_DOT: Record<ActivityAction, string> = {
  moved: 'var(--cu-text-secondary)',
  commented: 'var(--cu-text-secondary)',
};

/** Past-tense verb phrases matching ClickUp's Activity feed wording 1:1. */
export const ACTION_VERB: Record<ActivityAction, string> = {
  moved: 'changed the status of',
  commented: 'commented on',
};

/** Left rail geometry shared by the day header and entry rows. */
export const RAIL = {
  /** Horizontal centre of the timeline line, measured from the feed's left pad. */
  lineX: 19,
  dotSize: 9,
  avatarSize: 24,
} as const;
