'use client';

/**
 * One day bucket in the Activity feed: a sticky day header ("Today" / "Yesterday"
 * / weekday-date) over its entry rows, with the subtle vertical timeline line
 * running behind the dots for the full height of the group.
 */

import { memo } from 'react';
import type { FeedDay, FeedEntry } from './activity-feed';
import { ActivityEntryRow } from './ActivityEntryRow';
import { dayHeaderLabel } from './relative-time';
import { ACT, RAIL } from './tokens';

interface DayGroupProps {
  group: FeedDay;
  /** Id of the single newest entry across the whole feed (reads "just now"). */
  latestId: string | null;
  onOpen: (taskId: string) => void;
  onEntryContextMenu: (e: React.MouseEvent, entry: FeedEntry) => void;
}

function DayGroupImpl({ group, latestId, onOpen, onEntryContextMenu }: DayGroupProps) {
  return (
    <section data-testid="activity-day" style={{ position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: '6px 16px 6px 8px',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: ACT.textMuted,
          // Opaque app background so the timeline rail cannot bleed through the
          // sticky header as rows scroll beneath it (rail sits at z-index 0).
          backgroundColor: ACT.bg,
        }}
      >
        {dayHeaderLabel(group.day)}
      </div>

      <div style={{ position: 'relative', zIndex: 0 }}>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: RAIL.lineX,
            width: 1,
            background: ACT.border,
          }}
        />
        {group.entries.map((entry) => (
          <ActivityEntryRow
            key={entry.id}
            entry={entry}
            isLatest={entry.id === latestId}
            onOpen={onOpen}
            onContextMenu={onEntryContextMenu}
          />
        ))}
      </div>
    </section>
  );
}

export const DayGroup = memo(DayGroupImpl);
