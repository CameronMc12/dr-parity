/**
 * Doc-view-local style constants. Scoped to this folder. Import `LV` from
 * `../listview/tokens` for shared design tokens; doc-specific aliases live here.
 *
 * All values reference design-system CSS vars (--cu-*) so the view flips with
 * the forced dark theme. No hardcoded hex except ClickUp's data-driven accents.
 */

export const DOC = {
  /** ClickUp's doc reading column width. */
  contentMaxWidth: 860,
  /** Page-tree sidebar width (matches the doc left rail in the oracle DOM). */
  sidebarWidth: 260,

  bg: 'var(--cu-bg-app)',
  sidebarBg: 'var(--cu-bg-sidebar)',
  menuBg: 'var(--cu-bg-menu)',
  hover: 'var(--cu-bg-hover)',
  active: 'var(--cu-bg-active, var(--cu-bg-hover))',
  input: 'var(--cu-bg-input)',
  strong: 'var(--cu-bg-strong)',

  border: 'var(--cu-border-divider)',
  borderStrong: 'var(--cu-border-strong)',

  textPrimary: 'var(--cu-text-primary)',
  textSecondary: 'var(--cu-text-secondary)',
  textMuted: 'var(--cu-text-muted)',

  accent: 'var(--cu-accent)',
  /** ClickUp link blue inside doc bodies. */
  link: 'rgb(89, 165, 255)',

  headingFont: 'var(--cu-font)',
} as const;

/** Block vertical rhythm (4px grid, mirrors ClickUp's doc spacing). */
export const DOC_SPACE = {
  paragraph: 12,
  heading1Top: 24,
  heading2Top: 22,
  heading3Top: 18,
  headingBottom: 8,
  listItem: 4,
  block: 14,
} as const;
