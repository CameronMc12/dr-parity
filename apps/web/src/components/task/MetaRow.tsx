'use client';

/** One label/value row inside the task panel's two-column meta grid. */
export function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '150px 1fr',
        alignItems: 'center',
        minHeight: 36,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cu-text-primary, #eee)',
        }}
      >
        <span style={{ display: 'flex', color: 'var(--cu-text-muted, #7b7b7b)' }}>{icon}</span>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>{children}</span>
    </div>
  );
}

export function EmptyValue() {
  return (
    <span style={{ fontSize: 13, color: 'var(--cu-text-muted, #7b7b7b)', paddingLeft: 6 }}>
      Empty
    </span>
  );
}
