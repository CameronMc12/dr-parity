import type { ReactNode } from 'react';
import * as Separator from '@radix-ui/react-separator';

// Mirrors actual sections observed in the live clone settings sidebar
const WORKSPACE_SECTIONS = [
  { key: 'people',      label: 'People' },
  { key: 'teams',       label: 'Teams' },
  { key: 'billing',     label: 'Upgrade' },
  { key: 'ai-usage',    label: 'AI Usage' },
  { key: 'audit-logs',  label: 'Audit Logs' },
  { key: 'trash',       label: 'Trash' },
];

const MY_SETTINGS_SECTIONS = [
  { key: 'account',       label: 'Profile' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'preferences',   label: 'Preferences' },
  { key: 'calendar',      label: 'Calendar' },
  { key: 'apps',          label: 'Apps' },
  { key: 'security',      label: 'Security' },
];

function NavSection({
  title,
  items,
  wsId,
  activeSection,
}: {
  title: string;
  items: { key: string; label: string }[];
  wsId: string;
  activeSection?: string;
}) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-semibold text-[var(--cu-text-muted)] uppercase tracking-wider">
        {title}
      </p>
      {items.map((item) => (
        <a
          key={item.key}
          href={`/${wsId}/settings/${item.key}`}
          className={`
            flex items-center w-full px-3 py-2 rounded-[var(--cu-radius-md)] text-xs
            transition-colors cursor-pointer
            ${
              activeSection === item.key
                ? 'bg-[var(--cu-bg-active)] text-[var(--cu-text-primary)] font-medium'
                : 'text-[var(--cu-text-secondary)] hover:bg-[var(--cu-bg-hover)] hover:text-[var(--cu-text-primary)]'
            }
          `}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function SettingsLayout({
  children,
  wsId = '90152566819',
  activeSection = 'account',
}: {
  children: ReactNode;
  wsId?: string;
  activeSection?: string;
}) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings left sub-sidebar */}
      <aside
        aria-label="Settings navigation"
        className="
          w-52 shrink-0 h-full flex flex-col
          bg-[var(--cu-bg-sidebar)]
          border-r border-[var(--cu-border-divider)]
          overflow-y-auto
        "
      >
        <div className="px-3 py-4">
          <h2 className="text-[var(--cu-text-primary)] text-sm font-semibold">
            Settings
          </h2>
        </div>

        <Separator.Root
          orientation="horizontal"
          className="h-px bg-[var(--cu-border-divider)] mx-3 mb-4"
        />

        <nav className="px-2 flex-1">
          <NavSection
            title="Workspace"
            items={WORKSPACE_SECTIONS}
            wsId={wsId}
            activeSection={activeSection}
          />
          <NavSection
            title="My Settings"
            items={MY_SETTINGS_SECTIONS}
            wsId={wsId}
            activeSection={activeSection}
          />
        </nav>
      </aside>

      {/* Settings content area */}
      <div className="flex-1 min-w-0 overflow-auto bg-[var(--cu-bg-app)]">
        {children}
      </div>
    </div>
  );
}
