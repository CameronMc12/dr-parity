import { Button } from '@/components/ui/Button';

export function Billing() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Upgrade
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Manage your plan and billing information.
      </p>

      <div
        className="
          rounded-[var(--cu-radius-lg)] p-5 mb-4
          bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
        "
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-[var(--cu-text-primary)]">Free plan</p>
            <p className="text-xs text-[var(--cu-text-muted)] mt-0.5">
              Current plan for this workspace.
            </p>
          </div>
          <Button variant="primary" size="sm">
            Upgrade
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Members', value: '4 / 5' },
            { label: 'Storage', value: '100 MB / 100 MB' },
            { label: 'Views',   value: 'Limited' },
            { label: 'Guests',  value: 'Not available' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-[var(--cu-radius-md)] p-3 bg-[var(--cu-bg-hover)]"
            >
              <p className="text-xs text-[var(--cu-text-muted)] mb-0.5">{label}</p>
              <p className="text-sm text-[var(--cu-text-primary)] font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--cu-text-muted)]">
        Billing history and invoice management available after upgrading.
      </p>
    </div>
  );
}
