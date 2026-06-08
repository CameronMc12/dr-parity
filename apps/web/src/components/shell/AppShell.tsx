import type { ReactNode } from 'react';
import { AiAssistantPanel } from '@/components/ai-panel/AiAssistantPanel';
import { CreateTaskModal } from '@/components/create/CreateTaskModal';
import { InviteModal } from '@/components/invite/InviteModal';
import { SettingsModal } from '@/components/pages/settings/SettingsModal';
import { TaskModal } from '@/components/task/TaskModal';
import { IconBar } from './IconBar';
import { NotificationsBanner } from './NotificationsBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * AppShell — exact DOM structure of the ClickUp oracle (localhost:7050).
 *
 * Oracle layout (measured via Playwright getComputedStyle):
 *
 *   global-actions-bar  y=0,  h=40,  full width  ← workspace picker + search + icons
 *   cu-manager2         y=40, h=860, full width  ← rest of app
 *     cu-manager2__router-outlet  flex row
 *       cu-simple-bar   x=0,  w=64              ← IconBar (black)
 *       cu-manager2__body  x=64                 ← bg transparent
 *         cu-manager2__body-inner-wrapper        ← bg rgb(249,249,249)
 *           cu-manager2__body-inner              ← flex row
 *             cu-global-sidebar__container x=65, w=256  ← Sidebar
 *             cu-manager2__main x=321            ← home-top-bar + page content
 */

export function AppShell({
  children,
  wsId = '90152566819',
}: {
  children: ReactNode;
  wsId?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--cu-bg-app)',
      }}
    >
      {/* Global create-task modal — mounted once, controlled by ui-store */}
      <CreateTaskModal />

      {/* Global task-detail modal — overlays the active route, list stays behind */}
      <TaskModal wsId={wsId} />

      {/* Global centered Settings modal — opened via avatar menu or /settings */}
      <SettingsModal />

      {/* Global Invite-members modal — opened from the icon-rail Invite button */}
      <InviteModal />

      {/* global-actions-bar — full width, h=40, white bg */}
      <TopBar />

      {/* cu-manager2__container — all content below global topbar */}
      <div
        className="cu-manager2__container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          className="cu-manager2__container-inner"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* cu-manager2__router-outlet — flex row */}
          <div
            className="cu-manager2__router-outlet"
            style={{
              display: 'flex',
              flexDirection: 'row',
              flex: '1 1 0',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* cu-simple-bar — icon bar, black, 64px */}
            <IconBar />

            {/* cu-manager2__body — flex col, fills remaining */}
            <div
              className="cu-manager2__body cu-manager2__body_v4"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 0',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div
                className="cu-manager2__body-container"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flex: '1 1 0',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="cu-manager2__body-inner-wrapper"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flex: '1 1 0',
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* cu-manager2__body-inner — flex row */}
                  <div
                    className="cu-manager2__body-inner"
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      flex: '1 1 0',
                      minHeight: 0,
                      overflow: 'hidden',
                      background: 'var(--cu-bg-sidebar)',
                    }}
                  >
                    {/* cu-global-sidebar__container — Sidebar, 256px */}
                    <Sidebar wsId={wsId} />

                    {/* cu-manager2__main — main content, fills remaining */}
                    <main
                      className="cu-manager2__main"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: '1 1 0',
                        minWidth: 0,
                        overflow: 'hidden',
                        background: 'var(--cu-bg-app)',
                      }}
                    >
                      <NotificationsBanner />
                      {children}
                    </main>

                    {/* Right-docked Brain / Max AI panel — shrinks main when open */}
                    <AiAssistantPanel />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
