'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
import { SETTINGS_NAV } from './settings-nav';
import { SettingsNavIcon } from './SettingsNavIcon';
import { ProfilePane } from './panes/ProfilePane';
import { NotificationsPane } from './panes/NotificationsPane';
import { AppearancePane } from './panes/AppearancePane';
import { PreferencesPane } from './panes/PreferencesPane';
import { PlaceholderPane } from './panes/PlaceholderPane';

function renderPane(section: string) {
  switch (section) {
    case 'profile':
      return <ProfilePane />;
    case 'notifications':
      return <NotificationsPane />;
    case 'appearance':
      return <AppearancePane />;
    case 'preferences':
      return <PreferencesPane />;
    default:
      return <PlaceholderPane sectionKey={section} />;
  }
}

/**
 * Centered Settings modal overlay — matches the ClickUp oracle "All settings"
 * surface (docs/research/crawl/app.clickup.com/deep-settings/state-0001):
 *
 *   - dimmed full-screen scrim over the app canvas
 *   - centered rounded card, ~1140px wide
 *   - left grouped nav: "All settings" header, Admin / Features /
 *     Integrations & ClickApps / My Settings, Log out + Upgrade pinned bottom
 *   - right scrolling detail pane with Save changes pinned bottom-right
 *
 * Controlled by ui-store (settingsOpen / settingsSection). The /settings route
 * opens it on mount; the avatar menu opens it on click.
 */
export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);
  const close = useUiStore((s) => s.closeSettings);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All settings"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: 24,
      }}
    >
      <div
        className="bg-[var(--cu-bg-app)]"
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 1140,
          height: '100%',
          maxHeight: 760,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          border: '1px solid var(--cu-border-divider)',
        }}
      >
        {/* Left grouped nav */}
        <aside
          className="bg-[var(--cu-bg-sidebar)] border-r border-[var(--cu-border-divider)]"
          style={{
            width: 256,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold text-[var(--cu-text-primary)]">
              All settings
            </h2>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            {SETTINGS_NAV.map((group) => (
              <div key={group.title} className="mb-3">
                <p className="px-3 mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cu-text-muted)]">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const active = item.key === section;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSection(item.key)}
                      className={`flex items-center gap-2.5 w-full px-3 py-[7px] rounded-[var(--cu-radius-md)] text-[13px] text-left transition-colors ${
                        active
                          ? 'bg-[var(--cu-bg-active)] text-[var(--cu-text-primary)] font-medium'
                          : 'text-[var(--cu-text-secondary)] hover:bg-[var(--cu-bg-hover)] hover:text-[var(--cu-text-primary)]'
                      }`}
                    >
                      <span className="text-[var(--cu-text-muted)]">
                        <SettingsNavIcon glyph={item.icon} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Log out + Upgrade pinned bottom */}
          <div className="border-t border-[var(--cu-border-divider)] px-2 py-2">
            <button
              type="button"
              onClick={close}
              className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-[var(--cu-radius-md)] text-[13px] text-[var(--cu-text-secondary)] hover:bg-[var(--cu-bg-hover)] transition-colors"
            >
              <span className="text-[var(--cu-text-muted)]">
                <SettingsNavIcon glyph="logout" />
              </span>
              Log out
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-[var(--cu-radius-md)] text-[13px] font-medium text-[var(--cu-accent)] hover:bg-[var(--cu-bg-hover)] transition-colors"
            >
              <span>
                <SettingsNavIcon glyph="upgrade" />
              </span>
              Upgrade
            </button>
          </div>
        </aside>

        {/* Right detail pane */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          <div className="flex-1 overflow-y-auto px-12 py-8">
            <div className="max-w-[760px]">{renderPane(section)}</div>
          </div>

          {/* Save changes pinned bottom-right */}
          <div className="absolute bottom-5 right-6">
            <button
              type="button"
              onClick={close}
              className="h-9 px-4 rounded-[var(--cu-radius-md)] text-[13px] font-medium bg-[var(--cu-grey-900)] text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
