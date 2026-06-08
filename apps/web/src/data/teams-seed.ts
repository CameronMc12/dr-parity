/**
 * Self-contained seed data for the Teams hub (default "All Teams" gallery).
 * Local fixtures only — no backend. Mirrors the shape ClickUp uses on its
 * Teams Pulse surface: team groups with a square avatar, a member count, and
 * an owner. "Test Team" is the real first team; the rest pad the grid.
 */

export interface TeamMember {
  id: string;
  /** Display name (drives aria-label + avatar fallback). */
  name: string;
  initials: string;
  /** Avatar tile background. */
  color: string;
}

export interface TeamSeed {
  id: string;
  name: string;
  /** Single-letter square avatar glyph. */
  glyph: string;
  /** Square team-avatar tint. */
  avatarBg: string;
  /** Faint cover/preview tint behind the skeleton lines. */
  coverBg: string;
  memberCount: number;
  /** Owner shown bottom-right of the card. */
  owner: TeamMember;
}

const CAMERON: TeamMember = {
  id: 'u-cameron',
  name: 'Cameron Mc',
  initials: 'CM',
  color: 'rgb(24,24,24)',
};

const PRIYA: TeamMember = {
  id: 'u-priya',
  name: 'Priya Raman',
  initials: 'PR',
  color: 'rgb(72,118,236)',
};

const DIEGO: TeamMember = {
  id: 'u-diego',
  name: 'Diego Santos',
  initials: 'DS',
  color: 'rgb(232,93,117)',
};

const HANA: TeamMember = {
  id: 'u-hana',
  name: 'Hana Kim',
  initials: 'HK',
  color: 'rgb(46,182,125)',
};

/**
 * "Test Team" is the genuine first team (avatar tint + cover sampled from the
 * oracle: avatar rgb(161,128,114), cover rgb(241,235,233)). The remaining
 * teams populate the gallery so the grid reads as a real workspace.
 */
export const TEAM_SEED: TeamSeed[] = [
  {
    id: '9fca0e74-e6c4-449a-a60c-1093f88261e6',
    name: 'Test Team',
    glyph: 'T',
    avatarBg: 'rgb(161,128,114)',
    coverBg: 'rgb(241,235,233)',
    memberCount: 1,
    owner: CAMERON,
  },
  {
    id: 'tm-engineering',
    name: 'Engineering',
    glyph: 'E',
    avatarBg: 'rgb(72,118,236)',
    coverBg: 'rgb(233,238,251)',
    memberCount: 6,
    owner: PRIYA,
  },
  {
    id: 'tm-design',
    name: 'Design',
    glyph: 'D',
    avatarBg: 'rgb(232,93,117)',
    coverBg: 'rgb(252,235,239)',
    memberCount: 4,
    owner: DIEGO,
  },
  {
    id: 'tm-product',
    name: 'Product',
    glyph: 'P',
    avatarBg: 'rgb(46,182,125)',
    coverBg: 'rgb(233,247,240)',
    memberCount: 5,
    owner: HANA,
  },
  {
    id: 'tm-marketing',
    name: 'Marketing',
    glyph: 'M',
    avatarBg: 'rgb(255,159,67)',
    coverBg: 'rgb(253,243,232)',
    memberCount: 3,
    owner: PRIYA,
  },
];

/** Count surfaced in the "All Teams" sidebar row. */
export const TEAM_COUNT = TEAM_SEED.length;

/** Distinct people across all teams (drives the "All People" sidebar count). */
export const PEOPLE_COUNT = new Set(TEAM_SEED.map((t) => t.owner.id)).size;
