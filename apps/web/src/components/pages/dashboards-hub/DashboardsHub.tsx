'use client';

/**
 * Dashboards hub. Two states driven by the local dashboards UI store:
 *  - "All Dashboards" landing: the breadcrumb header, the Templates row, and the
 *    dense dashboards table list (matches real ClickUp).
 *  - detail: a single dashboard's live widget grid (DashboardDetail).
 *
 * Metrics inside each dashboard are computed from the real workspace tasks store;
 * this surface only owns navigation and layout.
 */

import { PageSurface } from '../page-primitives';
import { DashboardsHubToolbar } from './DashboardsHubToolbar';
import { TemplatesRow } from './TemplatesRow';
import { DashboardsTable } from './DashboardsTable';
import { DashboardDetail } from './DashboardDetail';
import { useDashboardsUi } from './dashboards-ui-store';
import { DASHBOARDS, dashboardById } from '@/data/dashboards-seed';

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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 40px' }}>
        <TemplatesRow />
        <DashboardsTable dashboards={DASHBOARDS} onOpen={openDashboard} />
      </div>
    </PageSurface>
  );
}
