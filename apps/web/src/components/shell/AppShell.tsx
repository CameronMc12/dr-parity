import type { ReactNode } from 'react';
import { AiAssistantPanel } from '@/components/ai-panel/AiAssistantPanel';
import { CreateTaskModal } from '@/components/create/CreateTaskModal';
import { InviteModal } from '@/components/invite/InviteModal';
import { SettingsPage } from '@/components/pages/settings/SettingsPage';
import { TaskModal } from '@/components/task/TaskModal';
import { IconBar } from './IconBar';
import { NotificationsBanner } from './NotificationsBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUiStore } from '@/store/ui-store';

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
  const settingsOpen = useUiStore((s) => s.settingsOpen);

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
              padding: '0px 6px 6px 6px',
              gap: '6px',
              background: '#0e0e0e' // Dark background for the island container
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
                      gap: 0,
                      background: 'transparent',
                    }}
                  >
                    {settingsOpen ? (
                      /* Settings surface — spans both sidebar + main, fills
                         everything right of the icon rail, below the topbar.
                         The SettingsPage's own left column reuses the shell
                         sidebar slot treatment (256px, --cu-bg-sidebar, rounded
                         left corners) and its right panel rounds the right
                         corners, so the outer wrapper only supplies the border. */
                      <div
                        style={{
                          display: 'flex',
                          flex: '1 1 0',
                          minWidth: 0,
                          overflow: 'hidden',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <SettingsPage />
                      </div>
                    ) : (
                      <>
                        {/* cu-global-sidebar__container — Sidebar, 256px */}
                        <div style={{
                          width: 256,
                          flexShrink: 0,
                          borderTopLeftRadius: '6px',
                          borderBottomLeftRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRight: 'none',
                          overflow: 'hidden',
                          display: 'flex',
                          background: 'var(--cu-bg-sidebar)'
                        }}>
                          <Sidebar wsId={wsId} />
                        </div>

                        <main
                          className="cu-manager2__main"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: '1 1 0',
                            minWidth: 0,
                            overflow: 'hidden',
                            background: 'var(--cu-bg-app)',
                            borderTopRightRadius: '6px',
                            borderBottomRightRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <NotificationsBanner />
                          {children}
                        </main>

                        {/* Right-docked Brain / Max AI panel — shrinks main when open */}
                        <AiAssistantPanel />
                      </>
                    )}
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
