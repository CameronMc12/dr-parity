interface Props { title: string; description: string }

export function SettingsPlaceholder({ title, description }: Props) {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        {title}
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">{description}</p>
      <div
        className="
          rounded-[var(--cu-radius-lg)] p-6
          bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          text-center
        "
      >
        <p className="text-[var(--cu-text-muted)] text-sm">
          Content coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
