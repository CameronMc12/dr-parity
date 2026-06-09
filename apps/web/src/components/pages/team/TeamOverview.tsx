'use client';

/**
 * Team Space Overview dashboard. A sub-toolbar over a responsive 3-track card
 * grid, captured 1:1 from ClickUp:
 *
 *   Row 1: Recent | Docs | Bookmarks   (3 equal)
 *   Row 2: Folders                      (full width)
 *   Row 3: Lists                        (full width table)
 *   Row 4: Resources | Workload by Status
 *
 * Static content lives in `overview-data.ts`; chrome tokens in
 * `overview-tokens.ts`. Each card is a presentational unit.
 */

import { OVERVIEW } from './overview-tokens';
import { OverviewSubToolbar } from './OverviewSubToolbar';
import { RecentCard } from './RecentCard';
import { DocsCard } from './DocsCard';
import { BookmarksCard } from './BookmarksCard';
import { FoldersCard } from './FoldersCard';
import { ListsCard } from './ListsCard';
import { ResourcesCard } from './ResourcesCard';
import { WorkloadByStatusCard } from './WorkloadByStatusCard';

export function TeamOverview() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: OVERVIEW.bg,
      }}
    >
      <OverviewSubToolbar />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: OVERVIEW.gridGap,
            padding: '6px 20px 24px',
            alignItems: 'start',
          }}
        >
          <RecentCard />
          <DocsCard />
          <BookmarksCard />

          <FoldersCard />
          <ListsCard />

          <div
            style={{
              gridColumn: 'span 3',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: OVERVIEW.gridGap,
              alignItems: 'start',
            }}
          >
            <ResourcesCard />
            <WorkloadByStatusCard />
          </div>
        </div>
      </div>
    </div>
  );
}
