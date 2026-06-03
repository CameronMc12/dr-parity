'use client';

/**
 * Renders + edits one task's value for one custom field, switching on
 * field.type. Each variant reads the current value via useTaskCustomValue and
 * writes through setCustomFieldValue(taskId, field.id, value). Memoised so a
 * cell only re-renders when its own task/field/value changes — never returns a
 * freshly-built object from a selector (the value hook returns the stored ref or
 * a primitive directly).
 *
 * Value conventions (see custom-fields.ts):
 *   text/textarea/website/email/phone -> string
 *   number/money/rating/progress      -> number
 *   date                              -> number (epoch ms)
 *   checkbox                          -> boolean
 *   dropdown                          -> string (option id)
 *   labels                            -> string[] (option ids)
 */

import { memo, useEffect, useRef, useState } from 'react';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import {
  useTaskCustomValue,
  useCustomFieldActions,
} from '@/store/workspace/custom-fields-hooks';
import { LV } from '@/components/pages/listview/tokens';
import { DropdownCell, LabelsCell } from './OptionFieldCells';

interface CustomFieldCellProps {
  task: Task;
  field: CustomFieldDef;
}

function CustomFieldCellInner({ task, field }: CustomFieldCellProps) {
  const value = useTaskCustomValue(task.id, field.id);

  switch (field.type) {
    case 'dropdown':
      return <DropdownCell taskId={task.id} field={field} value={value} />;
    case 'labels':
      return <LabelsCell taskId={task.id} field={field} value={value} />;
    case 'checkbox':
      return <CheckboxCell taskId={task.id} field={field} value={value} />;
    case 'date':
      return <DateCell taskId={task.id} field={field} value={value} />;
    case 'number':
      return <NumericCell taskId={task.id} field={field} value={value} />;
    case 'money':
      return <NumericCell taskId={task.id} field={field} value={value} prefix="$" />;
    case 'rating':
      return <RatingCell taskId={task.id} field={field} value={value} />;
    case 'progress':
      return <ProgressCell taskId={task.id} field={field} value={value} />;
    case 'website':
      return <LinkCell taskId={task.id} field={field} value={value} kind="website" />;
    case 'email':
      return <LinkCell taskId={task.id} field={field} value={value} kind="email" />;
    case 'phone':
      return <LinkCell taskId={task.id} field={field} value={value} kind="phone" />;
    case 'textarea':
      return <TextCell taskId={task.id} field={field} value={value} multiline />;
    case 'text':
    default:
      return <TextCell taskId={task.id} field={field} value={value} />;
  }
}

export const CustomFieldCell = memo(CustomFieldCellInner);

// ── Shared cell props ────────────────────────────────────────────────────────

interface CellProps {
  taskId: string;
  field: CustomFieldDef;
  value: unknown;
}

const CELL_BASE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 30,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: LV.textPrimary,
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

// ── Text / Textarea ──────────────────────────────────────────────────────────

function TextCell({
  taskId,
  field,
  value,
  multiline,
}: CellProps & { multiline?: boolean }) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const [draft, setDraft] = useState(str(value));
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setDraft(str(value));
  }, [value]);

  const commit = () => {
    dirty.current = false;
    if (draft !== str(value)) setCustomFieldValue(taskId, field.id, draft);
  };

  const onChange = (v: string) => {
    dirty.current = true;
    setDraft(v);
  };

  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
        rows={1}
        placeholder="—"
        style={{ ...CELL_BASE, resize: 'none', padding: '6px 8px', lineHeight: 1.4 }}
      />
    );
  }
  return (
    <input
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="—"
      style={CELL_BASE}
    />
  );
}

// ── Number / Money ───────────────────────────────────────────────────────────

function NumericCell({ taskId, field, value, prefix }: CellProps & { prefix?: string }) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    dirty.current = false;
    const trimmed = draft.trim();
    const next = trimmed === '' ? undefined : Number(trimmed);
    if (next !== undefined && Number.isNaN(next)) {
      setDraft(value == null ? '' : String(value));
      return;
    }
    setCustomFieldValue(taskId, field.id, next);
  };

  return (
    <span style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
      {prefix && draft !== '' && (
        <span style={{ paddingLeft: 8, color: LV.textMuted, fontSize: 12 }}>{prefix}</span>
      )}
      <input
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="—"
        style={{ ...CELL_BASE, paddingLeft: prefix && draft !== '' ? 2 : 8, textAlign: 'left' }}
      />
    </span>
  );
}

// ── Date ─────────────────────────────────────────────────────────────────────

function DateCell({ taskId, field, value }: CellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const iso = typeof value === 'number' ? toISODate(value) : '';

  return (
    <input
      type="date"
      value={iso}
      onChange={(e) => {
        const v = e.target.value;
        setCustomFieldValue(taskId, field.id, v ? fromISODate(v) : undefined);
      }}
      style={{ ...CELL_BASE, colorScheme: 'dark', color: iso ? LV.textPrimary : LV.textMuted }}
    />
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────────────

function CheckboxCell({ taskId, field, value }: CellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const checked = value === true;
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
      <button
        role="checkbox"
        aria-checked={checked}
        onClick={() => setCustomFieldValue(taskId, field.id, !checked)}
        style={{
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: checked ? LV.accent : 'transparent',
          border: `1.5px solid ${checked ? LV.accent : 'var(--cu-border-strong, rgb(180,180,180))'}`,
          borderRadius: 4,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {checked && (
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4 10-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </span>
  );
}

// ── Rating (5 stars) ─────────────────────────────────────────────────────────

function RatingCell({ taskId, field, value }: CellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const rating = typeof value === 'number' ? value : 0;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', height: '100%', padding: '0 6px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          aria-label={`Rate ${n}`}
          onClick={() => setCustomFieldValue(taskId, field.id, n === rating ? 0 : n)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: n <= rating ? '#f0c23c' : 'var(--cu-border-strong, rgb(140,140,140))' }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

// ── Progress (bar + %) ───────────────────────────────────────────────────────

function ProgressCell({ taskId, field, value }: CellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const pct = clampPct(typeof value === 'number' ? value : 0);

  const setFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const next = clampPct(Math.round(((e.clientX - rect.left) / rect.width) * 100));
    setCustomFieldValue(taskId, field.id, next);
  };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: '100%', padding: '0 8px' }}>
      <div
        onClick={setFromEvent}
        style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--cu-bg-strong, rgb(60,60,60))', cursor: 'pointer', overflow: 'hidden' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: LV.accent, borderRadius: 9999 }} />
      </div>
      <span style={{ fontSize: 11, color: LV.textMuted, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </span>
  );
}

// ── Website / Email / Phone ──────────────────────────────────────────────────

function LinkCell({
  taskId,
  field,
  value,
  kind,
}: CellProps & { kind: 'website' | 'email' | 'phone' }) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(str(value));
  const current = str(value);

  const commit = () => {
    setEditing(false);
    if (draft !== current) setCustomFieldValue(taskId, field.id, draft.trim());
  };

  if (editing || !current) {
    return (
      <input
        autoFocus={editing}
        value={editing ? draft : current}
        onFocus={() => {
          setDraft(current);
          setEditing(true);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="—"
        style={CELL_BASE}
      />
    );
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', padding: '0 8px' }}>
      <a
        href={hrefFor(kind, current)}
        target={kind === 'website' ? '_blank' : undefined}
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => setEditing(true)}
        style={{
          flex: 1,
          fontSize: 12,
          color: LV.accent,
          textDecoration: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {current}
      </a>
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toISODate(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromISODate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

function hrefFor(kind: 'website' | 'email' | 'phone', value: string): string {
  if (kind === 'email') return `mailto:${value}`;
  if (kind === 'phone') return `tel:${value}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
