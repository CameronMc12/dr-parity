'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
import { isKnownSettingsKey } from './settings-nav';

/**
 * /settings route bridge. The Settings surface is a centered modal (mounted
 * globally in AppShell), so the route simply opens that modal — mapping the
 * URL section segment to a nav key — and renders the My Tasks home behind it.
 * Closing the modal (Esc / scrim / Save) leaves the user on Home.
 *
 * Legacy section keys from the old inline panel are remapped so deep links keep
 * working: account/workspaces → preferences, members → people.
 */
const LEGACY_MAP: Record<string, string> = {
  account: 'preferences',
  workspaces: 'preferences',
  members: 'people',
  integrations: 'app-center',
};

export function SettingsRoute({ section }: { section?: string }) {
  const openSettings = useUiStore((s) => s.openSettings);

  useEffect(() => {
    const raw = section ?? 'profile';
    const mapped = LEGACY_MAP[raw] ?? raw;
    openSettings(isKnownSettingsKey(mapped) ? mapped : 'profile');
  }, [section, openSettings]);

  return null;
}
