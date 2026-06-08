import type { ReactNode } from 'react';
import { useShellStore } from '@/store/shell-store';
import { HomeSidebar } from './sidebars/HomeSidebar';
import { ChatSidebar } from './sidebars/ChatSidebar';
import { DocsSidebar } from './sidebars/DocsSidebar';
import { SpacesSidebar } from './sidebars/SpacesSidebar';
import { SettingsSidebar } from './sidebars/SettingsSidebar';
import { AiSidebar } from './sidebars/AiSidebar';
import { PlannerSidebar } from './sidebars/PlannerSidebar';
import { TeamsSidebar } from './sidebars/TeamsSidebar';
import { DashboardsSidebar } from './sidebars/DashboardsSidebar';
import { WhiteboardsSidebar } from './sidebars/WhiteboardsSidebar';
import { GoalsSidebar } from './sidebars/GoalsSidebar';

const SIDEBAR_MAP: Record<string, ReactNode> = {
  home:        <HomeSidebar />,
  spaces:      <SpacesSidebar />,
  chat:        <ChatSidebar />,
  planner:     <PlannerSidebar />,
  ai:          <AiSidebar />,
  teams:       <TeamsSidebar />,
  docs:        <DocsSidebar />,
  dashboards:  <DashboardsSidebar />,
  whiteboards: <WhiteboardsSidebar />,
  goals:       <GoalsSidebar />,
  // Timesheets: no sidebar in ClickUp; full-width Time view is future feature work
  timesheets:  null,
  settings:    null, // rendered with wsId prop below
};

interface SidebarProps {
  wsId: string;
}

export function Sidebar({ wsId }: SidebarProps) {
  const { activeIcon, sidebarOpen, sidebarWidth } = useShellStore();

  const content =
    activeIcon === 'settings' ? (
      <SettingsSidebar wsId={wsId} />
    ) : (
      SIDEBAR_MAP[activeIcon]
    );

  // Timesheets has no sidebar in ClickUp; collapse the column so main content
  // takes full width. Same effect when sidebar is toggled closed.
  const collapsed = !sidebarOpen || content == null;
  const effectiveWidth = collapsed ? 0 : sidebarWidth;

  return (
    // Matches ClickUp: <div class="cu-global-sidebar__container ...">
    <div
      className="cu-global-sidebar__container"
      aria-label={`${activeIcon} sidebar`}
      style={{
        width: effectiveWidth,
        minWidth: effectiveWidth,
        transition: 'width 150ms ease, min-width 150ms ease',
      }}
    >
      <div
        className="cu-global-sidebar__container-sidebar"
        style={{ width: sidebarWidth }}
      >
        {content}
      </div>
    </div>
  );
}
