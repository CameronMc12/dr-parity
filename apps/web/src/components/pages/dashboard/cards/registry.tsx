'use client';

/**
 * Card registry. Two maps drive the whole dashboard:
 *   CARD_TYPES     — catalog metadata for the Add-card gallery (label,
 *                    description, category, accent, icon glyph).
 *   CARD_RENDERERS — type -> React component, each accepting {card, listId,
 *                    viewId}. The grid looks a card up here to render its body.
 *
 * Adding a new card type = add an entry to both maps and a renderer file. The
 * gallery and grid pick it up automatically.
 */

import type { ComponentType } from 'react';
import type { CardType } from '@/store/dashboard';
import type { CardRenderProps } from './card-props';
import { StatCard } from './StatCard';
import { AISummaryCard } from './AISummaryCard';
import { PieCard } from './PieCard';
import { BarCard } from './BarCard';
import { TaskListCard } from './TaskListCard';
import { CalculationCard } from './CalculationCard';
import { PortfolioCard } from './PortfolioCard';
import { EmbedCard } from './EmbedCard';

/** Gallery sidebar categories, in display order. */
export const CARD_CATEGORIES = [
  'Featured',
  'AI Cards',
  'Custom',
  'Sprints',
  'Statuses',
  'Tags',
  'Assignees',
  'Priorities',
  'Time Tracking',
  'Tables',
  'Embeds and Apps',
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

export interface CardTypeMeta {
  type: CardType;
  label: string;
  description: string;
  category: CardCategory;
  /** Accent colour for the gallery mini-preview. */
  accent: string;
  /** Emoji glyph stand-in for the preview tile (sprite icons land next phase). */
  glyph: string;
}

/**
 * The Add-card catalog. Some types appear in multiple categories (e.g. a chart
 * is both "Featured" and "Statuses"); the gallery filters by `category`, and
 * `Featured` shows the curated set below via CARD_TYPES whose category matches.
 */
export const CARD_TYPES: CardTypeMeta[] = [
  {
    type: 'aiSummary',
    label: 'AI Brain',
    description: 'Auto-written executive summary of this list.',
    category: 'AI Cards',
    accent: 'var(--cu-accent)',
    glyph: '✦',
  },
  {
    type: 'taskList',
    label: 'Task List',
    description: 'A scrollable list of tasks with status.',
    category: 'Featured',
    accent: 'var(--cu-status-blue)',
    glyph: '☰',
  },
  {
    type: 'bar',
    label: 'Workload by Status',
    description: 'Bar breakdown of tasks per status.',
    category: 'Statuses',
    accent: 'var(--cu-status-green)',
    glyph: '▥',
  },
  {
    type: 'pie',
    label: 'Tasks by Assignee',
    description: 'Donut breakdown of tasks per assignee.',
    category: 'Assignees',
    accent: 'var(--cu-status-purple)',
    glyph: '◑',
  },
  {
    type: 'stat',
    label: 'Stat',
    description: 'A single big-number metric.',
    category: 'Featured',
    accent: 'var(--cu-status-yellow)',
    glyph: '＃',
  },
  {
    type: 'calculation',
    label: 'Calculation',
    description: 'A derived value such as completion rate.',
    category: 'Custom',
    accent: 'var(--cu-status-blue)',
    glyph: '∑',
  },
  {
    type: 'portfolio',
    label: 'Portfolio',
    description: 'Progress rollup across the list.',
    category: 'Featured',
    accent: 'var(--cu-accent)',
    glyph: '▦',
  },
  {
    type: 'embed',
    label: 'Embed',
    description: 'Embed an external page or app.',
    category: 'Embeds and Apps',
    accent: 'var(--cu-status-red)',
    glyph: '⧉',
  },
];

/** Lookup the catalog entry for a type (used by titles + previews). */
export function cardTypeMeta(type: CardType): CardTypeMeta | undefined {
  return CARD_TYPES.find((c) => c.type === type);
}

/** type -> renderer component. The single source of truth for the grid. */
export const CARD_RENDERERS: Record<CardType, ComponentType<CardRenderProps>> = {
  stat: StatCard,
  aiSummary: AISummaryCard,
  pie: PieCard,
  bar: BarCard,
  taskList: TaskListCard,
  calculation: CalculationCard,
  portfolio: PortfolioCard,
  embed: EmbedCard,
};
