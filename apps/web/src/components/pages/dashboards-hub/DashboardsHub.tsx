'use client';

import { PageSurface, TEXT_PRIMARY } from '../page-primitives';
import { DashboardsHubToolbar } from './DashboardsHubToolbar';
import { DashboardCard } from './DashboardCard';
import { TemplatesRow } from './TemplatesRow';
import { DashboardDetail } from './DashboardDetail';
import { useDashboardsUi } from './dashboards-ui-store';
import { DASHBOARDS, dashboardById } from '@/data/dashboards-seed';

/**
 * Dashboards hub. Two states driven by the local dashboards UI store:
 *  - gallery: templates row + a grid of dashboard cards (the landing).
 *  - detail: a single dashboard's live widget grid (DashboardDetail).
 *
 * Metrics inside each dashboard are computed from the real workspace tasks
 * store; this surface only owns navigation and layout.
 */
export function DashboardsHub() {
  const openId = useDashboardsUi((s) => s.openDashboardId);
  const openDashboard = useDashboardsUi((s) => s.openDashboard);
  const closeDashboard = useDashboardsUi((s) => s.closeDashboard);

  const active = openId ? dashboardById(openId) : undefined;

  if (active) {
    return (
      <PageSurface>
        <DashboardDetail dashboard={active} onBack={closeDashboard} />
      </PageSurface>
    );
  }

  return (
    <PageSurface>
      <DashboardsHubToolbar />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
        <TemplatesRow />
        <h2 style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, margin: '0 0 12px' }}>
          My Dashboards
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {DASHBOARDS.map((dashboard) => (
            <DashboardCard key={dashboard.id} dashboard={dashboard} onOpen={openDashboard} />
          ))}
        </div>
      </div>
    </PageSurface>
  );
}
