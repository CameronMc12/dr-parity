/**
 * Goals seed for the ClickUp React clone.
 *
 * The real Goals landing renders a flat grid of goal cards. Each card shows a
 * circular progress ring (overall %), the goal name, a "N targets" link, and a
 * footer with the owner avatar and a created/updated timestamp. Folders are an
 * optional grouping that the landing keeps hidden by default ("Folders: Hide").
 *
 * The first goal is the DR-PARITY-SEED card that mirrors the captured oracle.
 */

export interface GoalOwner {
  initials: string;
  /** Avatar background, matched to the captured oracle (rgb(89,93,102)). */
  color: string;
}

export interface Goal {
  id: string;
  name: string;
  /** Overall completion, 0-100. Drives the ring. */
  percent: number;
  /** Number of key-result targets attached to the goal. */
  targetCount: number;
  owner: GoalOwner;
  /** Pre-formatted timestamp as shown bottom-right of the card. */
  dateLabel: string;
}

const SEED_AVATAR = 'rgb(89, 93, 102)';

const CM: GoalOwner = { initials: 'C', color: SEED_AVATAR };
const AK: GoalOwner = { initials: 'A', color: 'rgb(70, 130, 220)' };
const RS: GoalOwner = { initials: 'R', color: 'rgb(210, 90, 120)' };
const JT: GoalOwner = { initials: 'J', color: 'rgb(36, 174, 100)' };

export const GOALS: Goal[] = [
  {
    id: 'goal.parity',
    name: 'DR-PARITY-SEED Reach 99% parity',
    percent: 0,
    targetCount: 0,
    owner: CM,
    dateLabel: 'Jun 4 at 5:08 pm',
  },
  {
    id: 'goal.revenue',
    name: 'Grow MRR to $100k',
    percent: 64,
    targetCount: 2,
    owner: AK,
    dateLabel: 'Jun 3 at 11:20 am',
  },
  {
    id: 'goal.activation',
    name: 'Lift week-1 activation to 60%',
    percent: 80,
    targetCount: 3,
    owner: RS,
    dateLabel: 'Jun 2 at 9:14 am',
  },
  {
    id: 'goal.hiring',
    name: 'Build the platform team',
    percent: 50,
    targetCount: 2,
    owner: JT,
    dateLabel: 'Jun 1 at 4:42 pm',
  },
  {
    id: 'goal.docs',
    name: 'Document the engine end to end',
    percent: 31,
    targetCount: 2,
    owner: CM,
    dateLabel: 'May 30 at 2:05 pm',
  },
  {
    id: 'goal.reliability',
    name: 'Hit 99.9% capture reliability',
    percent: 98,
    targetCount: 2,
    owner: AK,
    dateLabel: 'May 29 at 6:51 pm',
  },
  {
    id: 'goal.reading',
    name: 'Read 12 books this year',
    percent: 58,
    targetCount: 1,
    owner: CM,
    dateLabel: 'May 28 at 8:03 am',
  },
  {
    id: 'goal.fitness',
    name: 'Run a half marathon',
    percent: 42,
    targetCount: 3,
    owner: RS,
    dateLabel: 'May 26 at 7:30 am',
  },
];
