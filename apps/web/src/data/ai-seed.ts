/**
 * Self-contained seed data for the ClickUp Brain / AI Hub.
 * Mirrors ClickUp's AI landing: quick-action chips, suggestion prompt cards,
 * and recent AI threads grouped for the sidebar.
 */

export type AiQuickAction = {
  id: string;
  label: string;
  /** Icon key resolved by ai-icons. */
  glyph: 'write' | 'summarize' | 'tasks' | 'brainstorm' | 'docs';
};

export type AiSuggestion = {
  id: string;
  title: string;
  description: string;
  glyph: 'brief' | 'summarize' | 'sprint' | 'status' | 'blockers' | 'standup';
};

export type AiThread = {
  id: string;
  title: string;
  snippet: string;
  /** Human-readable relative timestamp. */
  timestamp: string;
  /** Sidebar grouping bucket. */
  group: 'pinned' | 'today' | 'previous7';
};

export const AI_GREETING = 'Good afternoon';

export const AI_QUICK_ACTIONS: AiQuickAction[] = [
  { id: 'write', label: 'Write', glyph: 'write' },
  { id: 'summarize', label: 'Summarize', glyph: 'summarize' },
  { id: 'create-tasks', label: 'Create tasks', glyph: 'tasks' },
  { id: 'brainstorm', label: 'Brainstorm', glyph: 'brainstorm' },
  { id: 'ask-docs', label: 'Ask docs', glyph: 'docs' },
];

export const AI_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'project-brief',
    title: 'Write a project brief',
    description: 'Draft scope, goals, and success metrics for a new initiative.',
    glyph: 'brief',
  },
  {
    id: 'summarize-tasks',
    title: 'Summarize my tasks',
    description: 'Get a quick rollup of what is due across your assigned work.',
    glyph: 'summarize',
  },
  {
    id: 'sprint-plan',
    title: 'Generate a sprint plan',
    description: 'Turn a backlog into a two-week plan with owners and estimates.',
    glyph: 'sprint',
  },
  {
    id: 'status-update',
    title: 'Draft a status update',
    description: 'Compose a stakeholder update from this week of activity.',
    glyph: 'status',
  },
  {
    id: 'find-blockers',
    title: 'Find blockers',
    description: 'Surface overdue, stalled, and dependency-blocked tasks.',
    glyph: 'blockers',
  },
  {
    id: 'standup-notes',
    title: 'Write standup notes',
    description: 'Summarize yesterday, today, and any blockers for the team.',
    glyph: 'standup',
  },
];

export const AI_THREADS: AiThread[] = [
  {
    id: 'thread-roadmap',
    title: 'Q3 roadmap brief',
    snippet: 'Drafted scope and milestones for the platform workstream.',
    timestamp: 'Pinned',
    group: 'pinned',
  },
  {
    id: 'thread-launch',
    title: 'Launch checklist',
    snippet: 'Generated a go-live checklist across marketing and eng.',
    timestamp: 'Pinned',
    group: 'pinned',
  },
  {
    id: 'thread-standup',
    title: 'Standup summary',
    snippet: 'Summarized 14 updates into a three-line standup.',
    timestamp: '2h ago',
    group: 'today',
  },
  {
    id: 'thread-blockers',
    title: 'Sprint blockers',
    snippet: 'Found 5 tasks blocked by an upstream dependency.',
    timestamp: '4h ago',
    group: 'today',
  },
  {
    id: 'thread-retro',
    title: 'Retro themes',
    snippet: 'Clustered retro notes into 4 actionable themes.',
    timestamp: 'Mon',
    group: 'previous7',
  },
  {
    id: 'thread-onboarding',
    title: 'Onboarding doc draft',
    snippet: 'Outlined a new-hire onboarding doc from existing tasks.',
    timestamp: 'Sun',
    group: 'previous7',
  },
];
