'use client';

import type { ReactNode } from 'react';

/**
 * Extra form-control primitives used by the long My Settings pane:
 * Select (caret), RadioGroup, Checkbox, OptionCard (selectable 2FA card),
 * and the save / log-out / delete button styles. These complement the base
 * primitives in ./primitives.
 */

const CaretGlyph = (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function SelectField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-64 max-w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          h-9 w-full pl-3 pr-9 rounded-[var(--cu-radius-md)] text-sm appearance-none
          bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
          border border-[var(--cu-border)]
          focus:outline-none focus:border-[var(--cu-accent)] transition-colors
        "
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cu-text-muted)]">
        {CaretGlyph}
      </span>
    </div>
  );
}

export function RadioRow({
  label,
  description,
  checked,
  onSelect,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-start gap-3 text-left group"
    >
      <span
        className="
          mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center
          border transition-colors
        "
        style={{
          borderColor: checked ? 'var(--cu-accent)' : 'var(--cu-border-strong)',
        }}
      >
        {checked && (
          <span className="w-2 h-2 rounded-full bg-[var(--cu-accent)]" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-[var(--cu-text-primary)]">{label}</span>
        {description && (
          <span className="block text-[13px] leading-snug text-[var(--cu-text-muted)] mt-0.5">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

const TickGlyph = (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left"
    >
      <span
        className="w-4 h-4 rounded-[var(--cu-radius-sm)] shrink-0 flex items-center justify-center border transition-colors"
        style={{
          background: checked ? 'var(--cu-accent)' : 'transparent',
          borderColor: checked ? 'var(--cu-accent)' : 'var(--cu-border-strong)',
        }}
      >
        {checked && TickGlyph}
      </span>
      <span className="text-sm text-[var(--cu-text-primary)]">{label}</span>
    </button>
  );
}

export function OptionCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="
        flex items-start gap-3 text-left w-full p-3.5
        rounded-[var(--cu-radius-md)] bg-[var(--cu-bg-input)]
        border transition-colors
      "
      style={{
        borderColor: selected ? 'var(--cu-accent)' : 'var(--cu-border)',
        boxShadow: selected ? '0 0 0 1px var(--cu-accent)' : 'none',
      }}
    >
      <span
        className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center border transition-colors"
        style={{
          borderColor: selected ? 'var(--cu-accent)' : 'var(--cu-border-strong)',
        }}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[var(--cu-accent)]" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--cu-text-primary)]">
          {title}
        </span>
        <span className="block text-[13px] leading-snug text-[var(--cu-text-muted)] mt-0.5">
          {description}
        </span>
      </span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        h-9 px-4 rounded-[var(--cu-radius-md)] text-sm font-medium
        bg-[#eeeeee] text-[#1a1a1a] hover:bg-white transition-colors
      "
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        h-9 px-4 rounded-[var(--cu-radius-md)] text-sm font-medium
        bg-transparent text-[var(--cu-text-primary)]
        border border-[var(--cu-border-strong)] hover:bg-[var(--cu-bg-hover)]
        transition-colors
      "
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        h-9 px-4 rounded-[var(--cu-radius-md)] text-sm font-medium
        bg-[#e5484d] text-white hover:bg-[#d93a3f] transition-colors
      "
    >
      {children}
    </button>
  );
}
