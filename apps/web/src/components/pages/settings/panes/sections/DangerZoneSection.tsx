'use client';

import { SettingsSection } from '../primitives';
import { GhostButton, DangerButton } from '../controls';

export function DangerZoneSection() {
  return (
    <SettingsSection label="Danger zone" description="Proceed with caution.">
      <p className="text-[13px] leading-snug text-[var(--cu-text-muted)]">
        Log out of all sessions including any session on mobile, iPad, and other
        browsers.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <GhostButton>Log out of all sessions</GhostButton>
        <DangerButton>Delete account</DangerButton>
      </div>
    </SettingsSection>
  );
}
