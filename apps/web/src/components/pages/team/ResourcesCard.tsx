'use client';

import { OverviewCard } from './OverviewCard';
import { OVERVIEW } from './overview-tokens';

export function ResourcesCard() {
  return (
    <OverviewCard title="Resources" minHeight={180}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px dashed ${OVERVIEW.border}`,
          borderRadius: 6,
          background: OVERVIEW.cardBgRaised,
          fontSize: 13,
          color: OVERVIEW.textFaint,
        }}
      >
        <span>
          Drop files here or{' '}
          <span style={{ color: OVERVIEW.accent, cursor: 'pointer' }}>attach</span>
        </span>
      </div>
    </OverviewCard>
  );
}
