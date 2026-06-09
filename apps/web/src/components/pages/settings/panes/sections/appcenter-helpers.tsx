'use client';

import type { ReactNode } from 'react';

/**
 * Shared building blocks for the App Center / Imports / API / Email panes.
 * Centered single-column layout matching GeneralPane: a 28px bold title and
 * #1a1a1a cards on #2a2a2a borders at radius 12. These primitives complement
 * (and never replace) the General pane primitives.
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

export function PlainCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] bg-[#1a1a1a] border border-[#2a2a2a] mb-8 p-6">
      {children}
    </div>
  );
}

/** A coloured brand tile: solid background + a single white glyph/letter. */
export function BrandTile({
  bg,
  children,
  size = 40,
}: {
  bg: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] text-white font-semibold select-none"
      style={{ background: bg, width: size, height: size, fontSize: size * 0.42 }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-[13px] text-[#7b7b7b]">
      {children}
    </div>
  );
}

const SearchGlyph = (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx={11} cy={11} r={7} />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-[280px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]">
        {SearchGlyph}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-[8px] bg-[#2a2a2a] pl-9 pr-3 text-[13px] text-white placeholder:text-[#7b7b7b] border border-transparent focus:outline-none focus:border-[#3e63dd] transition-colors"
      />
    </div>
  );
}

export function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors"
      style={{
        background: active ? ACCENT : '#2a2a2a',
        color: active ? '#ffffff' : '#b4b4b4',
      }}
    >
      {label}
    </button>
  );
}

/** Small accent-coloured "Connected" pill / "Add" outline button pairing. */
export function ConnectButton({
  connected,
  onClick,
}: {
  connected: boolean;
  onClick: () => void;
}) {
  if (connected) {
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium"
        style={{ background: 'rgba(62,99,221,0.16)', color: '#9db2f9' }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
        Connected
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-[6px] border border-[#3a3a3a] px-3.5 text-[13px] font-medium text-white hover:bg-[#2a2a2a] transition-colors"
    >
      Add
    </button>
  );
}

export function MutedLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="text-[13px] text-[#b4b4b4] hover:text-white underline-offset-2 hover:underline transition-colors"
    >
      {children}
    </button>
  );
}
