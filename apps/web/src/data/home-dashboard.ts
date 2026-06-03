/**
 * Home dashboard data — trimmed from the real ClickUp export and the
 * 2026-06-01 home-main oracle capture.
 *
 * Sources:
 *   docs/research/clickup-export/2026-05-25T16-21-00-615Z/{tasks,lists,members}.json
 *   docs/research/crawl/app.clickup.com/2026-06-01-home-deep/states/home-main (Recents list)
 */

export interface RecentItem {
  id: string;
  name: string;
  /** Item kind drives the leading icon. */
  kind: 'doc' | 'task' | 'list' | 'space';
  /** "in <location>" suffix shown after the name. */
  location: string;
}

export interface MyWorkTab {
  id: 'today' | 'overdue' | 'next' | 'unscheduled';
  label: string;
  count: number;
}

export const HOME_USER = {
  name: 'Cameron',
  fullName: 'Cameron Mc',
  initials: 'CM',
} as const;

/**
 * Recents — exact item list from the home-main oracle, in capture order.
 * Location text matches the "in <…>" / "• <…>" rendering in the real widget.
 */
export const RECENTS: RecentItem[] = [
  { id: 'r1', name: '2022 Release Notes', kind: 'doc', location: 'Roadmap & Backlog' },
  { id: 'r2', name: 'AB Content Management', kind: 'list', location: 'Sprint Team' },
  { id: 'r3', name: 'Product Brief', kind: 'doc', location: 'Sprint Team' },
  { id: 'r4', name: 'Getting Started Guide', kind: 'doc', location: 'Sprint Team' },
  { id: 'r5', name: 'Company Policies', kind: 'doc', location: 'Wiki' },
  { id: 'r6', name: 'Team', kind: 'doc', location: 'Wiki' },
  { id: 'r7', name: 'Project 1', kind: 'list', location: 'Team Space' },
  { id: 'r8', name: '‎Task 2', kind: 'task', location: 'Project 1' },
];

/** My Work tabs (To Do / Done / Delegated header) and the date buckets. */
export const MY_WORK_TABS = ['To Do', 'Done', 'Delegated'] as const;

export const MY_WORK_BUCKETS: MyWorkTab[] = [
  { id: 'today', label: 'Today', count: 0 },
  { id: 'overdue', label: 'Overdue', count: 6 },
  { id: 'next', label: 'Next', count: 0 },
  { id: 'unscheduled', label: 'Unscheduled', count: 0 },
];

/** Onboarding cards in the empty "My Tasks" widget (oracle order). */
export const ONBOARDING_CARDS = [
  {
    id: 'work',
    title: 'Get your work done',
    body: 'See a list for all of your assigned tasks and reminders all in one place.',
  },
  {
    id: 'message',
    title: 'Never miss a message',
    body: 'Resolve and view any comment that has been assigned to you.',
  },
  {
    id: 'customize',
    title: 'Customize to fit your needs',
    body: 'Tailor your page layout to match the way that works best for you.',
  },
] as const;
