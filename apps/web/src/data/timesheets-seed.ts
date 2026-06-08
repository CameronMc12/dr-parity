/**
 * Self-contained seed for the Timesheets page.
 *
 * The DEFAULT view is the empty "Add entries to this week's timesheet" state, so
 * the populated rows below are only surfaced when the user clicks "All assigned
 * tasks". Minutes are stored as integers (0 = no entry); the page formats them
 * as "h:mm".
 */

export interface TimesheetTask {
  id: string;
  name: string;
  /** "Space / List" breadcrumb shown under the task name. */
  breadcrumb: string;
  /** Small accent dot before the task name. */
  color: string;
  /** Minutes logged per day, indexed Sun(0) → Sat(6). */
  minutes: [number, number, number, number, number, number, number];
}

/** Sun–Sat labels for the seven day columns (ClickUp weeks start on Sunday). */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * The seeded week start (Sunday Jun 7, 2026). The page derives the seven dated
 * headers and the "Jun 7 - Jun 13" range label from this anchor.
 */
export const SEED_WEEK_START = new Date(2026, 5, 7); // 2026-06-07, a Sunday.

/** Demo "today" — Wednesday of the seeded week. */
export const SEED_TODAY_INDEX = 3;

export const TIMESHEET_TASKS: TimesheetTask[] = [
  {
    id: 't-crawler',
    name: 'Refactor crawler',
    breadcrumb: 'Engineering / Backlog',
    color: 'rgb(34, 113, 177)',
    minutes: [0, 150, 90, 0, 75, 120, 0],
  },
  {
    id: 't-design-review',
    name: 'Design review',
    breadcrumb: 'Product / Sprint 14',
    color: 'rgb(199, 91, 18)',
    minutes: [0, 45, 60, 90, 0, 30, 0],
  },
  {
    id: 't-sprint-planning',
    name: 'Sprint planning',
    breadcrumb: 'Product / Ceremonies',
    color: 'rgb(22, 138, 92)',
    minutes: [0, 60, 0, 0, 0, 0, 0],
  },
  {
    id: 't-parity-gate',
    name: 'Parity gate fixes',
    breadcrumb: 'Engineering / In Progress',
    color: 'rgb(123, 80, 219)',
    minutes: [0, 0, 105, 135, 90, 0, 45],
  },
  {
    id: 't-onboarding',
    name: 'Onboarding flow polish',
    breadcrumb: 'Growth / Q2',
    color: 'rgb(184, 51, 106)',
    minutes: [0, 0, 0, 50, 80, 95, 0],
  },
  {
    id: 't-standup',
    name: 'Daily standup',
    breadcrumb: 'Product / Ceremonies',
    color: 'rgb(22, 138, 92)',
    minutes: [0, 15, 15, 15, 15, 15, 0],
  },
  {
    id: 't-client-call',
    name: 'Client sync — Ikonik',
    breadcrumb: 'Clients / Active',
    color: 'rgb(199, 91, 18)',
    minutes: [0, 0, 30, 0, 45, 0, 0],
  },
];
