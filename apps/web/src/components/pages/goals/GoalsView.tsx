'use client';

import { PageSurface } from '../page-primitives';
import { GoalsToolbar } from './GoalsToolbar';
import { CreateFolderTile } from './CreateFolderTile';
import { GoalCard } from './GoalCard';
import { useGoalsStore } from './goals-ui-store';

/**
 * Goals landing. A toolbar over a card grid: a "create goal folder" tile first,
 * then one circular-ring card per goal. Matches the captured ClickUp oracle.
 */
export function GoalsView() {
  const goals = useGoalsStore((s) => s.goals);
  const addGoal = useGoalsStore((s) => s.addGoal);

  return (
    <PageSurface>
      <GoalsToolbar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 28px 40px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <CreateFolderTile onClick={addGoal} />
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </div>
    </PageSurface>
  );
}
