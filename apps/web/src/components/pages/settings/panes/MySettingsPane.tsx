'use client';

import { PaneTitle } from './primitives';
import { ProfileSection } from './sections/ProfileSection';
import { TwoFactorSection } from './sections/TwoFactorSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { ContrastSection } from './sections/ContrastSection';
import { LanguageRegionSection } from './sections/LanguageRegionSection';
import { TimeDateSection } from './sections/TimeDateSection';
import { PreferencesSection } from './sections/PreferencesSection';
import { LoginPermissionSection } from './sections/LoginPermissionSection';
import { DangerZoneSection } from './sections/DangerZoneSection';

/**
 * My Settings — the full long-scroll content pane. Each section is a two-column
 * row (left label + description, right controls) separated by dividers, matching
 * the ClickUp oracle. Composed from small per-section components.
 */
export function MySettingsPane() {
  return (
    <div className="max-w-4xl">
      <PaneTitle>My Settings</PaneTitle>
      <ProfileSection />
      <TwoFactorSection />
      <AppearanceSection />
      <ContrastSection />
      <LanguageRegionSection />
      <TimeDateSection />
      <PreferencesSection />
      <LoginPermissionSection />
      <DangerZoneSection />
    </div>
  );
}
