'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  useProfilePrefs,
  useSetProfile,
  useAppearancePrefs,
  useSetAppearance,
} from '@/store/preferences/hooks';
import {
  SettingsRow,
  TextInput,
  ToggleSwitch,
  SelectInput,
} from './controls';
import type { Theme } from '@/store/preferences/types';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Account() {
  const profile = useProfilePrefs();
  const setProfile = useSetProfile();
  const appearance = useAppearancePrefs();
  const setAppearance = useSetAppearance();

  const initials = profile.name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2) || 'CM';

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Preferences
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Manage your personal account preferences.
      </p>

      {/* Profile section */}
      <section className="mb-6">
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-4">
          Profile
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <div className="flex items-center gap-4 pb-4 mb-4 border-b border-[var(--cu-border-divider)]">
            <Avatar fallback={initials} size="md" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--cu-text-primary)]">
                {profile.name}
              </p>
              <p className="text-xs text-[var(--cu-text-muted)]">{profile.email}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-[var(--cu-radius-sm)] bg-[var(--cu-bg-hover)] text-[var(--cu-text-secondary)]">
              {profile.role}
            </span>
          </div>

          <SettingsRow
            label="Display name"
            description="How your name appears to others in the workspace."
          >
            <TextInput
              value={profile.name}
              onChange={(name) => setProfile({ name })}
            />
          </SettingsRow>

          <SettingsRow label="Email" description="Your account email address.">
            <TextInput
              type="email"
              value={profile.email}
              widthClass="w-56"
              onChange={(email) => setProfile({ email })}
            />
          </SettingsRow>

          <SettingsRow
            label="Timezone"
            description="Used for due dates and reminders."
          >
            <TextInput
              value={profile.timezone}
              widthClass="w-56"
              onChange={(timezone) => setProfile({ timezone })}
            />
          </SettingsRow>
        </div>
      </section>

      {/* Appearance section */}
      <section className="mb-6">
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-4">
          Appearance
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <SettingsRow
            label="Theme"
            description="Choose how ClickUp looks for you."
          >
            <SelectInput<Theme>
              value={appearance.theme}
              options={THEME_OPTIONS}
              widthClass="w-36"
              onChange={(theme) => setAppearance({ theme })}
            />
          </SettingsRow>

          <SettingsRow
            label="Compact sidebar"
            description="Reduce spacing to show more content."
          >
            <ToggleSwitch
              checked={appearance.sidebarDensity === 'compact'}
              onCheckedChange={(checked) =>
                setAppearance({
                  sidebarDensity: checked ? 'compact' : 'comfortable',
                })
              }
            />
          </SettingsRow>
        </div>
      </section>

      <div className="flex gap-2">
        <Button variant="primary" size="md">
          Save changes
        </Button>
      </div>
    </div>
  );
}
