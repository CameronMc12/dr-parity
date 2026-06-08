/**
 * Convenience hooks for the persisted preferences store. Each section hook
 * subscribes to its slice; action hooks return stable function refs.
 */

import { usePreferencesStore } from './index';
import type {
  ProfilePrefs,
  AppearancePrefs,
  NotificationPrefs,
  GeneralPrefs,
  SecurityPrefs,
} from './types';

export function useProfilePrefs(): ProfilePrefs {
  return usePreferencesStore((s) => s.profile);
}

export function useAppearancePrefs(): AppearancePrefs {
  return usePreferencesStore((s) => s.appearance);
}

export function useNotificationPrefs(): NotificationPrefs {
  return usePreferencesStore((s) => s.notifications);
}

export function useGeneralPrefs(): GeneralPrefs {
  return usePreferencesStore((s) => s.general);
}

export function useSecurityPrefs(): SecurityPrefs {
  return usePreferencesStore((s) => s.security);
}

export function useSetProfile(): (patch: Partial<ProfilePrefs>) => void {
  return usePreferencesStore((s) => s.setProfile);
}

export function useSetAppearance(): (patch: Partial<AppearancePrefs>) => void {
  return usePreferencesStore((s) => s.setAppearance);
}

export function useSetNotifications(): (patch: Partial<NotificationPrefs>) => void {
  return usePreferencesStore((s) => s.setNotifications);
}

export function useSetGeneral(): (patch: Partial<GeneralPrefs>) => void {
  return usePreferencesStore((s) => s.setGeneral);
}

export function useSetSecurity(): (patch: Partial<SecurityPrefs>) => void {
  return usePreferencesStore((s) => s.setSecurity);
}
