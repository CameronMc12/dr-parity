'use client';

import { OverviewCard } from './OverviewCard';
import { OverviewItemRow } from './OverviewItemRow';
import { DOC_ITEMS } from './overview-data';

export function DocsCard() {
  return (
    <OverviewCard title="Docs" minHeight={196}>
      {DOC_ITEMS.map((item, i) => (
        <OverviewItemRow key={`${item.name}-${i}`} name={item.name} location={item.location} />
      ))}
    </OverviewCard>
  );
}
