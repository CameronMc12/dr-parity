/**
 * Settings route surface. Each section component reads from and writes to the
 * persisted preferences store (src/store/preferences), so changes survive a
 * reload. `renderSettingsRoute` maps a section key (the same keys used by
 * ui-store.settingsSection and SettingsSidebar) to its pane.
 */

import type { ReactNode } from 'react';
import { Account } from './Account';
import { Notifications } from './Notifications';
import { Preferences } from './Preferences';
import { Security } from './Security';
import { Billing } from './Billing';
import { Members } from './Members';
import { Integrations } from './Integrations';
import { SettingsPlaceholder } from './SettingsPlaceholder';

export { Account } from './Account';
export { Notifications } from './Notifications';
export { Preferences } from './Preferences';
export { Security } from './Security';
export { Billing } from './Billing';
export { Members } from './Members';
export { Integrations } from './Integrations';
export { SettingsLayout } from './SettingsLayout';
export { SettingsPlaceholder } from './SettingsPlaceholder';

const PLACEHOLDERS: Record<string, { title: string; description: string }> = {
  calendar: {
    title: 'Calendar',
    description: 'Connect external calendars and set scheduling defaults.',
  },
  apps: {
    title: 'Apps',
    description: 'Manage connected apps and ClickApps for your account.',
  },
  teams: {
    title: 'Teams',
    description: 'Organise members into teams.',
  },
  'ai-usage': {
    title: 'AI Usage',
    description: 'Track AI credits and usage across the workspace.',
  },
  'audit-logs': {
    title: 'Audit Logs',
    description: 'Review security and activity logs.',
  },
  trash: {
    title: 'Trash',
    description: 'Restore or permanently delete removed items.',
  },
};

export function renderSettingsRoute(section: string): ReactNode {
  switch (section) {
    case 'profile':
    case 'account':
      return <Account />;
    case 'notifications':
      return <Notifications />;
    case 'preferences':
      return <Preferences />;
    case 'security':
      return <Security />;
    case 'billing':
      return <Billing />;
    case 'people':
    case 'workspaces':
      return <Members />;
    case 'apps':
      return <Integrations />;
    default: {
      const meta = PLACEHOLDERS[section];
      return (
        <SettingsPlaceholder
          title={meta?.title ?? 'Settings'}
          description={meta?.description ?? 'This section is coming soon.'}
        />
      );
    }
  }
}
