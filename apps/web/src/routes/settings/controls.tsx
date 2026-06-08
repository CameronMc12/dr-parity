import type { ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';

/** Controlled toggle matching the existing settings Switch styling. */
export function ToggleSwitch({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="
        w-9 h-5 rounded-full relative cursor-pointer
        bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border)]
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
  );
}

/** Controlled text/email input matching the existing settings input styling. */
export function TextInput({
  value,
  onChange,
  type = 'text',
  widthClass = 'w-44',
}: {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email';
  widthClass?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        h-7 px-3 rounded-[var(--cu-radius-sm)] text-xs ${widthClass}
        bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
        border border-[var(--cu-border)] placeholder:text-[var(--cu-text-muted)]
        focus:outline-none focus:border-[var(--cu-accent)]
        transition-colors
      `}
    />
  );
}

/** Controlled select matching the existing settings input styling. */
export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  widthClass = 'w-44',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  widthClass?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`
        h-7 px-2 rounded-[var(--cu-radius-sm)] text-xs ${widthClass}
        bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
        border border-[var(--cu-border)]
        focus:outline-none focus:border-[var(--cu-accent)]
        transition-colors cursor-pointer
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** Label + description + control row used across settings sections. */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-[var(--cu-border-divider)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cu-text-primary)] font-medium">{label}</p>
        {description && (
          <p className="text-xs text-[var(--cu-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}
