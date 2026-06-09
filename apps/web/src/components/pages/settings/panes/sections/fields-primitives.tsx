'use client';

import type { ReactNode } from 'react';

/**
 * Shared local primitives for the Custom Fields, Template Center, Automations
 * and AI Notetaker settings panes. Pane title + description header, a search
 * input, a kebab (overflow) button, a small chip, and a status pill — matching
 * ClickUp's settings chrome. These complement the General pane primitives.
 */

export function PaneHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-bold text-white">{title}</h1>
      {description && (
        <p className="mt-2 max-w-[560px] text-[14px] leading-[20px] text-[#7b7b7b]">
          {description}
        </p>
      )}
    </div>
  );
}

const SearchGlyph = (
  <svg
    width={15}
    height={15}
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
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-72 max-w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]">
        {SearchGlyph}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[8px] border border-[#2a2a2a] bg-[#2a2a2a] pl-9 pr-3 text-sm text-white placeholder:text-[#7b7b7b] transition-colors focus:border-[#3e63dd] focus:outline-none"
      />
    </div>
  );
}

const KebabGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
    <circle cx={12} cy={5} r={1.7} />
    <circle cx={12} cy={12} r={1.7} />
    <circle cx={12} cy={19} r={1.7} />
  </svg>
);

export function KebabButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More options"
      className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#b4b4b4] transition-colors hover:bg-[#2a2a2a] hover:text-white"
    >
      {KebabGlyph}
    </button>
  );
}

export function Chip({
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
      className="h-8 rounded-[8px] border px-3 text-[13px] font-medium transition-colors"
      style={{
        background: active ? '#3e63dd' : 'transparent',
        borderColor: active ? '#3e63dd' : '#2a2a2a',
        color: active ? '#fff' : '#b4b4b4',
      }}
    >
      {label}
    </button>
  );
}

export function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[#2a2a2a] px-2 text-[12px] font-medium text-[#b4b4b4]">
      {label}
    </span>
  );
}

/** A standalone on/off switch, sized to match ClickUp's settings toggles. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{ background: checked ? '#3e63dd' : '#2a2a2a' }}
    >
      <span
        className="block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

/** A bordered card shell that lets its children manage their own padding. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a]">
      {children}
    </div>
  );
}
