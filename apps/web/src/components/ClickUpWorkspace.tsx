'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AssignedCommentsPage } from '@/components/pages/AssignedCommentsPage';
import { ChannelPage } from '@/components/pages/ChannelPage';
import { ChatChannelRoute } from '@/components/pages/channel-view/ChatChannelRoute';
import { ChatDmPanel } from '@/components/pages/chat/ChatDmPanel';
import { NewDirectMessagePanel } from '@/components/pages/chat/NewDirectMessagePanel';
import { InboxPage } from '@/components/pages/InboxPage';
import { ListView, MyTasksListView } from '@/components/pages/ListView';
import { BoardView } from '@/components/pages/board/BoardView';
import { CalendarView } from '@/components/pages/calendar/CalendarView';
import { GanttView } from '@/components/pages/gantt/GanttView';
import { DocView } from '@/components/pages/doc/DocView';
import { TableView } from '@/components/pages/table/TableView';
import { TimelineView } from '@/components/pages/timeline/TimelineView';
import { WorkloadView } from '@/components/pages/workload/WorkloadView';
import { ActivityView } from '@/components/pages/activity/ActivityView';
import { MapView } from '@/components/pages/map/MapView';
import { MindMapView } from '@/components/pages/mindmap/MindMapView';
import { ChatView } from '@/components/pages/chatview/ChatView';
import { FormView } from '@/components/pages/form/FormView';
import { WhiteboardView } from '@/components/pages/whiteboard/WhiteboardView';
import { EmbedView } from '@/components/pages/embed/EmbedView';
import { DashboardView } from '@/components/pages/dashboard/DashboardView';
import { DashboardsHub } from '@/components/pages/dashboards-hub/DashboardsHub';
import { GoalsView } from '@/components/pages/goals/GoalsView';
import { DocsHub } from '@/components/pages/docs-hub/DocsHub';
import { AiHub } from '@/components/pages/ai/AiHub';
import { TeamsPage } from '@/components/pages/teams/TeamsPage';
import { WhiteboardsPage } from '@/components/pages/whiteboards/WhiteboardsPage';
import { TimesheetsPage } from '@/components/pages/timesheets/TimesheetsPage';
import { PlannerPage } from '@/components/pages/planner/PlannerPage';
import { TeamView } from '@/components/pages/team/TeamView';
import { RepliesPage } from '@/components/pages/RepliesPage';
import { TaskRoute } from '@/components/task/TaskRoute';
import { CuIconSprite } from '@/components/ui/CuIconSprite';
import { queryClient } from '@/lib/query-client';
import { Home } from '@/routes/Home';
import { ViewPlaceholder } from '@/routes/ViewPlaceholder';
import { SettingsRoute } from '@/components/pages/settings/SettingsRoute';
import { useShellStore } from '@/store/shell-store';
import { WorkspaceHydrator } from '@/store/workspace/WorkspaceHydrator';
import { ViewsHydrator } from '@/store/views/ViewsHydrator';
import { PreferencesHydrator } from '@/store/preferences/PreferencesHydrator';
import { resolveViewSegment } from '@/store/views';
import { VIEW_TO_LIST } from '@/data/workspace-tree';
import { ScopeViewRoute } from '@/components/views/ScopeViewRoute';
import type { ViewScope } from '@/lib/view-scope';
import type { IconBarItemId } from '@/types/workspace';

const DEFAULT_WS = '90152566819';

function renderRouteContent(route: string[], wsId: string) {
  const [, section, ...rest] = route;

  if (!section || section === 'home') {
    return <Home wsId={wsId} />;
  }

  if (section === 'inbox' || section === 'notifications') {
    return <InboxPage />;
  }

  // Goals hub: /<wsId>/goals. Icon-rail Goals navigates here.
  if (section === 'goals') {
    return <GoalsView />;
  }

  // Dashboards hub: /<wsId>/dashboards (distinct from the per-view dash widget
  // emitted under /v/dash/<id>). Icon-rail Dashboards navigates here.
  if (section === 'dashboards') {
    return <DashboardsHub />;
  }

  // Docs hub (All Docs): /<wsId>/docs. Distinct from the single-doc reader at
  // /v/dc/<docId>. Icon-rail Docs navigates here; rows open the single doc.
  if (section === 'docs') {
    return <DocsHub wsId={wsId} />;
  }

  // Icon-rail hub pages. Each is a self-contained skeleton surface that a
  // Phase 2 agent fleshes out without touching this dispatch.
  if (section === 'ai') {
    return <AiHub />;
  }
  if (section === 'teams') {
    return <TeamsPage />;
  }
  if (section === 'whiteboards') {
    return <WhiteboardsPage />;
  }
  if (section === 'timesheets') {
    return <TimesheetsPage />;
  }
  if (section === 'planner') {
    return <PlannerPage />;
  }

  // Task detail: /<wsId>/t/<taskId>. Direct navigation opens the global task
  // modal over My Tasks; in-app clicks from a list open it over their own list.
  if (section === 't' && rest[0]) {
    return <TaskRoute taskId={rest[0]} />;
  }

  // My Tasks (/my-work) renders the ClickUp List view driven by the current
  // member's tasks, grouped by status. The dashboard stays on /home.
  if (section === 'my-work') {
    return <MyTasksListView />;
  }

  // Replies (/chat/r/threads), Assigned Comments (/chat/r/assigned),
  // and channel chat (/chat/r/<channelId>).
  if (section === 'chat' && rest[0] === 'r') {
    if (rest[1] === 'threads') return <RepliesPage />;
    if (rest[1] === 'assigned') return <AssignedCommentsPage />;
    if (rest[1]) return <ChannelPage channelId={rest[1]} />;
  }

  // Chat section (icon-rail Chat). Home → New Direct Message; channel thread;
  // DM thread. Keeps the legacy /chat/r/* routes above untouched.
  if (section === 'chat') {
    if (rest[0] === 'c' && rest[1]) return <ChatChannelRoute channelId={rest[1]} />;
    if (rest[0] === 'dm' && rest[1]) return <ChatDmPanel dmId={rest[1]} />;
    return <NewDirectMessagePanel wsId={wsId} />;
  }

  // Settings is a centered modal (mounted globally in AppShell). The route
  // opens the modal over the My Tasks home behind it.
  if (section === 'settings') {
    return (
      <>
        <Home wsId={wsId} />
        <SettingsRoute section={rest[0]} />
      </>
    );
  }

  // Space-scoped views: /<wsId>/space/<spaceId>[/v/<code>[/<viewSeg>]].
  // Aggregates every task across the space's folderless lists + all folders'
  // lists. With no /v/<code> the route opens the scope's first stored view.
  if (section === 'space' && rest[0]) {
    const spaceId = rest[0];
    const scope: ViewScope = { kind: 'space', spaceId };
    const code = rest[1] === 'v' ? rest[2] : undefined;
    const viewId = rest[1] === 'v' ? rest[3] : undefined;
    return <ScopeViewRoute scope={scope} code={code} viewId={viewId} />;
  }

  // Folder-scoped views: /<wsId>/folder/<folderId>[/v/<code>[/<viewSeg>]].
  // Aggregates every task across the folder's lists.
  if (section === 'folder' && rest[0]) {
    const folderId = rest[0];
    const scope: ViewScope = { kind: 'folder', folderId };
    const code = rest[1] === 'v' ? rest[2] : undefined;
    const viewId = rest[1] === 'v' ? rest[3] : undefined;
    return <ScopeViewRoute scope={scope} code={code} viewId={viewId} />;
  }

  if (section === 'v') {
    const [viewType = '', viewId = '', pageId] = rest;
    // Doc keeps its own contract (docId + optional pageId).
    if (viewType === 'dc') {
      return <DocView docId={viewId} pageId={pageId} />;
    }
    if (!viewId) return <ViewPlaceholder viewType={viewType} viewId={viewId} />;
    // Resolve the view-id segment to its list via the views registry, falling
    // back to the legacy VIEW_TO_LIST token map or treating it as a raw listId.
    const listId =
      resolveViewSegment(viewId)?.scopeKey ?? VIEW_TO_LIST[viewId] ?? viewId;
    const listScope: ViewScope = { kind: 'list', listId };
    switch (viewType) {
      case 'l':
        return <ListView scope={listScope} />;
      case 'b':
        return <BoardView scope={listScope} />;
      case 'cal':
        return <CalendarView scope={listScope} />;
      case 'gtt':
        return <GanttView scope={listScope} />;
      case 'tbl':
        return <TableView scope={listScope} />;
      case 'tl':
        return <TimelineView scope={listScope} />;
      case 'wl':
        return <WorkloadView scope={listScope} />;
      case 'act':
        return <ActivityView viewId={viewId} />;
      case 'map':
        return <MapView viewId={viewId} />;
      case 'mm':
        return <MindMapView viewId={viewId} />;
      case 'dash':
        return <DashboardView viewId={viewId} />;
      case 'team':
        return <TeamView viewId={viewId} />;
      case 'chat':
        return <ChatView viewId={viewId} />;
      case 'form':
        return <FormView viewId={viewId} />;
      case 'wb':
        return <WhiteboardView viewId={viewId} />;
      case 'embed':
        return <EmbedView viewId={viewId} />;
      default:
        return <ViewPlaceholder viewType={viewType} viewId={viewId} />;
    }
  }

  return <Home wsId={wsId} />;
}

/**
 * Which icon-bar shell a route belongs to. `null` means "leave the current
 * shell alone" — used for `/v/` view routes so navigating between views/lists
 * does NOT yank the user out of whichever sidebar (Home or Spaces) they opened
 * the view from.
 */
function getRouteShellIcon(route: string[]): IconBarItemId | null {
  const section = route[1];

  if (section === 'space' || section === 'folder') return 'spaces';
  if (section === 'goals') return 'goals';
  if (section === 'dashboards') return 'dashboards';
  if (section === 'docs') return 'docs';
  if (section === 'ai') return 'ai';
  if (section === 'teams') return 'teams';
  if (section === 'whiteboards') return 'whiteboards';
  if (section === 'timesheets') return 'timesheets';
  if (section === 'planner') return 'planner';
  // /chat/r/* are Home-sidebar routes (Replies/Assigned); /chat and /chat/c|dm
  // belong to the Chat sidebar.
  if (section === 'chat' && route[2] !== 'r') return 'chat';
  if (section === 'v') return null;
  return 'home';
}

export function ClickUpWorkspace({ route }: { route: string[] }) {
  const wsId = route[0] ?? DEFAULT_WS;
  const routeShellIcon = getRouteShellIcon(route);
  const setRouteShell = useShellStore((state) => state.setRouteShell);

  useEffect(() => {
    if (routeShellIcon) setRouteShell(routeShellIcon);
  }, [routeShellIcon, setRouteShell]);

  return (
    <QueryClientProvider client={queryClient}>
      <CuIconSprite />
      <WorkspaceHydrator />
      <ViewsHydrator />
      <PreferencesHydrator />
      <AppShell wsId={wsId}>{renderRouteContent(route, wsId)}</AppShell>
    </QueryClientProvider>
  );
}
