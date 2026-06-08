/**
 * Self-contained seed data for ClickUp Brain (the AI hub).
 * Sampled 1:1 from the real ClickUp Brain landing: sidebar Super Agents nav,
 * the centered prompt suggestion cards, and the sidebar footer credit widgets.
 */

export type AiSuggestionCard = {
  id: string;
  title: string;
  description: string;
  glyph: 'meeting' | 'doc' | 'brainstorm' | 'find';
};

export type AiSuperAgentLink = {
  id: string;
  label: string;
  /** Icon key resolved by ai-icons. */
  glyph: 'createAgent' | 'allAgents' | 'myAgents' | 'activity';
  /** Optional trailing count badge. */
  count?: number;
};

export type AiRecentAgent = {
  id: string;
  label: string;
  /** Hex/letters for the round avatar fallback. */
  initial: string;
  avatarBg: string;
};

export type AiCreditWidget = {
  id: string;
  value: string;
  label: string;
  /** 0..1 fraction of the ring that is filled. */
  progress: number;
};

/** The four prompt suggestion cards under the Brain prompt box. */
export const AI_SUGGESTION_CARDS: AiSuggestionCard[] = [
  {
    id: 'meeting-summary',
    title: 'Meeting Summary',
    description: 'Summarize recent activity',
    glyph: 'meeting',
  },
  {
    id: 'draft-doc',
    title: 'Draft Doc',
    description: 'Create project brief',
    glyph: 'doc',
  },
  {
    id: 'brainstorm-ideas',
    title: 'Brainstorm Ideas',
    description: 'Generate team activities',
    glyph: 'brainstorm',
  },
  {
    id: 'find-tasks',
    title: 'Find Tasks',
    description: 'Search open tasks',
    glyph: 'find',
  },
];

/** Sidebar "Super Agents" section rows. */
export const AI_SUPER_AGENTS: AiSuperAgentLink[] = [
  { id: 'create-agent', label: 'Create Agent', glyph: 'createAgent' },
  { id: 'all-agents', label: 'All Agents', glyph: 'allAgents', count: 1 },
  { id: 'my-agents', label: 'My Agents', glyph: 'myAgents', count: 1 },
  { id: 'activity', label: 'Activity', glyph: 'activity' },
];

/** Sidebar "Recent Super Agents" rows. */
export const AI_RECENT_AGENTS: AiRecentAgent[] = [
  { id: 'onboarding-assistant', label: 'Onboarding Assistant', initial: 'O', avatarBg: 'rgb(124, 58, 237)' },
];

/** Sidebar footer credit ring widgets. */
export const AI_CREDIT_WIDGETS: AiCreditWidget[] = [
  { id: 'brain-uses', value: '48', label: 'Brain AI uses', progress: 0.92 },
  { id: 'credits-left', value: '2.4k', label: 'Credits left', progress: 0.88 },
];
