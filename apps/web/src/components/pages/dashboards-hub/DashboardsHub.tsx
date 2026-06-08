'use client';

import { PageSurface, EmptyState, DarkButton, PlusIcon } from '../page-primitives';
import { DashboardsHubToolbar } from './DashboardsHubToolbar';
import { DashboardCard } from './DashboardCard';
import { DashboardsBigIcon } from './dashboards-hub-icons';
import { DASHBOARDS } from '@/data/dashboards-seed';

/**
 * Dashboards hub (distinct from the per-view DashboardView dash widget).
 * Oracle: docs/research/crawl/app.clickup.com/exhaustive-dashboards/...
 * Header toolbar over a grid of dashboard cards, or an empty state when the
 * workspace has no dashboards (the case for this seed).
 */
export function DashboardsHub() {
  const hasDashboards = DASHBOARDS.length > 0;

  return (
    <PageSurface>
      <DashboardsHubToolbar />
      {hasDashboards ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {DASHBOARDS.map((dashboard) => (
              <DashboardCard key={dashboard.id} dashboard={dashboard} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          illustration={<span style={{ color: 'rgb(200, 200, 200)' }}><DashboardsBigIcon /></span>}
          title="No dashboards yet"
          subtitle="Build a dashboard to track work across your workspace at a glance."
          action={<DarkButton icon={<PlusIcon size={16} />}>New Dashboard</DarkButton>}
        />
      )}
    </PageSurface>
  );
}
