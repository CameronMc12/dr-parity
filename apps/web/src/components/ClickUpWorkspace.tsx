'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AssignedCommentsPage } from '@/components/pages/AssignedCommentsPage';
import { ChannelPage } from '@/components/pages/ChannelPage';
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
import { TeamView } from '@/components/pages/team/TeamView';
import { RepliesPage } from '@/components/pages/RepliesPage';
import { TaskRoute } from '@/components/task/TaskRoute';
import { CuIconSprite } from '@/components/ui/CuIconSprite';
import { queryClient } from '@/lib/query-client';
import { Home } from '@/routes/Home';
import { ViewPlaceholder } from '@/routes/ViewPlaceholder';
import { Account } from '@/routes/settings/Account';
import { Billing } from '@/routes/settings/Billing';
import { Integrations } from '@/routes/settings/Integrations';
import { Members } from '@/routes/settings/Members';
import { Notifications as SettingsNotifications } from '@/routes/settings/Notifications';
import { Preferences } from '@/routes/settings/Preferences';
import { Security } from '@/routes/settings/Security';
import { SettingsLayout } from '@/routes/settings/SettingsLayout';
import { SettingsPlaceholder } from '@/routes/settings/SettingsPlaceholder';
import { useShellStore } from '@/store/shell-store';
import { WorkspaceHydrator } from '@/store/workspace/WorkspaceHydrator';
import { ViewsHydrator } from '@/store/views/ViewsHydrator';
import { resolveViewSegment } from '@/store/views';
import { VIEW_TO_LIST } from '@/data/workspace-tree';
import { ScopeViewRoute } from '@/components/views/ScopeViewRoute';
import type { ViewScope } from '@/lib/view-scope';
import type { IconBarItemId } from '@/types/workspace';

const DEFAULT_WS = '90152566819';

function renderSettingsContent(section = 'account') {
  switch (section) {
    case 'account':
      return <Account />;
    case 'notifications':
      return <SettingsNotifications />;
    case 'members':
    case 'people':
      return <Members />;
    case 'integrations':
      return <Integrations />;
    case 'billing':
      return <Billing />;
    case 'security':
      return <Security />;
    case 'preferences':
      return <Preferences />;
    case 'teams':
      return <SettingsPlaceholder title="Teams" description="Manage workspace teams." />;
    case 'ai-usage':
      return <SettingsPlaceholder title="AI Usage" description="View your AI credit usage." />;
    case 'audit-logs':
      return <SettingsPlaceholder title="Audit Logs" description="View workspace activity logs." />;
    case 'trash':
      return <SettingsPlaceholder title="Trash" description="Recover recently deleted items." />;
    case 'workspaces':
      return <SettingsPlaceholder title="Workspaces" description="Switch or manage workspaces." />;
    default:
      return <SettingsPlaceholder title={section} description="Settings section placeholder." />;
  }
}

function renderRouteContent(route: string[], wsId: string) {
  const [, section, ...rest] = route;

  if (!section || section === 'home') {
    return <Home wsId={wsId} />;
  }

  if (section === 'inbox' || section === 'notifications') {
    return <InboxPage />;
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

  if (section === 'settings') {
    const activeSection = rest[0] ?? 'account';
    return (
      <SettingsLayout wsId={wsId} activeSection={activeSection}>
        {renderSettingsContent(activeSection)}
      </SettingsLayout>
    );
  }

  // Space-scoped views: /<wsId>/space/<spaceId>[/v/<code>]. Aggregates every
  // task across the space's folderless lists + all folders' lists.
  if (section === 'space' && rest[0]) {
    const spaceId = rest[0];
    const code = rest[1] === 'v' ? rest[2] ?? 'l' : 'l';
    return <ScopeViewRoute scope={{ kind: 'space', spaceId }} code={code} />;
  }

  // Folder-scoped views: /<wsId>/folder/<folderId>[/v/<code>]. Aggregates every
  // task across the folder's lists.
  if (section === 'folder' && rest[0]) {
    const folderId = rest[0];
    const code = rest[1] === 'v' ? rest[2] ?? 'l' : 'l';
    return <ScopeViewRoute scope={{ kind: 'folder', folderId }} code={code} />;
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
      resolveViewSegment(viewId)?.listId ?? VIEW_TO_LIST[viewId] ?? viewId;
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
      <AppShell wsId={wsId}>{renderRouteContent(route, wsId)}</AppShell>
    </QueryClientProvider>
  );
}
