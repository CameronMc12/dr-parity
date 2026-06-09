'use client';

import { OverviewCard } from './OverviewCard';
import { OverviewItemRow } from './OverviewItemRow';
import { RECENT_ITEMS } from './overview-data';

export function RecentCard() {
  return (
    <OverviewCard title="Recent" minHeight={196}>
      {RECENT_ITEMS.map((item, i) => (
        <OverviewItemRow key={`${item.name}-${i}`} name={item.name} location={item.location} />
      ))}
    </OverviewCard>
  );
}
