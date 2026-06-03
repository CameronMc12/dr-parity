'use client';

/**
 * Real input controls for the Form preview. Each maps onto one `FormDraft`
 * field and styles 1:1 with ClickUp's form inputs (dark, var(--cu-*) tokens,
 * 120ms hover). The select-style inputs use a lightweight popover.
 */

import { useEffect, useRef, useState } from 'react';
import type { Assignee, Member } from '@/store/workspace/types';
import type { StatusOption } from '@/components/pages/listview/statuses';
import { PRIORITY_OPTIONS } from '@/components/pages/listview/statuses';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

const FIELD_HEIGHT = 38;

function fieldBaseStyle(error: boolean): React.CSSProperties {
  return {
    width: '100%',
    minHeight: FIELD_HEIGHT,
    borderRadius: T.radiusMd,
    border: `1px solid ${error ? T.danger : T.border}`,
    background: T.bgInput,
    color: T.textPrimary,
    fontFamily: T.font,
    fontSize: 14,
    padding: '8px 12px',
    outline: 'none',
    transition: HOVER_TRANSITION,
    boxSizing: 'border-box',
  };
}

// ── Text + Textarea ───────────────────────────────────────────────────────────

export function TextInput({
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  error?: boolean;
  type?: 'text' | 'email';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={fieldBaseStyle(Boolean(error))}
    />
  );
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      style={{ ...fieldBaseStyle(false), resize: 'vertical', lineHeight: 1.5 }}
    />
  );
}

export function DateInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const asInput = value != null ? toDateInputValue(value) : '';
  return (
    <input
      type="date"
      value={asInput}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? fromDateInputValue(v) : null);
      }}
      style={{ ...fieldBaseStyle(false), colorScheme: 'dark' }}
    />
  );
}

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromDateInputValue(v: string): number {
  const parts = v.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

// ── Popover scaffold ──────────────────────────────────────────────────────────

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function popoverPanelStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 40,
    maxHeight: 260,
    overflowY: 'auto',
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    boxShadow: T.shadowLg,
    padding: 4,
  };
}

function SelectTrigger({
  onClick,
  open,
  children,
  placeholder,
  filled,
}: {
  onClick: () => void;
  open: boolean;
  children: React.ReactNode;
  placeholder: string;
  filled: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...fieldBaseStyle(false),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        cursor: 'pointer',
        borderColor: open || hover ? T.borderStrong : T.border,
        background: T.bgInput,
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, color: filled ? T.textPrimary : T.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
        {filled ? children : placeholder}
      </span>
      <Caret open={open} />
    </button>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease', color: T.textSecondary, flexShrink: 0 }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OptionRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 8px',
        borderRadius: T.radiusSm,
        border: 'none',
        background: hover ? T.bgHover : 'transparent',
        color: T.textPrimary,
        fontFamily: T.font,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
        transition: HOVER_TRANSITION,
      }}
    >
      {children}
    </button>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function AvatarChip({ member, size = 22 }: { member: Assignee; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: member.color || T.accent,
        color: '#fff',
        fontSize: size <= 22 ? 10 : 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {member.initials}
    </span>
  );
}

// ── Assignee picker (multi) ───────────────────────────────────────────────────

export function AssigneePicker({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: Assignee[];
  onChange: (next: Assignee[]) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const selectedIds = new Set(value.map((a) => a.id));

  function toggle(m: Member) {
    if (selectedIds.has(m.id)) {
      onChange(value.filter((a) => a.id !== m.id));
    } else {
      onChange([...value, { id: m.id, name: m.name, initials: m.initials, color: m.color }]);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SelectTrigger onClick={() => setOpen((o) => !o)} open={open} placeholder="Add assignees" filled={value.length > 0}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {value.map((a) => (
            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <AvatarChip member={a} />
              <span style={{ fontSize: 13 }}>{a.name}</span>
            </span>
          ))}
        </span>
      </SelectTrigger>
      {open && (
        <div style={popoverPanelStyle()}>
          {members.map((m) => (
            <OptionRow key={m.id} onClick={() => toggle(m)}>
              <AvatarChip member={m} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              {selectedIds.has(m.id) && <SmallCheck />}
            </OptionRow>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Priority select ───────────────────────────────────────────────────────────

export function PrioritySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const current = PRIORITY_OPTIONS.find((p) => p.key === value) ?? null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SelectTrigger onClick={() => setOpen((o) => !o)} open={open} placeholder="Select priority" filled={current != null}>
        {current && (
          <>
            <FlagFilled color={current.color} />
            <span>{current.label}</span>
          </>
        )}
      </SelectTrigger>
      {open && (
        <div style={popoverPanelStyle()}>
          {PRIORITY_OPTIONS.map((p) => (
            <OptionRow
              key={p.key}
              onClick={() => {
                onChange(value === p.key ? null : p.key);
                setOpen(false);
              }}
            >
              <FlagFilled color={p.color} />
              <span style={{ flex: 1 }}>{p.label}</span>
              {value === p.key && <SmallCheck />}
            </OptionRow>
          ))}
          {value != null && (
            <OptionRow
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span style={{ color: T.textMuted }}>Clear</span>
            </OptionRow>
          )}
        </div>
      )}
    </div>
  );
}

function FlagFilled({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 2.5v11" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M4 3h7l-1.4 2.2L11 7.5H4z" fill={color} />
    </svg>
  );
}

// ── Status select ─────────────────────────────────────────────────────────────

export function StatusSelect({
  options,
  value,
  onChange,
}: {
  options: StatusOption[];
  value: StatusOption | null;
  onChange: (next: StatusOption | null) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SelectTrigger onClick={() => setOpen((o) => !o)} open={open} placeholder="Select status" filled={value != null}>
        {value && (
          <>
            <Dot color={value.statusColor} />
            <span style={{ textTransform: 'capitalize' }}>{value.status}</span>
          </>
        )}
      </SelectTrigger>
      {open && (
        <div style={popoverPanelStyle()}>
          {options.map((o) => (
            <OptionRow
              key={o.status}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              <Dot color={o.statusColor} />
              <span style={{ flex: 1, textTransform: 'capitalize' }}>{o.status}</span>
              {value?.status === o.status && <SmallCheck />}
            </OptionRow>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Generic single-choice dropdown ────────────────────────────────────────────

export function ChoiceSelect({
  choices,
  value,
  onChange,
  placeholder,
}: {
  choices: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SelectTrigger onClick={() => setOpen((o) => !o)} open={open} placeholder={placeholder} filled={value != null}>
        {value && <span>{value}</span>}
      </SelectTrigger>
      {open && (
        <div style={popoverPanelStyle()}>
          {choices.map((c) => (
            <OptionRow
              key={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              <span style={{ flex: 1 }}>{c}</span>
              {value === c && <SmallCheck />}
            </OptionRow>
          ))}
        </div>
      )}
    </div>
  );
}

function SmallCheck() {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: T.accent }}>
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
