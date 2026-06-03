import type { ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-[var(--cu-border-divider)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cu-text-primary)] font-medium">{label}</p>
        {description && (
          <p className="text-xs text-[var(--cu-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

export function Account() {
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
            <Avatar fallback="CM" size="md" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--cu-text-primary)]">
                Cameron M
              </p>
              <p className="text-xs text-[var(--cu-text-muted)]">
                cameron12mcallister@gmail.com
              </p>
            </div>
            <Button variant="secondary" size="sm">
              Edit profile
            </Button>
          </div>

          <SettingsRow
            label="Display name"
            description="How your name appears to others in the workspace."
          >
            <input
              type="text"
              defaultValue="Cameron M"
              className="
                h-7 px-3 rounded-[var(--cu-radius-sm)] text-xs w-44
                bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
                border border-[var(--cu-border)] placeholder:text-[var(--cu-text-muted)]
                focus:outline-none focus:border-[var(--cu-accent)]
                transition-colors
              "
            />
          </SettingsRow>

          <SettingsRow
            label="Email"
            description="Your account email address."
          >
            <input
              type="email"
              defaultValue="cameron12mcallister@gmail.com"
              className="
                h-7 px-3 rounded-[var(--cu-radius-sm)] text-xs w-56
                bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
                border border-[var(--cu-border)] placeholder:text-[var(--cu-text-muted)]
                focus:outline-none focus:border-[var(--cu-accent)]
                transition-colors
              "
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
            label="Dark mode"
            description="Use the dark theme across the app."
          >
            <Switch.Root
              defaultChecked
              className="
                w-9 h-5 rounded-full relative cursor-pointer
                bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border)]
                transition-colors
              "
            >
              <Switch.Thumb
                className="
                  block w-4 h-4 rounded-full bg-white shadow-sm
                  translate-x-0.5 data-[state=checked]:translate-x-[18px]
                  transition-transform
                "
              />
            </Switch.Root>
          </SettingsRow>

          <SettingsRow
            label="Compact mode"
            description="Reduce spacing to show more content."
          >
            <Switch.Root
              className="
                w-9 h-5 rounded-full relative cursor-pointer
                bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border)]
                transition-colors
              "
            >
              <Switch.Thumb
                className="
                  block w-4 h-4 rounded-full bg-white shadow-sm
                  translate-x-0.5 data-[state=checked]:translate-x-[18px]
                  transition-transform
                "
              />
            </Switch.Root>
          </SettingsRow>
        </div>
      </section>

      <div className="flex gap-2">
        <Button variant="primary" size="md">
          Save changes
        </Button>
        <Button variant="ghost" size="md">
          Cancel
        </Button>
      </div>
    </div>
  );
}
