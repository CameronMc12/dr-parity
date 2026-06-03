'use client';

import { useState, type ReactNode } from 'react';
import { LV } from './tokens';

/** Search box rendered at the top of pickers (status / column / field menus). */
export function MenuSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ padding: '4px 8px 6px' }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 28,
          padding: '0 8px',
          fontSize: 13,
          color: LV.textPrimary,
          background: LV.input,
          border: `1px solid ${LV.border}`,
          borderRadius: 6,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/** Small uppercase section heading inside a picker ("Not started", "Shown"). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 14px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: LV.textMuted,
      }}
    >
      {children}
    </div>
  );
}

/** Generic clickable picker row used by editors that don't fit `MenuItem`. */
export function PickerRow({
  onClick,
  children,
  active,
  trailing,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  trailing?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 32,
        padding: '0 14px',
        background: hover || active ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: LV.textPrimary,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {children}
      </span>
      {trailing}
    </button>
  );
}

export function Dot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        background: dashed ? 'transparent' : color,
        border: dashed ? `1.5px dashed ${color}` : 'none',
      }}
    />
  );
}

export function CheckMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4 10-10"
        stroke="var(--cu-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
