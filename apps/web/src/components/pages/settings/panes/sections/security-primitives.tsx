'use client';

import { useState, type ReactNode } from 'react';

/**
 * Local helpers shared by the Security / Audit Logs / Trash panes. These mirror
 * the ClickUp settings card geometry (#1a1a1a card on #2a2a2a hairlines, 12px
 * radius) and a compact data-table style for log / trash rows.
 */

/** A standalone iOS-style toggle, matching ClickUp's switch geometry. */
export function Toggle({
  defaultOn = false,
  on,
  onChange,
}: {
  defaultOn?: boolean;
  on?: boolean;
  onChange?: (next: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultOn);
  const checked = on ?? internal;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        const next = !checked;
        setInternal(next);
        onChange?.(next);
      }}
      className="relative w-[38px] h-[22px] rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#3e63dd' : '#3a3a3a' }}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

/** Search input matching the muted #2a2a2a field style. */
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
    <div className="relative w-64 max-w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]">
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx={11} cy={11} r={7} />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full pl-9 pr-3 rounded-[8px] text-sm bg-[#2a2a2a] text-white placeholder:text-[#7b7b7b] border border-[#2a2a2a] focus:outline-none focus:border-[#3e63dd] transition-colors"
      />
    </div>
  );
}

/** A bordered card wrapper that does not clip overflow (so tables can scroll). */
export function PlainCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] mb-8">
      {children}
    </div>
  );
}

/** A simple data table rendered inside a card. */
export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-[#2a2a2a]">
          {columns.map((c) => (
            <th
              key={c}
              className="px-6 py-3 text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]"
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[#2a2a2a] last:border-b-0">{children}</tr>
  );
}

export function TableCell({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-6 py-4 text-[13px] align-middle ${
        muted ? 'text-[#b4b4b4]' : 'text-white'
      }`}
    >
      {children}
    </td>
  );
}
