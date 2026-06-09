'use client';

/**
 * Team view. Renders the shared view chrome (breadcrumb + tab strip) over the
 * Team Space Overview dashboard — a sub-toolbar plus a responsive card grid
 * (Recent / Docs / Bookmarks / Folders / Lists / Resources / Workload by
 * Status), captured 1:1 from ClickUp.
 *
 * Route: /<wsId>/v/team/:viewId  ->  <TeamView viewId=… />
 */

import { ViewShell } from '@/components/views/ViewShell';
import type { ViewScope } from '@/lib/view-scope';
import { TeamOverview } from './TeamOverview';

export function TeamView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  return (
    <ViewShell code="team" viewId={viewId} scope={scope}>
      <TeamOverview />
    </ViewShell>
  );
}
