/**
 * Goals seed — a faithful ClickUp Goals dataset for the React clone.
 *
 * ClickUp Goals model: a Goal lives inside a Goal Folder, has an owner, a due
 * date, and a set of TARGETS (key results). Each target is one of four types:
 *   - number   (current / target, e.g. "Ship 5 features" 3/5)
 *   - currency (current / target in $, e.g. "$40k of $100k MRR")
 *   - boolean  (done / not done)
 *   - task     (completedTasks / totalTasks rolled from a task list)
 * The goal's overall progress is the average of its targets' individual
 * percentages. Folders group goals (Q3 OKRs, Personal, Team).
 */

export type TargetType = 'number' | 'currency' | 'boolean' | 'task';

interface TargetBase {
  id: string;
  name: string;
  type: TargetType;
}

export interface NumberTarget extends TargetBase {
  type: 'number';
  current: number;
  target: number;
  unit?: string;
}

export interface CurrencyTarget extends TargetBase {
  type: 'currency';
  current: number;
  target: number;
}

export interface BooleanTarget extends TargetBase {
  type: 'boolean';
  done: boolean;
}

export interface TaskTarget extends TargetBase {
  type: 'task';
  completed: number;
  total: number;
}

export type Target = NumberTarget | CurrencyTarget | BooleanTarget | TaskTarget;

export interface GoalOwner {
  initials: string;
  color: string;
}

export interface Goal {
  id: string;
  folderId: string;
  name: string;
  owner: GoalOwner;
  /** Pre-formatted due date label as shown in the row. */
  dueLabel: string;
  targets: Target[];
}

export interface GoalFolder {
  id: string;
  name: string;
  /** Accent dot color for the folder. */
  color: string;
}

export const GOAL_FOLDERS: GoalFolder[] = [
  { id: 'fld.q3', name: 'Q3 OKRs', color: 'rgb(36, 174, 100)' },
  { id: 'fld.team', name: 'Team', color: 'rgb(70, 130, 220)' },
  { id: 'fld.personal', name: 'Personal', color: 'rgb(232, 150, 56)' },
];

const CM: GoalOwner = { initials: 'CM', color: 'rgb(122, 122, 122)' };
const AK: GoalOwner = { initials: 'AK', color: 'rgb(70, 130, 220)' };
const RS: GoalOwner = { initials: 'RS', color: 'rgb(210, 90, 120)' };
const JT: GoalOwner = { initials: 'JT', color: 'rgb(120, 110, 200)' };

export const GOALS: Goal[] = [
  {
    id: 'goal.parity',
    folderId: 'fld.q3',
    name: 'Reach 99% clone parity',
    owner: CM,
    dueLabel: 'Sep 30',
    targets: [
      { id: 't.parity.1', type: 'number', name: 'Ship parity-verified views', current: 11, target: 17 },
      { id: 't.parity.2', type: 'task', name: 'Close capture-pipeline tasks', completed: 14, total: 20 },
      { id: 't.parity.3', type: 'boolean', name: 'Land replay-as-React target', done: false },
    ],
  },
  {
    id: 'goal.revenue',
    folderId: 'fld.q3',
    name: 'Grow MRR to $100k',
    owner: AK,
    dueLabel: 'Sep 30',
    targets: [
      { id: 't.rev.1', type: 'currency', name: 'Monthly recurring revenue', current: 64000, target: 100000 },
      { id: 't.rev.2', type: 'number', name: 'Net-new logos', current: 18, target: 30 },
    ],
  },
  {
    id: 'goal.activation',
    folderId: 'fld.q3',
    name: 'Lift week-1 activation to 60%',
    owner: RS,
    dueLabel: 'Aug 15',
    targets: [
      { id: 't.act.1', type: 'number', name: 'Activation rate', current: 48, target: 60, unit: '%' },
      { id: 't.act.2', type: 'boolean', name: 'Ship onboarding checklist', done: true },
      { id: 't.act.3', type: 'task', name: 'Resolve onboarding bugs', completed: 7, total: 9 },
    ],
  },
  {
    id: 'goal.hiring',
    folderId: 'fld.team',
    name: 'Build the platform team',
    owner: JT,
    dueLabel: 'Oct 31',
    targets: [
      { id: 't.hire.1', type: 'number', name: 'Engineers hired', current: 2, target: 4 },
      { id: 't.hire.2', type: 'task', name: 'Complete interview loops', completed: 9, total: 12 },
    ],
  },
  {
    id: 'goal.docs',
    folderId: 'fld.team',
    name: 'Document the engine end to end',
    owner: CM,
    dueLabel: 'Sep 12',
    targets: [
      { id: 't.docs.1', type: 'task', name: 'Write subsystem guides', completed: 5, total: 8 },
      { id: 't.docs.2', type: 'boolean', name: 'Publish onboarding runbook', done: false },
    ],
  },
  {
    id: 'goal.reliability',
    folderId: 'fld.team',
    name: 'Hit 99.9% capture reliability',
    owner: AK,
    dueLabel: 'Sep 30',
    targets: [
      { id: 't.rel.1', type: 'number', name: 'Successful captures', current: 982, target: 1000 },
      { id: 't.rel.2', type: 'boolean', name: 'Add retry-with-backoff', done: true },
    ],
  },
  {
    id: 'goal.reading',
    folderId: 'fld.personal',
    name: 'Read 12 books this year',
    owner: CM,
    dueLabel: 'Dec 31',
    targets: [
      { id: 't.read.1', type: 'number', name: 'Books finished', current: 7, target: 12 },
    ],
  },
  {
    id: 'goal.fitness',
    folderId: 'fld.personal',
    name: 'Run a half marathon',
    owner: RS,
    dueLabel: 'Nov 9',
    targets: [
      { id: 't.fit.1', type: 'number', name: 'Long-run distance', current: 16, target: 21, unit: 'km' },
      { id: 't.fit.2', type: 'boolean', name: 'Register for the race', done: true },
      { id: 't.fit.3', type: 'task', name: 'Complete training plan weeks', completed: 6, total: 12 },
    ],
  },
];
