// Settings nav sections as observed from live clone settings page
const WORKSPACE_SECTIONS = [
  { key: 'people',      label: 'People',           path: 'people' },
  { key: 'teams',       label: 'Teams',             path: 'teams' },
  { key: 'billing',     label: 'Upgrade',           path: 'billing' },
  { key: 'ai-usage',    label: 'AI Usage',          path: 'ai-usage' },
  { key: 'audit-logs',  label: 'Audit Logs',        path: 'audit-logs' },
  { key: 'trash',       label: 'Trash',             path: 'trash' },
];

const MY_SETTINGS_SECTIONS = [
  { key: 'account',       label: 'Preferences',    path: 'account' },
  { key: 'notifications', label: 'Notifications',  path: 'notifications' },
  { key: 'workspaces',    label: 'Workspaces',      path: 'workspaces' },
  { key: 'security',      label: 'Security',        path: 'security' },
];

function SectionGroup({
  title,
  items,
  wsId,
}: {
  title: string;
  items: { key: string; label: string; path: string }[];
  wsId: string;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 mb-1 text-[10px] font-semibold text-[var(--cu-text-muted)] uppercase tracking-wider">
        {title}
      </p>
      {items.map((item) => (
        <a
          key={item.key}
          href={`/${wsId}/settings/${item.path}`}
          className="
            flex items-center w-full px-3 py-1.5 rounded-[var(--cu-radius-md)] text-xs
            transition-colors cursor-pointer
            text-[var(--cu-text-secondary)] hover:bg-[var(--cu-bg-hover)] hover:text-[var(--cu-text-primary)]
          "
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function SettingsSidebar({ wsId }: { wsId: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 mb-1">
        <span className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider">
          Settings
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <SectionGroup title="Workspace" items={WORKSPACE_SECTIONS} wsId={wsId} />
        <SectionGroup title="My Settings" items={MY_SETTINGS_SECTIONS} wsId={wsId} />
      </div>
    </div>
  );
}
