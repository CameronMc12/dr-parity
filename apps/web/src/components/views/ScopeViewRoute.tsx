'use client';

/**
 * Scope-aware view dispatcher. Given a `scope` (list | space | folder) and a
 * view `code`, it renders the matching task-view body and passes the scope
 * straight through. Every data view derives its tasks/statuses/config from the
 * scope hooks, so the same body renders a single list, an entire folder, or an
 * entire space. The view body itself owns its chrome (it renders ViewShell with
 * the scope), so this dispatcher only maps code -> component.
 *
 * Codes follow the canonical registry in view-types.ts: l, b, cal, gtt, tbl,
 * tl, wl. Any code without a scope-capable body falls back to ListView.
 */

import type { ComponentType } from 'react';
import { ListView } from '@/components/pages/ListView';
import { BoardView } from '@/components/pages/board/BoardView';
import { CalendarView } from '@/components/pages/calendar/CalendarView';
import { GanttView } from '@/components/pages/gantt/GanttView';
import { TableView } from '@/components/pages/table/TableView';
import { TimelineView } from '@/components/pages/timeline/TimelineView';
import { WorkloadView } from '@/components/pages/workload/WorkloadView';
import type { ViewScope } from '@/lib/view-scope';

/** Every scope-capable data view takes the same single-prop contract. */
export type ScopeViewComponent = ComponentType<{ scope: ViewScope }>;

/**
 * Code -> scope-capable view body. Exported so the workspace dispatcher can
 * reuse the exact same mapping for list routes.
 */
export const SCOPE_VIEW_BY_CODE: Record<string, ScopeViewComponent> = {
  l: ListView,
  b: BoardView,
  cal: CalendarView,
  gtt: GanttView,
  tbl: TableView,
  tl: TimelineView,
  wl: WorkloadView,
};

export function ScopeViewRoute({ scope, code }: { scope: ViewScope; code: string }) {
  const View = SCOPE_VIEW_BY_CODE[code] ?? ListView;
  return <View scope={scope} />;
}
