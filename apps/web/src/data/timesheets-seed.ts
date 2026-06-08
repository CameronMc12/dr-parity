/**
 * Self-contained seed for the Timesheets page. A week of tracked time across a
 * handful of tasks, matching the workspace's task vocabulary. Minutes are stored
 * as integers (0 = no entry); the page formats them as "h:mm".
 */

export interface TimesheetPerson {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
}

export interface TimesheetTask {
  id: string;
  name: string;
  /** "Space / List" breadcrumb shown under the task name. */
  breadcrumb: string;
  /** Small accent dot before the task name. */
  color: string;
  /** Minutes logged per day, indexed Mon(0) → Sun(6). */
  minutes: [number, number, number, number, number, number, number];
}

export const TIMESHEET_PEOPLE: TimesheetPerson[] = [
  { id: 'u-cam', name: 'Cameron McAllister', initials: 'CM', avatarColor: 'rgb(34, 113, 177)' },
  { id: 'u-priya', name: 'Priya Shah', initials: 'PS', avatarColor: 'rgb(199, 91, 18)' },
  { id: 'u-dario', name: 'Dario Rossi', initials: 'DR', avatarColor: 'rgb(22, 138, 92)' },
];

/** Mon–Sun labels for the seven day columns. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * The seeded week start (a Monday). The page derives the seven dated headers and
 * the "May 26 - Jun 1" range label from this anchor.
 */
export const SEED_WEEK_START = new Date(2025, 4, 26); // 2025-05-26, a Monday.

export const TIMESHEET_TASKS: TimesheetTask[] = [
  {
    id: 't-crawler',
    name: 'Refactor crawler',
    breadcrumb: 'Engineering / Backlog',
    color: 'rgb(34, 113, 177)',
    minutes: [150, 90, 0, 75, 120, 0, 0],
  },
  {
    id: 't-design-review',
    name: 'Design review',
    breadcrumb: 'Product / Sprint 14',
    color: 'rgb(199, 91, 18)',
    minutes: [45, 60, 90, 0, 30, 0, 0],
  },
  {
    id: 't-sprint-planning',
    name: 'Sprint planning',
    breadcrumb: 'Product / Ceremonies',
    color: 'rgb(22, 138, 92)',
    minutes: [60, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 't-parity-gate',
    name: 'Parity gate fixes',
    breadcrumb: 'Engineering / In Progress',
    color: 'rgb(123, 80, 219)',
    minutes: [0, 105, 135, 90, 0, 45, 0],
  },
  {
    id: 't-onboarding',
    name: 'Onboarding flow polish',
    breadcrumb: 'Growth / Q2',
    color: 'rgb(184, 51, 106)',
    minutes: [0, 0, 50, 80, 95, 0, 0],
  },
  {
    id: 't-standup',
    name: 'Daily standup',
    breadcrumb: 'Product / Ceremonies',
    color: 'rgb(22, 138, 92)',
    minutes: [15, 15, 15, 15, 15, 0, 0],
  },
  {
    id: 't-client-call',
    name: 'Client sync — Ikonik',
    breadcrumb: 'Clients / Active',
    color: 'rgb(199, 91, 18)',
    minutes: [0, 30, 0, 45, 0, 0, 0],
  },
];
