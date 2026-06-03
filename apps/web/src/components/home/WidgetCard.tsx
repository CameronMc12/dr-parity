import type { ReactNode } from 'react';

/** Shared dashboard widget shell: header row (title + actions) over a body. */
export function WidgetCard({
  title,
  icon,
  actions,
  children,
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--cu-radius-lg)] border border-[var(--cu-border-divider)] bg-[var(--cu-bg-menu)] flex flex-col min-h-0 ${className}`}
    >
      <header className="flex items-center gap-2 h-[44px] px-4 shrink-0">
        {icon ? <span className="text-[var(--cu-text-muted)] flex">{icon}</span> : null}
        <h3 className="text-[var(--cu-text-primary)] text-[13px] font-semibold flex-1 truncate">
          {title}
        </h3>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </header>
      <div className="flex-1 min-h-0 px-4 pb-4">{children}</div>
    </section>
  );
}

/** Centered empty-state used inside several widgets. */
export function WidgetEmpty({
  message,
  cta,
}: {
  message: string;
  cta?: { label: string; muted?: boolean };
}) {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center gap-2 py-6">
      <p className="text-[var(--cu-text-muted)] text-[12px] max-w-[220px] leading-[1.45]">
        {message}
      </p>
      {cta ? (
        <button
          type="button"
          className={
            cta.muted
              ? 'text-[var(--cu-status-blue)] text-[12px] font-medium hover:underline'
              : 'text-[var(--cu-status-blue)] text-[12px] font-medium hover:underline'
          }
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}
