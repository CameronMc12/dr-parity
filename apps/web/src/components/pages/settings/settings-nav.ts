/**
 * Settings nav structure — mirrors the ClickUp "All settings" in-content page.
 *
 * Three grouped sections render in oracle order: Admin, Features, Integrations &
 * ClickApps. The list starts at Admin/General (no standalone top item). Each
 * item maps to a detail pane key consumed by SettingsPage's pane switch. Items
 * without a bespoke pane render a faithful placeholder.
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

/** Default section — resolves the legacy 'profile' / 'my-settings' defaults too. */
export const DEFAULT_SETTINGS_SECTION = 'general';

/**
 * Legacy top-level "My Settings" item. No longer rendered in the nav (the
 * screenshot starts at Admin/General) but kept so its pane key still resolves.
 */
export const MY_SETTINGS_ITEM: SettingsNavItem = {
  key: 'my-settings',
  label: 'My Settings',
  icon: 'user',
};

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
      { key: 'task-types', label: 'Task Types', icon: 'field' },
      { key: 'work-schedule', label: 'Work Schedule', icon: 'clock' },
    ],
  },
  {
    title: 'Integrations & ClickApps',
    items: [
      { key: 'app-center', label: 'App Center', icon: 'appCenter' },
      { key: 'imports-exports', label: 'Imports / Exports', icon: 'import' },
      { key: 'clickup-api', label: 'ClickUp API', icon: 'api' },
      { key: 'email-integration', label: 'Email Integration', icon: 'mail' },
    ],
  },
];

const PANE_KEYS = new Set([
  MY_SETTINGS_ITEM.key,
  ...SETTINGS_NAV.flatMap((g) => g.items.map((i) => i.key)),
]);

export function isKnownSettingsKey(key: string): boolean {
  return PANE_KEYS.has(key);
}

/**
 * Resolve a raw ui-store section to a known nav key. The legacy default
 * 'profile' maps onto the new 'general' default section; any unknown key
 * falls back to 'general' as well.
 */
export function resolveSettingsSection(key: string): string {
  if (key === 'profile' || !isKnownSettingsKey(key)) {
    return DEFAULT_SETTINGS_SECTION;
  }
  return key;
}

/** Human label for a section key, for placeholder panes / route titles. */
export function settingsLabel(key: string): string {
  if (key === MY_SETTINGS_ITEM.key) return MY_SETTINGS_ITEM.label;
  for (const group of SETTINGS_NAV) {
    const item = group.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return key;
}
