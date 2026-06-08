/**
 * Persisted user-preferences store. Mirrors the views/workspace persist
 * conventions: curried `create<State>()(persist(...))`, versioned localStorage
 * key, `skipHydration` (so SSR renders the deterministic defaults and the client
 * rehydrates once via PreferencesHydrator), immutable section updates via
 * shallow patch merge.
 *
 * Public API:
 *   usePreferences / *section* hooks   — convenience hooks (./hooks)
 *   usePreferencesStore.persist        — persist controls (rehydrate)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PreferencesState } from './types';

export const PREFERENCES_STORAGE_KEY = 'parity-preferences-v1';

const DEFAULT_PROFILE = {
  name: 'Cameron M',
  email: 'cameron12mcallister@gmail.com',
  role: 'Owner',
  timezone: 'Africa/Johannesburg',
} as const;

const DEFAULT_APPEARANCE = {
  theme: 'dark',
  sidebarDensity: 'comfortable',
} as const;

const DEFAULT_NOTIFICATIONS = {
  emailDigest: false,
  mentions: true,
  assignments: true,
} as const;

const DEFAULT_GENERAL = {
  startOfWeek: 'monday',
  timeFormat: '12h',
  defaultHomeView: 'home',
} as const;

const DEFAULT_SECURITY = {
  twoFactorEnabled: false,
} as const;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      profile: { ...DEFAULT_PROFILE },
      appearance: { ...DEFAULT_APPEARANCE },
      notifications: { ...DEFAULT_NOTIFICATIONS },
      general: { ...DEFAULT_GENERAL },
      security: { ...DEFAULT_SECURITY },

      setProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
      setAppearance: (patch) =>
        set((s) => ({ appearance: { ...s.appearance, ...patch } })),
      setNotifications: (patch) =>
        set((s) => ({ notifications: { ...s.notifications, ...patch } })),
      setGeneral: (patch) =>
        set((s) => ({ general: { ...s.general, ...patch } })),
      setSecurity: (patch) =>
        set((s) => ({ security: { ...s.security, ...patch } })),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        profile: state.profile,
        appearance: state.appearance,
        notifications: state.notifications,
        general: state.general,
        security: state.security,
      }),
    },
  ),
);

export type { PreferencesState } from './types';
