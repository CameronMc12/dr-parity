'use client';

import type { ReactNode } from 'react';

/**
 * Small shared list/table + chrome helpers for the People / Teams / Billing /
 * AI Usage settings panes. Kept local to the panes folder so they never collide
 * with the General pane's primitives. Values follow the settings token set:
 * cards #1a1a1a / border #2a2a2a / radius 12, accent blue #3e63dd.
 */

const ACCENT = '#3e63dd';

export function PaneShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <h1 className="text-[28px] font-bold text-white mb-8">{title}</h1>
      {children}
    </div>
  );
}

/** A header strip inside a card: bold title, optional right-side action. */
export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-5 border-b border-[#2a2a2a]">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white leading-tight">{title}</p>
        {description && (
          <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-1 max-w-[440px]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex-1 max-w-[320px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]">
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full pl-9 pr-3 rounded-[6px] text-sm bg-[#2a2a2a] text-white placeholder:text-[#7b7b7b] border border-[#2a2a2a] focus:outline-none focus:border-[#3e63dd] transition-colors"
      />
    </div>
  );
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#222222] border border-[#2a2a2a]">
      {tabs.map((t) => {
        const isActive = t === active;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="h-7 px-3 rounded-[6px] text-[13px] font-medium transition-colors"
            style={{
              background: isActive ? '#1a1a1a' : 'transparent',
              color: isActive ? '#fff' : '#b4b4b4',
              boxShadow: isActive ? '0 0 0 1px #2a2a2a' : 'none',
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  name,
  shape = 'circle',
}: {
  name: string;
  shape?: 'circle' | 'square';
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="w-8 h-8 shrink-0 flex items-center justify-center text-[12px] font-semibold text-white select-none"
      style={{
        background: ACCENT,
        borderRadius: shape === 'square' ? '8px' : '9999px',
      }}
    >
      {initials}
    </span>
  );
}

export function KebabButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More options"
      className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#b4b4b4] hover:bg-[#2a2a2a] transition-colors"
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
  );
}

/** Generic header row of a small table. */
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-4 px-6 py-2.5 border-b border-[#2a2a2a]">
      {columns.map((c) => (
        <span
          key={c}
          className="text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]"
          style={{ flex: c === columns[0] ? '1 1 0%' : '0 0 auto', minWidth: c === columns[0] ? 0 : 110 }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-8 text-center text-[13px] text-[#7b7b7b]">{children}</div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors"
      style={{ background: checked ? ACCENT : '#3a3a3a' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

export function UsageMeter({
  label,
  fraction,
}: {
  label: string;
  fraction: number;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-[#b4b4b4]">{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#2a2a2a] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
      </div>
    </div>
  );
}
