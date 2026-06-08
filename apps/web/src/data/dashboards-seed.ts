/**
 * Dashboards hub seed. Self-contained fixtures for the Dashboards gallery and
 * the per-dashboard widget grids. The numbers inside each dashboard are derived
 * live from the workspace tasks store at render time; this seed only describes
 * each dashboard's identity (name, owner, sharing, last viewed) and which
 * widget types it composes (for the card preview + the detail grid).
 *
 * Owner colours/initials mirror the members seed so the avatars line up with
 * the real workspace people.
 */

/** Widget kinds the hub knows how to render and preview. */
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

export interface DashboardEntry {
  id: string;
  name: string;
  description: string;
  owner: DashboardOwner;
  /** Pre-formatted relative timestamp shown on the card. */
  updatedLabel: string;
  sharing: 'private' | 'shared';
  /** Widget composition — drives the card preview and the detail grid order. */
  widgets: WidgetKind[];
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  /** Widget set this template would scaffold. */
  widgets: WidgetKind[];
  accent: string;
}

const CAMERON: DashboardOwner = { initials: 'CM', name: 'Cameron Mc', color: '#595d66' };
const TEAM: DashboardOwner = { initials: 'T', name: 'Test Team', color: '#a18072' };

export const DASHBOARDS: DashboardEntry[] = [
  {
    id: 'dash-overview',
    name: 'Workspace Overview',
    description: 'High-level health across every list. Totals, status split, and what is due.',
    owner: CAMERON,
    updatedLabel: 'Viewed 2h ago',
    sharing: 'private',
    widgets: ['statTotal', 'statCompleted', 'statOverdue', 'statusDonut', 'assigneeBar', 'dueSoon'],
  },
  {
    id: 'dash-sprint',
    name: 'Current Sprint',
    description: 'Burndown signals for the active sprint. Status, priority, and recent movement.',
    owner: CAMERON,
    updatedLabel: 'Viewed yesterday',
    sharing: 'private',
    widgets: ['statusBar', 'priorityBreakdown', 'statCompleted', 'recentActivity'],
  },
  {
    id: 'dash-team',
    name: 'Team Workload',
    description: 'Who is carrying what. Open work per assignee with overdue flags.',
    owner: TEAM,
    updatedLabel: 'Viewed 3d ago',
    sharing: 'shared',
    widgets: ['assigneeBar', 'statOverdue', 'statTotal', 'statusBar'],
  },
  {
    id: 'dash-priorities',
    name: 'Priorities & Risk',
    description: 'Where attention is needed. Priority breakdown with the soonest deadlines.',
    owner: CAMERON,
    updatedLabel: 'Viewed last week',
    sharing: 'shared',
    widgets: ['priorityBreakdown', 'statOverdue', 'dueSoon', 'statusDonut'],
  },
];

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'tpl-sprint',
    name: 'Sprint',
    description: 'Track an active sprint end to end.',
    widgets: ['statusBar', 'priorityBreakdown', 'statCompleted', 'recentActivity'],
    accent: '#4ecdc4',
  },
  {
    id: 'tpl-team',
    name: 'Team',
    description: 'Balance workload across the team.',
    widgets: ['assigneeBar', 'statTotal', 'statOverdue', 'statusBar'],
    accent: '#7d6ef0',
  },
  {
    id: 'tpl-time',
    name: 'Time tracking',
    description: 'Completed work over the week.',
    widgets: ['statCompleted', 'statTotal', 'statusDonut', 'recentActivity'],
    accent: '#f6a609',
  },
  {
    id: 'tpl-priorities',
    name: 'Priorities',
    description: 'Surface the most urgent work first.',
    widgets: ['priorityBreakdown', 'statOverdue', 'dueSoon', 'statusDonut'],
    accent: '#e85d75',
  },
];

export function dashboardById(id: string): DashboardEntry | undefined {
  return DASHBOARDS.find((d) => d.id === id);
}
