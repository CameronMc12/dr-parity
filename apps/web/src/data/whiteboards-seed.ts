/**
 * Whiteboards hub seed. Self-contained sample data for the Whiteboards gallery
 * page and its sidebar. Each whiteboard carries a small `shapes` array that the
 * thumbnail renderer turns into a faux mini-whiteboard preview (sticky notes +
 * connector lines), so every card looks distinct.
 */

export type WhiteboardTab = 'recents' | 'created' | 'shared' | 'private';

export interface WhiteboardAuthor {
  initials: string;
  color: string;
}

/** A coloured sticky-note rectangle in the thumbnail, positioned in percent. */
export interface PreviewNote {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/** A connector line between two points in the thumbnail, in percent. */
export interface PreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WhiteboardPreview {
  bg: string;
  notes: PreviewNote[];
  lines: PreviewLine[];
}

export interface Whiteboard {
  id: string;
  name: string;
  space: string;
  folder?: string;
  editedLabel: string;
  author: WhiteboardAuthor;
  tabs: WhiteboardTab[];
  preview: WhiteboardPreview;
}

const STICKY_YELLOW = 'rgb(255, 221, 102)';
const STICKY_PINK = 'rgb(255, 156, 178)';
const STICKY_BLUE = 'rgb(125, 188, 255)';
const STICKY_GREEN = 'rgb(140, 217, 161)';
const STICKY_ORANGE = 'rgb(255, 178, 102)';
const STICKY_TEAL = 'rgb(120, 210, 205)';
const BOARD_BG = 'rgb(250, 250, 250)';
const BOARD_BG_ALT = 'rgb(246, 248, 252)';

export const WHITEBOARDS: Whiteboard[] = [
  {
    id: 'wb-sprint-retro',
    name: 'Sprint Retro',
    space: 'Product',
    folder: 'Engineering',
    editedLabel: 'Edited 2 hours ago',
    author: { initials: 'CM', color: 'rgb(122, 90, 248)' },
    tabs: ['recents', 'created', 'shared'],
    preview: {
      bg: BOARD_BG,
      notes: [
        { x: 8, y: 14, w: 24, h: 26, fill: STICKY_GREEN },
        { x: 38, y: 18, w: 24, h: 26, fill: STICKY_YELLOW },
        { x: 68, y: 14, w: 24, h: 26, fill: STICKY_PINK },
        { x: 22, y: 56, w: 24, h: 26, fill: STICKY_BLUE },
        { x: 54, y: 58, w: 24, h: 26, fill: STICKY_ORANGE },
      ],
      lines: [
        { x1: 20, y1: 40, x2: 34, y2: 56 },
        { x1: 50, y1: 44, x2: 66, y2: 58 },
      ],
    },
  },
  {
    id: 'wb-user-flow',
    name: 'User Flow',
    space: 'Design',
    folder: 'Research',
    editedLabel: 'Edited yesterday',
    author: { initials: 'AL', color: 'rgb(46, 170, 220)' },
    tabs: ['recents', 'shared'],
    preview: {
      bg: BOARD_BG_ALT,
      notes: [
        { x: 6, y: 40, w: 20, h: 20, fill: STICKY_BLUE },
        { x: 32, y: 18, w: 20, h: 20, fill: STICKY_TEAL },
        { x: 32, y: 62, w: 20, h: 20, fill: STICKY_TEAL },
        { x: 58, y: 40, w: 20, h: 20, fill: STICKY_GREEN },
        { x: 80, y: 40, w: 16, h: 20, fill: STICKY_YELLOW },
      ],
      lines: [
        { x1: 26, y1: 50, x2: 32, y2: 28 },
        { x1: 26, y1: 50, x2: 32, y2: 72 },
        { x1: 52, y1: 28, x2: 58, y2: 50 },
        { x1: 52, y1: 72, x2: 58, y2: 50 },
        { x1: 78, y1: 50, x2: 80, y2: 50 },
      ],
    },
  },
  {
    id: 'wb-architecture-map',
    name: 'Architecture Map',
    space: 'Engineering',
    folder: 'Platform',
    editedLabel: 'Edited 3 days ago',
    author: { initials: 'CM', color: 'rgb(122, 90, 248)' },
    tabs: ['recents', 'created', 'private'],
    preview: {
      bg: BOARD_BG,
      notes: [
        { x: 38, y: 8, w: 24, h: 18, fill: STICKY_PINK },
        { x: 10, y: 44, w: 22, h: 18, fill: STICKY_BLUE },
        { x: 40, y: 44, w: 22, h: 18, fill: STICKY_GREEN },
        { x: 70, y: 44, w: 22, h: 18, fill: STICKY_ORANGE },
        { x: 40, y: 76, w: 22, h: 16, fill: STICKY_YELLOW },
      ],
      lines: [
        { x1: 50, y1: 26, x2: 21, y2: 44 },
        { x1: 50, y1: 26, x2: 51, y2: 44 },
        { x1: 50, y1: 26, x2: 81, y2: 44 },
        { x1: 51, y1: 62, x2: 51, y2: 76 },
      ],
    },
  },
  {
    id: 'wb-brainstorm-q3',
    name: 'Brainstorm Q3',
    space: 'Marketing',
    folder: 'Campaigns',
    editedLabel: 'Edited last week',
    author: { initials: 'JP', color: 'rgb(240, 140, 60)' },
    tabs: ['recents', 'shared'],
    preview: {
      bg: BOARD_BG_ALT,
      notes: [
        { x: 6, y: 10, w: 22, h: 22, fill: STICKY_YELLOW },
        { x: 36, y: 30, w: 22, h: 22, fill: STICKY_PINK },
        { x: 66, y: 12, w: 22, h: 22, fill: STICKY_ORANGE },
        { x: 14, y: 56, w: 22, h: 22, fill: STICKY_GREEN },
        { x: 52, y: 64, w: 22, h: 22, fill: STICKY_BLUE },
        { x: 78, y: 52, w: 18, h: 22, fill: STICKY_TEAL },
      ],
      lines: [
        { x1: 28, y1: 21, x2: 36, y2: 41 },
        { x1: 58, y1: 41, x2: 66, y2: 23 },
        { x1: 36, y1: 52, x2: 25, y2: 56 },
      ],
    },
  },
  {
    id: 'wb-roadmap-2026',
    name: 'Roadmap 2026',
    space: 'Product',
    folder: 'Strategy',
    editedLabel: 'Edited 2 weeks ago',
    author: { initials: 'CM', color: 'rgb(122, 90, 248)' },
    tabs: ['created', 'shared'],
    preview: {
      bg: BOARD_BG,
      notes: [
        { x: 6, y: 30, w: 18, h: 34, fill: STICKY_BLUE },
        { x: 28, y: 30, w: 18, h: 34, fill: STICKY_GREEN },
        { x: 50, y: 30, w: 18, h: 34, fill: STICKY_YELLOW },
        { x: 72, y: 30, w: 18, h: 34, fill: STICKY_ORANGE },
      ],
      lines: [
        { x1: 24, y1: 47, x2: 28, y2: 47 },
        { x1: 46, y1: 47, x2: 50, y2: 47 },
        { x1: 68, y1: 47, x2: 72, y2: 47 },
      ],
    },
  },
  {
    id: 'wb-onboarding-journey',
    name: 'Onboarding Journey',
    space: 'Design',
    folder: 'UX',
    editedLabel: 'Edited 3 weeks ago',
    author: { initials: 'AL', color: 'rgb(46, 170, 220)' },
    tabs: ['recents', 'shared', 'private'],
    preview: {
      bg: BOARD_BG_ALT,
      notes: [
        { x: 8, y: 20, w: 20, h: 24, fill: STICKY_TEAL },
        { x: 38, y: 40, w: 20, h: 24, fill: STICKY_PINK },
        { x: 68, y: 20, w: 20, h: 24, fill: STICKY_GREEN },
        { x: 38, y: 8, w: 20, h: 18, fill: STICKY_YELLOW },
      ],
      lines: [
        { x1: 28, y1: 32, x2: 38, y2: 52 },
        { x1: 58, y1: 52, x2: 68, y2: 32 },
        { x1: 48, y1: 26, x2: 48, y2: 40 },
      ],
    },
  },
  {
    id: 'wb-team-charter',
    name: 'Team Charter',
    space: 'People',
    editedLabel: 'Edited last month',
    author: { initials: 'JP', color: 'rgb(240, 140, 60)' },
    tabs: ['private'],
    preview: {
      bg: BOARD_BG,
      notes: [
        { x: 30, y: 12, w: 40, h: 22, fill: STICKY_YELLOW },
        { x: 12, y: 50, w: 30, h: 22, fill: STICKY_GREEN },
        { x: 58, y: 50, w: 30, h: 22, fill: STICKY_BLUE },
      ],
      lines: [
        { x1: 50, y1: 34, x2: 27, y2: 50 },
        { x1: 50, y1: 34, x2: 73, y2: 50 },
      ],
    },
  },
  {
    id: 'wb-data-model',
    name: 'Data Model',
    space: 'Engineering',
    folder: 'Backend',
    editedLabel: 'Edited last month',
    author: { initials: 'CM', color: 'rgb(122, 90, 248)' },
    tabs: ['created', 'private'],
    preview: {
      bg: BOARD_BG_ALT,
      notes: [
        { x: 10, y: 14, w: 26, h: 20, fill: STICKY_PINK },
        { x: 60, y: 14, w: 26, h: 20, fill: STICKY_PINK },
        { x: 35, y: 56, w: 26, h: 20, fill: STICKY_BLUE },
      ],
      lines: [
        { x1: 36, y1: 24, x2: 60, y2: 24 },
        { x1: 23, y1: 34, x2: 40, y2: 56 },
        { x1: 73, y1: 34, x2: 56, y2: 56 },
      ],
    },
  },
  {
    id: 'wb-customer-journey',
    name: 'Customer Journey',
    space: 'Marketing',
    folder: 'Lifecycle',
    editedLabel: 'Edited 2 months ago',
    author: { initials: 'JP', color: 'rgb(240, 140, 60)' },
    tabs: ['recents', 'shared'],
    preview: {
      bg: BOARD_BG,
      notes: [
        { x: 4, y: 38, w: 16, h: 24, fill: STICKY_GREEN },
        { x: 26, y: 18, w: 16, h: 24, fill: STICKY_YELLOW },
        { x: 48, y: 50, w: 16, h: 24, fill: STICKY_ORANGE },
        { x: 70, y: 24, w: 16, h: 24, fill: STICKY_PINK },
      ],
      lines: [
        { x1: 20, y1: 50, x2: 26, y2: 30 },
        { x1: 42, y1: 30, x2: 48, y2: 62 },
        { x1: 64, y1: 62, x2: 70, y2: 36 },
      ],
    },
  },
  {
    id: 'wb-okrs-planning',
    name: 'OKRs Planning',
    space: 'Product',
    folder: 'Strategy',
    editedLabel: 'Edited 3 months ago',
    author: { initials: 'AL', color: 'rgb(46, 170, 220)' },
    tabs: ['created', 'private'],
    preview: {
      bg: BOARD_BG_ALT,
      notes: [
        { x: 8, y: 12, w: 38, h: 18, fill: STICKY_TEAL },
        { x: 54, y: 12, w: 38, h: 18, fill: STICKY_TEAL },
        { x: 8, y: 40, w: 24, h: 18, fill: STICKY_YELLOW },
        { x: 38, y: 40, w: 24, h: 18, fill: STICKY_GREEN },
        { x: 8, y: 68, w: 24, h: 18, fill: STICKY_ORANGE },
        { x: 38, y: 68, w: 24, h: 18, fill: STICKY_PINK },
      ],
      lines: [
        { x1: 27, y1: 30, x2: 20, y2: 40 },
        { x1: 27, y1: 30, x2: 50, y2: 40 },
      ],
    },
  },
];

/** Filter the seed by the active tab. */
export function whiteboardsForTab(boards: Whiteboard[], tab: WhiteboardTab): Whiteboard[] {
  return boards.filter((board) => board.tabs.includes(tab));
}
