/**
 * Settings nav structure — mirrors the ClickUp oracle "All settings" modal
 * (docs/research/crawl/app.clickup.com/deep-settings/states/state-0001).
 *
 * Four grouped sections in oracle order: Admin, Features,
 * Integrations & ClickApps, My Settings. Each item maps to a detail pane key.
 * Items without a bespoke pane render a faithful placeholder; the NAV structure
 * matches the oracle exactly.
 */

export type SettingsItemKey = string;

export interface SettingsNavItem {
  key: SettingsItemKey;
  label: string;
  icon: string; // glyph id consumed by SettingsNavIcon
}

export interface SettingsNavGroup {
  title: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    title: 'Admin',
    items: [
      { key: 'general', label: 'General', icon: 'gear' },
      { key: 'people', label: 'People', icon: 'people' },
      { key: 'teams', label: 'Teams', icon: 'teams' },
      { key: 'billing', label: 'Billing', icon: 'billing' },
      { key: 'ai-usage', label: 'AI Usage', icon: 'spark' },
      { key: 'security', label: 'Security & Permissions', icon: 'shield' },
      { key: 'audit-logs', label: 'Audit Logs', icon: 'list' },
      { key: 'trash', label: 'Trash', icon: 'trash' },
    ],
  },
  {
    title: 'Features',
    items: [
      { key: 'custom-fields', label: 'Custom Field Manager', icon: 'field' },
      { key: 'template-center', label: 'Template Center', icon: 'template' },
      { key: 'automations', label: 'Automations Manager', icon: 'spark' },
      { key: 'ai-notetaker', label: 'AI Notetaker', icon: 'note' },
      { key: 'spaces', label: 'Spaces', icon: 'spaces' },
      { key: 'work-schedule', label: 'Work Schedule', icon: 'clock' },
    ],
  },
  {
    title: 'Integrations & ClickApps',
    items: [
      { key: 'app-center', label: 'App Center', icon: 'apps' },
      { key: 'imports-exports', label: 'Imports / Exports', icon: 'import' },
      { key: 'clickup-api', label: 'ClickUp API', icon: 'api' },
      { key: 'email-integration', label: 'Email Integration', icon: 'mail' },
    ],
  },
  {
    title: 'My Settings',
    items: [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
      { key: 'appearance', label: 'Appearance', icon: 'palette' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'apps', label: 'Connected Apps', icon: 'apps' },
      { key: 'preferences', label: 'Settings', icon: 'sliders' },
    ],
  },
];

const PANE_KEYS = new Set(
  SETTINGS_NAV.flatMap((g) => g.items.map((i) => i.key))
);

export function isKnownSettingsKey(key: string): boolean {
  return PANE_KEYS.has(key);
}

/** Human label for a section key, for placeholder panes / route titles. */
export function settingsLabel(key: string): string {
  for (const group of SETTINGS_NAV) {
    const item = group.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return key;
}
