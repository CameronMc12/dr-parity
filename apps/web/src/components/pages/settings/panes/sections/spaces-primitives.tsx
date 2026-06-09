'use client';

import type { ReactNode } from 'react';

/**
 * Shared chrome for the Spaces / Task Types / Work Schedule settings panes:
 * the pane header (title + description), a toolbar row, a card shell, a kebab
 * trigger, a rounded-square avatar, and an avatar count stack. These mirror the
 * ClickUp workspace-settings panes 1:1 and live alongside the panes that use
 * them so the structure stays colocated.
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
      <h1 className="text-[28px] font-bold text-white leading-tight">{title}</h1>
      {description && (
        <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-1.5">
          {description}
        </p>
      )}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">{children}</div>
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 max-w-[320px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]">
        {SearchGlyph}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          h-9 w-full pl-9 pr-3 rounded-[8px] text-sm
          bg-[#2a2a2a] text-white placeholder:text-[#7b7b7b]
          border border-[#2a2a2a]
          focus:outline-none focus:border-[#3e63dd] transition-colors
        "
      />
    </div>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a]">
      {children}
    </div>
  );
}

const KebabGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);

export function KebabButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More options"
      className="
        w-7 h-7 grid place-items-center rounded-[6px]
        text-[#7b7b7b] hover:text-white hover:bg-[#2a2a2a]
        transition-colors
      "
    >
      {KebabGlyph}
    </button>
  );
}

export function SquareAvatar({
  label,
  color,
  size = 28,
}: {
  label: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-grid place-items-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: color,
        fontSize: size <= 24 ? 11 : 13,
      }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

export function MemberCount({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold text-white"
        style={{ background: '#3e63dd' }}
      >
        {count > 9 ? '9+' : count}
      </span>
      <span className="text-[13px] text-[#b4b4b4]">
        {count} {count === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
}

export function PrivacyBadge({ privacy }: { privacy: 'Public' | 'Private' }) {
  const isPrivate = privacy === 'Private';
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] text-[#b4b4b4]"
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isPrivate ? '#7b7b7b' : '#30a46c' }}
      />
      {privacy}
    </span>
  );
}
