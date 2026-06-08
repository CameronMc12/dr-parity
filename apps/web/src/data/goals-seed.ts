/**
 * Goals seed — synthesized from the DR-PARITY-SEED fixture
 * (engine/seed/fixture.ts → workspace.goals[0]) because the ClickUp export
 * (docs/research/clickup-export/2026-06-05T08-15-56-280Z) contains no goals.json.
 *
 * Matches the Goals oracle 1:1:
 *   docs/research/crawl/app.clickup.com/exhaustive-goals/states/state-0001/screenshot.png
 * One goal card (0% ring, "0 targets", owner CM avatar, "Yesterday at 5:08 pm")
 * plus the leading "new folder" tile.
 */

export interface Goal {
  id: string;
  name: string;
  /** 0–100. Drives the progress ring. */
  progress: number;
  targetCount: number;
  owner: { initials: string; color: string };
  /** Pre-formatted relative timestamp as shown in the card footer. */
  updatedLabel: string;
}

export const GOALS: Goal[] = [
  {
    id: 'goal.parity',
    name: 'DR-PARITY-SEED Reach 99% parity',
    progress: 0,
    targetCount: 0,
    owner: { initials: 'C', color: 'rgb(122, 122, 122)' },
    updatedLabel: 'Yesterday at 5:08 pm',
  },
];
