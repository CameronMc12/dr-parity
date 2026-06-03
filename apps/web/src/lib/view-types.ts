/**
 * Canonical ClickUp view-type registry. One entry per view type ClickUp exposes
 * in its "+ View" menu, split into two categories: `data` (task-data renderers —
 * List, Board, Calendar, Gantt, Table, Timeline, Workload, Activity, Map, Mind
 * Map) and `other` (page-style apps — Doc, Chat, Form, Whiteboard, Embed).
 *
 * `code` is the stable URL segment used after `/v/` (e.g. `/v/<code>/<viewId>`)
 * and the join key the per-list views store uses. `Glyph` is the coloured tab
 * icon; `color` matches the live ClickUp tab colours for the five core views and
 * a tasteful neutral-coloured glyph for the rest.
 *
 * Codes are confirmed against the existing tab strip (l, b, cal, gtt, tbl) and
 * the ClickUp standard/custom view registry (timeline, workload, activity, map,
 * mind_map data views; doc, chat, form, whiteboard, embed apps).
 */

import {
  BoardGlyph,
  CalendarGlyph,
  GanttGlyph,
  ListGlyph,
  TableGlyph,
} from '@/components/pages/list-view-icons';
import {
  ActivityGlyph,
  ChatGlyph,
  DashboardGlyph,
  DocGlyph,
  EmbedGlyph,
  FormGlyph,
  MapGlyph,
  MindMapGlyph,
  TeamGlyph,
  TimelineGlyph,
  WhiteboardGlyph,
  WorkloadGlyph,
  type GlyphComponent,
} from './view-type-glyphs';

export type ViewCategory = 'data' | 'other';

export interface ViewType {
  /** Stable URL/route segment after `/v/` and store join key. */
  code: string;
  /** Display label shown on tabs and in the add-view menu. */
  label: string;
  /** One-line description shown beneath the label in the add-view menu. */
  description: string;
  /** Coloured tab/menu glyph. */
  Glyph: GlyphComponent;
  /** Glyph colour (matches the live ClickUp tab colours for the five cores). */
  color: string;
  /** Grouping in the add-view menu: data renderers vs apps/other. */
  category: ViewCategory;
  /**
   * Route segment alias. Identical to `code` today, kept as a distinct field so
   * a code can diverge from its URL segment later without touching call sites.
   */
  seg: string;
}

const NEUTRAL = 'rgb(160,164,172)';

export const VIEW_TYPES: ViewType[] = [
  // ── Data / task views ──────────────────────────────────────────────────
  { code: 'l', label: 'List', description: 'Track tasks, bugs, people & more', Glyph: ListGlyph, color: 'rgb(184,188,196)', category: 'data', seg: 'l' },
  { code: 'b', label: 'Board', description: 'Move tasks between columns', Glyph: BoardGlyph, color: 'rgb(120,180,250)', category: 'data', seg: 'b' },
  { code: 'cal', label: 'Calendar', description: 'Plan, schedule & delegate', Glyph: CalendarGlyph, color: 'rgb(230,150,80)', category: 'data', seg: 'cal' },
  { code: 'gtt', label: 'Gantt', description: 'Plan dependencies & time', Glyph: GanttGlyph, color: 'rgb(120,200,170)', category: 'data', seg: 'gtt' },
  { code: 'tbl', label: 'Table', description: 'Structured table format', Glyph: TableGlyph, color: 'rgb(170,160,250)', category: 'data', seg: 'tbl' },
  { code: 'tl', label: 'Timeline', description: 'See tasks by start & due date', Glyph: TimelineGlyph, color: 'rgb(120,200,170)', category: 'data', seg: 'tl' },
  { code: 'wl', label: 'Workload', description: 'Visualize team capacity', Glyph: WorkloadGlyph, color: 'rgb(230,150,80)', category: 'data', seg: 'wl' },
  { code: 'act', label: 'Activity', description: 'Real-time activity feed', Glyph: ActivityGlyph, color: 'rgb(120,180,250)', category: 'data', seg: 'act' },
  { code: 'map', label: 'Map', description: 'Visualize tasks on a map', Glyph: MapGlyph, color: 'rgb(120,200,170)', category: 'data', seg: 'map' },
  { code: 'mm', label: 'Mind Map', description: 'Visual brainstorming of ideas', Glyph: MindMapGlyph, color: 'rgb(170,160,250)', category: 'data', seg: 'mm' },
  { code: 'dash', label: 'Dashboard', description: 'Track metrics & insights', Glyph: DashboardGlyph, color: 'rgb(170,120,230)', category: 'data', seg: 'dash' },
  // ── Apps / other ───────────────────────────────────────────────────────
  { code: 'dc', label: 'Doc', description: 'Collaborate & document anything', Glyph: DocGlyph, color: NEUTRAL, category: 'other', seg: 'dc' },
  { code: 'chat', label: 'Chat', description: 'Discuss work in real time', Glyph: ChatGlyph, color: NEUTRAL, category: 'other', seg: 'chat' },
  { code: 'form', label: 'Form', description: 'Collect, track & report data', Glyph: FormGlyph, color: NEUTRAL, category: 'other', seg: 'form' },
  { code: 'wb', label: 'Whiteboard', description: 'Visualize & brainstorm ideas', Glyph: WhiteboardGlyph, color: NEUTRAL, category: 'other', seg: 'wb' },
  { code: 'embed', label: 'Embed', description: 'Embed any app or website', Glyph: EmbedGlyph, color: NEUTRAL, category: 'other', seg: 'embed' },
  { code: 'team', label: 'Team', description: "See your team's work", Glyph: TeamGlyph, color: 'rgb(120,180,250)', category: 'other', seg: 'team' },
];

const BY_CODE: Record<string, ViewType> = Object.fromEntries(
  VIEW_TYPES.map((v) => [v.code, v]),
);

/** Look up a view type by its code. Returns undefined for unknown codes. */
export function viewTypeByCode(code: string): ViewType | undefined {
  return BY_CODE[code];
}

/** View types in the `data` category, in registry order. */
export const DATA_VIEW_TYPES: ViewType[] = VIEW_TYPES.filter((v) => v.category === 'data');

/** View types in the `other` category, in registry order. */
export const OTHER_VIEW_TYPES: ViewType[] = VIEW_TYPES.filter((v) => v.category === 'other');

/**
 * Default view set every list shows out of the box, in tab order: List, Board,
 * Calendar, Gantt, Table. Any list with no stored override is templated from
 * this set by the per-list views store.
 */
export const DEFAULT_VIEW_CODES: readonly string[] = ['l', 'b', 'cal', 'gtt', 'tbl'];
