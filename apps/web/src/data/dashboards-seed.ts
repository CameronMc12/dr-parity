/**
 * Dashboards hub seed.
 *
 * Two halves:
 *  1. The "All Dashboards" table list — the real ClickUp landing. A dense list
 *     of dashboard rows (name, location, viewed/updated dates, owner, sharing,
 *     private flag) plus the three template tiles shown above the table.
 *  2. The per-dashboard widget composition (`widgets`) consumed by the detail
 *     view. Numbers inside each dashboard are derived live from the workspace
 *     tasks store at render time; this seed only describes identity + layout.
 *
 * Owner colours/initials mirror the members seed so avatars line up with the
 * real workspace people.
 */

/** Widget kinds the detail grid knows how to render. */
export type WidgetKind =
  | 'statusBar'
  | 'priorityBreakdown'
  | 'assigneeBar'
  | 'statTotal'
  | 'statCompleted'
  | 'statOverdue'
  | 'statusDonut'
  | 'dueSoon'
  | 'recentActivity';

export interface DashboardOwner {
  initials: string;
  name: string;
  color: string;
}

/** Where a dashboard lives. `null` renders as an em-dash in the Location cell. */
export type DashboardLocation =
  | { kind: 'space'; label: string }
  | { kind: 'project'; label: string }
  | null;

export interface DashboardEntry {
  id: string;
  name: string;
  description: string;
  owner: DashboardOwner;
  sharing: 'private' | 'shared';
  /** True for rows that show a lock glyph next to the name (private items). */
  locked: boolean;
  location: DashboardLocation;
  /** Pre-formatted relative label for the "Date viewed" column. */
  viewedLabel: string;
  /** Pre-formatted short date for the "Date updated" column. */
  updatedLabel: string;
  /** Widget composition — drives the detail grid order. */
  widgets: WidgetKind[];
}

export type TemplateAccent = 'blue' | 'violet' | 'sky';

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  accent: TemplateAccent;
  /** Widget set this template would scaffold. */
  widgets: WidgetKind[];
}

const CAMERON: DashboardOwner = { initials: 'CM', name: 'Cameron Mc', color: '#1a1a1a' };

const TEAM_SPACE: DashboardLocation = { kind: 'space', label: 'Team Space' };
const PROJECT_1: DashboardLocation = { kind: 'project', label: 'Project 1' };

/** Widget recipes reused across rows so the detail grid always has content. */
const OVERVIEW: WidgetKind[] = [
  'statTotal',
  'statCompleted',
  'statOverdue',
  'statusDonut',
  'assigneeBar',
  'dueSoon',
];
const SPRINT: WidgetKind[] = ['statusBar', 'priorityBreakdown', 'statCompleted', 'recentActivity'];
const WORKLOAD: WidgetKind[] = ['assigneeBar', 'statOverdue', 'statTotal', 'statusBar'];

/**
 * The "All Dashboards" list. Mirrors the real account: a long run of identically
 * named "Dashboard" rows, mostly private (locked), nearly all owned by CM, with
 * a sprinkle of locations and a descending spread of viewed/updated dates.
 */
export const DASHBOARDS: DashboardEntry[] = [
  row('dash-01', { location: TEAM_SPACE, locked: false, viewed: '20 mins ago', updated: 'Jun 2', widgets: OVERVIEW, sharing: 'shared' }),
  row('dash-02', { viewed: 'Jun 5', updated: 'Jun 5', widgets: SPRINT }),
  row('dash-03', { viewed: 'Jun 5', updated: 'Jun 5', widgets: WORKLOAD }),
  row('dash-04', { viewed: 'Jun 4', updated: 'Jun 4', widgets: OVERVIEW }),
  row('dash-05', { location: PROJECT_1, viewed: 'Jun 2', updated: 'Jun 2', widgets: SPRINT }),
  row('dash-06', { viewed: 'May 26', updated: 'May 26', widgets: WORKLOAD }),
  row('dash-07', { viewed: 'May 25', updated: 'May 25', widgets: OVERVIEW }),
  row('dash-08', { viewed: 'May 25', updated: 'May 25', widgets: SPRINT }),
  row('dash-09', { viewed: 'May 25', updated: 'May 25', widgets: WORKLOAD }),
  row('dash-10', { viewed: 'May 25', updated: 'May 25', widgets: OVERVIEW }),
  row('dash-11', { viewed: 'May 25', updated: 'May 25', widgets: SPRINT }),
  row('dash-12', { viewed: 'May 25', updated: 'May 25', widgets: WORKLOAD }),
  row('dash-13', { viewed: 'May 25', updated: 'May 25', widgets: OVERVIEW }),
  row('dash-14', { viewed: 'May 26', updated: 'May 25', widgets: SPRINT }),
  row('dash-15', { viewed: 'May 24', updated: 'May 24', widgets: WORKLOAD }),
  row('dash-16', { viewed: 'May 22', updated: 'May 22', widgets: OVERVIEW }),
];

interface RowOpts {
  location?: DashboardLocation;
  locked?: boolean;
  sharing?: DashboardEntry['sharing'];
  viewed: string;
  updated: string;
  widgets: WidgetKind[];
}

function row(id: string, opts: RowOpts): DashboardEntry {
  return {
    id,
    name: 'Dashboard',
    description: 'Workspace metrics derived live from the tasks store.',
    owner: CAMERON,
    sharing: opts.sharing ?? 'private',
    locked: opts.locked ?? true,
    location: opts.location ?? null,
    viewedLabel: opts.viewed,
    updatedLabel: opts.updated,
    widgets: opts.widgets,
  };
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'tpl-simple',
    name: 'Simple Dashboard',
    description: 'Manage & prioritize tasks',
    accent: 'blue',
    widgets: ['statTotal', 'statCompleted', 'statOverdue', 'statusBar'],
  },
  {
    id: 'tpl-ai-team',
    name: 'AI Team Center',
    description: 'View team activity with AI',
    accent: 'violet',
    widgets: ['assigneeBar', 'recentActivity', 'statTotal', 'statusDonut'],
  },
  {
    id: 'tpl-project',
    name: 'Project Management',
    description: 'Analyze project progress and metrics',
    accent: 'sky',
    widgets: ['statusBar', 'priorityBreakdown', 'statOverdue', 'dueSoon'],
  },
];

export function dashboardById(id: string): DashboardEntry | undefined {
  return DASHBOARDS.find((d) => d.id === id);
}
