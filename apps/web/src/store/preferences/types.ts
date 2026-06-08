/**
 * Persisted user-preferences store types. Holds the realistic settings surfaced
 * by the Settings routes (profile, appearance, notifications, preferences,
 * security). Persisted to localStorage under `parity-preferences-v1` with the
 * same conventions as the views/workspace stores: skipHydration + a client
 * hydrator, versioned key, immutable updates.
 */

export type Theme = 'system' | 'light' | 'dark';
export type SidebarDensity = 'comfortable' | 'compact';
export type StartOfWeek = 'sunday' | 'monday';
export type TimeFormat = '12h' | '24h';
export type DefaultHomeView = 'home' | 'inbox' | 'dashboard' | 'docs';

export interface ProfilePrefs {
  name: string;
  email: string;
  role: string;
  timezone: string;
}

export interface AppearancePrefs {
  theme: Theme;
  sidebarDensity: SidebarDensity;
}

export interface NotificationPrefs {
  emailDigest: boolean;
  mentions: boolean;
  assignments: boolean;
}

export interface GeneralPrefs {
  startOfWeek: StartOfWeek;
  timeFormat: TimeFormat;
  defaultHomeView: DefaultHomeView;
}

export interface SecurityPrefs {
  twoFactorEnabled: boolean;
}

export interface PreferencesState {
  profile: ProfilePrefs;
  appearance: AppearancePrefs;
  notifications: NotificationPrefs;
  general: GeneralPrefs;
  security: SecurityPrefs;

  setProfile: (patch: Partial<ProfilePrefs>) => void;
  setAppearance: (patch: Partial<AppearancePrefs>) => void;
  setNotifications: (patch: Partial<NotificationPrefs>) => void;
  setGeneral: (patch: Partial<GeneralPrefs>) => void;
  setSecurity: (patch: Partial<SecurityPrefs>) => void;
}
