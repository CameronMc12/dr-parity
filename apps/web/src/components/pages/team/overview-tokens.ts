/**
 * Team Space Overview dashboard tokens. These are the literal Figma values for
 * the Overview surface (Recent / Docs / Bookmarks / Folders / Lists / Resources
 * / Workload by Status). They intentionally sit alongside `tokens.ts` rather
 * than touching it: the per-assignee Workload view reads `TEAM`/`TEAM_CARD`, and
 * the Overview card chrome is a different palette (raised #191919 surfaces, a
 * #2a2a2a hairline, blue accent) captured 1:1 from ClickUp.
 */

export const OVERVIEW = {
  /** Page background. */
  bg: '#111111',
  /** Raised card surface. */
  cardBg: '#191919',
  /** Slightly lighter raised surface (drop areas / nested rows). */
  cardBgRaised: '#1e2024',
  /** 1px hairline around cards + progress track. */
  border: '#2a2a2a',
  hoverBg: '#202020',

  textTitle: '#ffffff',
  textBody: '#cccccc',
  textMuted: '#b4b4b4',
  textFaint: '#7b7b7b',

  accent: '#0091ff',

  radiusCard: 8,
  radiusRow: 4,
  cardPad: 18,
  gridGap: 14,
} as const;

/** Donut slices for the Workload-by-Status chart. */
export const STATUS_SLICE = {
  inProgress: '#5842c8',
  toDo: '#3a3a3a',
} as const;
