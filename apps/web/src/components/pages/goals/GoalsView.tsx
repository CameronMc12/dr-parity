'use client';

import { PageSurface } from '../page-primitives';
import { GoalsToolbar } from './GoalsToolbar';
import { GoalCard } from './GoalCard';
import { NewFolderTile } from './NewFolderTile';
import { GOALS } from '@/data/goals-seed';

/**
 * Goals surface. Oracle:
 *   docs/research/crawl/app.clickup.com/exhaustive-goals/states/state-0001
 * Header toolbar, then a flowing grid: leading "new folder" tile on the first
 * row, goal cards below.
 */
export function GoalsView() {
  return (
    <PageSurface>
      <GoalsToolbar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <NewFolderTile />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {GOALS.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </div>
    </PageSurface>
  );
}
