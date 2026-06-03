/**
 * Card geometry defaults + the seeded default dashboard. The default layout
 * mirrors the ClickUp dashboard screenshot: a wide AI Executive Summary banner,
 * a row of three stat cards, then a grid of charts and a task list.
 *
 * Grid is 12 columns. Sizes are in grid units. Deterministic — no Date.now /
 * Math.random — so the seeded board is identical across reloads and SSR.
 */

import type { CardType, Dashboard, DashboardCard } from './types';

/** Default w/h (grid units) for a freshly added card of each type. */
export const CARD_DEFAULT_SIZE: Record<CardType, { w: number; h: number }> = {
  stat: { w: 4, h: 2 },
  aiSummary: { w: 12, h: 3 },
  pie: { w: 6, h: 4 },
  bar: { w: 6, h: 4 },
  taskList: { w: 6, h: 5 },
  calculation: { w: 4, h: 2 },
  portfolio: { w: 6, h: 4 },
  embed: { w: 6, h: 4 },
};

/** Human label per type, reused by the registry + new-card titles. */
export const CARD_DEFAULT_TITLE: Record<CardType, string> = {
  stat: 'Stat',
  aiSummary: 'AI Executive Summary',
  pie: 'Total Tasks by Assignee',
  bar: 'Workload by Status',
  taskList: 'Task List',
  calculation: 'Calculation',
  portfolio: 'Portfolio',
  embed: 'Embed',
};

/**
 * The seeded board (12-col grid). Ids are assigned from the store counter when
 * seeded so they stay unique against later additions.
 */
export function defaultCards(
  mintId: () => string,
): DashboardCard[] {
  const card = (
    type: CardType,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    config?: DashboardCard['config'],
  ): DashboardCard => ({ id: mintId(), type, title, x, y, w, h, config });

  return [
    card('aiSummary', 'AI Executive Summary', 0, 0, 12, 3, {}),

    card('stat', 'Unassigned', 0, 3, 4, 2, { metric: 'unassigned' }),
    card('stat', 'In Progress', 4, 3, 4, 2, { metric: 'inProgress' }),
    card('stat', 'Completed', 8, 3, 4, 2, { metric: 'completed' }),

    card('bar', 'Workload by Status', 0, 5, 6, 4, { grouping: 'status' }),
    card('pie', 'Total Tasks by Assignee', 6, 5, 6, 4, { grouping: 'assignee' }),

    card('bar', 'Open Tasks by Assignee', 0, 9, 6, 4, {
      grouping: 'assignee',
      openOnly: true,
    }),
    card('taskList', 'Tasks Completed This Week', 6, 9, 6, 4, {
      metric: 'completedThisWeek',
    }),
  ];
}

export function defaultDashboard(mintId: () => string): Dashboard {
  return { cards: defaultCards(mintId), autoRefresh: true };
}
