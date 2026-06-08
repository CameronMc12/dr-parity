'use client';

/**
 * Scope-aware view dispatcher. Given a `scope` (list | space | folder), an
 * optional view `code`, and an optional view-instance `viewId` segment, it
 * resolves the active view from the scope's stored view set and renders the
 * matching body.
 *
 * Two body families:
 *  - DATA views (List, Board, Calendar, Gantt, Table, Timeline, Workload,
 *    Activity, Map, Mind Map, Dashboard) derive every task/status/config from the
 *    scope hooks, so the same body renders a single list, an entire folder, or an
 *    entire space. They take `{ scope }` (and Activity/Map/MindMap/Dashboard also
 *    accept an explicit `viewId` for per-view persistence).
 *  - APP views (Doc, Chat, Form, Whiteboard, Embed, Team) are creation-oriented
 *    and resolve the scope's default/first list. They take `{ scope, viewId }`.
 *
 * Default-view resolution: with no `code` the route opens the scope's FIRST
 * stored view (parity with how lists open their first view), not a hardcoded 'l'.
 */

import { ListView } from '@/components/pages/ListView';
import { BoardView } from '@/components/pages/board/BoardView';
import { CalendarView } from '@/components/pages/calendar/CalendarView';
import { GanttView } from '@/components/pages/gantt/GanttView';
import { TableView } from '@/components/pages/table/TableView';
import { TimelineView } from '@/components/pages/timeline/TimelineView';
import { WorkloadView } from '@/components/pages/workload/WorkloadView';
import { ActivityView } from '@/components/pages/activity/ActivityView';
import { MapView } from '@/components/pages/map/MapView';
import { MindMapView } from '@/components/pages/mindmap/MindMapView';
import { DashboardView } from '@/components/pages/dashboard/DashboardView';
import { TeamView } from '@/components/pages/team/TeamView';
import { DocView } from '@/components/pages/doc/DocView';
import { ChatView } from '@/components/pages/chatview/ChatView';
import { ChannelView } from '@/components/pages/channel-view/ChannelView';
import { FormView } from '@/components/pages/form/FormView';
import { WhiteboardView } from '@/components/pages/whiteboard/WhiteboardView';
import { EmbedView } from '@/components/pages/embed/EmbedView';
import { scopeKey, type ViewScope } from '@/lib/view-scope';
import { useScopeViews } from '@/store/views/hooks';

/** Codes whose bodies render purely off the scope (single `{ scope }` prop). */
const SCOPE_ONLY = {
  l: ListView,
  b: BoardView,
  cal: CalendarView,
  gtt: GanttView,
  tbl: TableView,
  tl: TimelineView,
  wl: WorkloadView,
} as const;

export function ScopeViewRoute({
  scope,
  code,
  viewId,
}: {
  scope: ViewScope;
  /** Active view code. Undefined => open the scope's first stored view. */
  code?: string;
  /** Explicit view-instance segment. Undefined => the scope's first view id. */
  viewId?: string;
}) {
  // Resolve the scope's stored/templated views so a missing code/viewId can fall
  // back to the FIRST view (same default-open behaviour lists already have).
  // useScopeViews is useShallow-stable, so this never churns references.
  const views = useScopeViews(scopeKey(scope));
  const first = views[0];
  const activeCode = code ?? first?.code ?? 'l';
  // Default-template instances all share id === scopeKey; the matching instance
  // for the active code is the first stored view of that code, else the scopeKey.
  const resolvedViewId =
    viewId ?? views.find((v) => v.code === activeCode)?.id ?? scopeKey(scope);

  const ScopeOnly = SCOPE_ONLY[activeCode as keyof typeof SCOPE_ONLY];
  if (ScopeOnly) return <ScopeOnly scope={scope} />;

  switch (activeCode) {
    // Data views that also persist per-view UI state.
    case 'act':
      return <ActivityView scope={scope} viewId={resolvedViewId} />;
    case 'map':
      return <MapView scope={scope} viewId={resolvedViewId} />;
    case 'mm':
      return <MindMapView scope={scope} viewId={resolvedViewId} />;
    case 'dash':
      return <DashboardView scope={scope} viewId={resolvedViewId} />;
    // App / creation-oriented views resolving the scope's default list.
    case 'team':
      return <TeamView scope={scope} viewId={resolvedViewId} />;
    case 'dc':
      return <DocView scope={scope} docId={resolvedViewId} />;
    case 'channel':
      return <ChannelView scope={scope} viewId={resolvedViewId} />;
    case 'chat':
      return <ChatView scope={scope} viewId={resolvedViewId} />;
    case 'form':
      return <FormView scope={scope} viewId={resolvedViewId} />;
    case 'wb':
      return <WhiteboardView scope={scope} viewId={resolvedViewId} />;
    case 'embed':
      return <EmbedView scope={scope} viewId={resolvedViewId} />;
    default:
      return <ListView scope={scope} />;
  }
}
