import * as Switch from '@radix-ui/react-switch';
import { Button } from '@/components/ui/Button';

export function Security() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Security
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Manage authentication and security settings for your account.
      </p>

      <section className="mb-6">
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
          Password
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-[var(--cu-text-primary)] font-medium">Password</p>
              <p className="text-xs text-[var(--cu-text-muted)]">Last changed 3 months ago.</p>
            </div>
            <Button variant="secondary" size="sm">Change password</Button>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
          Two-factor authentication
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--cu-text-primary)] font-medium">Enable 2FA</p>
              <p className="text-xs text-[var(--cu-text-muted)]">
                Require a second verification step when signing in.
              </p>
            </div>
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
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
          Sessions
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--cu-text-primary)] font-medium">
                Active sessions
              </p>
              <p className="text-xs text-[var(--cu-text-muted)]">
                1 active session — this device.
              </p>
            </div>
            <Button variant="danger" size="sm">Sign out all devices</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
