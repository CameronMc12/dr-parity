'use client';

import type { ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';

/**
 * Shared settings-pane primitives. A pane is a two-column layout: a left
 * label/description column and a right control column, separated by horizontal
 * dividers — exactly the structure of the ClickUp oracle Profile pane.
 */

export function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[22px] font-semibold text-[var(--cu-text-primary)] mb-6">
      {children}
    </h1>
  );
}

/** A labelled section row: left label + description, right control area. */
export function SettingsSection({
  label,
  description,
  children,
  align = 'start',
}: {
  label: string;
  description?: string;
  children: ReactNode;
  align?: 'start' | 'center';
}) {
  return (
    <div className="flex gap-10 py-6 border-b border-[var(--cu-border-divider)] last:border-0">
      <div className="w-[44%] shrink-0">
        <p className="text-sm font-semibold text-[var(--cu-text-primary)]">
          {label}
        </p>
        {description && (
          <p className="text-[13px] leading-snug text-[var(--cu-text-muted)] mt-1">
            {description}
          </p>
        )}
      </div>
      <div
        className={`flex-1 min-w-0 flex flex-col gap-4 ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[13px] font-medium text-[var(--cu-text-secondary)] mb-1.5">
      {children}
    </label>
  );
}

export function TextField({
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div
      className="
        flex items-center gap-2 h-10 px-3 rounded-[var(--cu-radius-md)]
        bg-[var(--cu-bg-input)] border border-[var(--cu-border)]
        focus-within:border-[var(--cu-accent)] transition-colors
      "
    >
      {icon && <span className="text-[var(--cu-text-muted)] shrink-0">{icon}</span>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="
          flex-1 min-w-0 bg-transparent text-sm text-[var(--cu-text-primary)]
          placeholder:text-[var(--cu-text-muted)] focus:outline-none
        "
      />
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="
          mt-0.5 w-9 h-5 rounded-full relative cursor-pointer shrink-0
          bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border-strong)]
          transition-colors
        "
      >
        <Switch.Thumb
          className="
            block w-4 h-4 rounded-full bg-white shadow-sm
            translate-x-0.5 data-[state=checked]:translate-x-[18px]
            transition-transform
          "
        />
      </Switch.Root>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--cu-text-primary)]">{title}</p>
        {description && (
          <p className="text-[13px] leading-snug text-[var(--cu-text-muted)] mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
