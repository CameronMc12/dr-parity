'use client';

/**
 * The "Add a Column / Fields" panel (ClickUp's field picker). Renders as a
 * right-anchored popover at `anchor`, closing on outside-click / Escape.
 *
 *   Create new tab:
 *     Suggested  — one-click named presets (Project Milestone, Client Feedback…)
 *     AI fields  — Summary / Custom Text / Custom Dropdown
 *     All        — the full bare type list (Dropdown, Text, Date, …)
 *   Add existing tab:
 *     Toggles this list's already-defined custom fields into the view by
 *     flipping the `cf:<id>` column via toggleColumn.
 *
 * Picking a type opens an inline name prompt (defaulting to the type label);
 * dropdown / labels seed 2-3 starter options. On confirm it calls
 * createCustomField(listId, …) then onCreated(field).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useCustomFields,
  useCustomFieldActions,
} from '@/store/workspace/custom-fields-hooks';
import type {
  CustomFieldDef,
  CustomFieldOption,
  CustomFieldType,
} from '@/store/workspace/custom-fields';
import {
  columnIdForCustomField,
  isCustomFieldColumn,
} from '@/store/workspace/view-config.types';
import {
  AI_TYPES,
  ALL_TYPES,
  FieldTypeIcon,
  SUGGESTED_PRESETS,
  typeLabel,
  type FieldPreset,
  type FieldTypeEntry,
} from './field-catalog';
import { LV } from '@/components/pages/listview/tokens';

const PANEL_WIDTH = 320;
const STARTER_COLORS = ['#9b6cf0', '#49a8e8', '#3fb27f', '#f0a23c'];

/** Seed 2-3 starter options for option-backed types; mint stable local ids. */
function seedOptions(
  type: CustomFieldType,
  preset?: Pick<CustomFieldOption, 'label' | 'color'>[],
): CustomFieldOption[] | undefined {
  if (type !== 'dropdown' && type !== 'labels') return undefined;
  const base: Pick<CustomFieldOption, 'label' | 'color'>[] =
    preset ?? [
      { label: 'Option 1', color: STARTER_COLORS[0]! },
      { label: 'Option 2', color: STARTER_COLORS[1]! },
      { label: 'Option 3', color: STARTER_COLORS[2]! },
    ];
  return base.map((o, i) => ({ id: `opt-${i + 1}`, label: o.label, color: o.color }));
}

type Tab = 'create' | 'existing';

interface FieldsPanelProps {
  listId: string;
  onCreated: (field: CustomFieldDef) => void;
  onClose: () => void;
  anchor?: { x: number; y: number };
}

export function FieldsPanel({ listId, onCreated, onClose, anchor }: FieldsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('create');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<{ type: CustomFieldType; name: string } | null>(
    null,
  );

  const { createCustomField } = useCustomFieldActions();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const create = (
    type: CustomFieldType,
    name: string,
    optionSeed?: Pick<CustomFieldOption, 'label' | 'color'>[],
  ) => {
    const field = createCustomField(listId, {
      name: name.trim() || typeLabel(type),
      type,
      options: seedOptions(type, optionSeed),
    });
    onCreated(field);
    onClose();
  };

  const beginType = (type: CustomFieldType) =>
    setPending({ type, name: typeLabel(type) });

  const beginPreset = (p: FieldPreset) => {
    if (p.options) {
      create(p.type, p.label, p.options);
    } else {
      setPending({ type: p.type, name: p.label });
    }
  };

  // Cursor / anchor placement, clamped into the viewport.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const x = anchor?.x ?? vw - PANEL_WIDTH - 16;
  const y = anchor?.y ?? 96;
  const left = Math.max(8, Math.min(x, vw - PANEL_WIDTH - 8));
  const top = Math.min(y, Math.max(8, vh - 460));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Fields"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 9999,
        left,
        top,
        width: PANEL_WIDTH,
        maxHeight: 'calc(100vh - 24px)',
        display: 'flex',
        flexDirection: 'column',
        background: LV.menuBg,
        border: `1px solid ${LV.border}`,
        borderRadius: 8,
        boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))',
        boxSizing: 'border-box',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
        animation: 'cuMenuIn 110ms ease',
        overflow: 'hidden',
      }}
    >
      <PanelHeader onClose={onClose} />
      {pending ? (
        <NamePrompt
          pending={pending}
          onChange={(name) => setPending({ ...pending, name })}
          onCancel={() => setPending(null)}
          onConfirm={() => create(pending.type, pending.name)}
        />
      ) : (
        <>
          <SearchInput value={query} onChange={setQuery} />
          <Tabs tab={tab} onChange={setTab} />
          <div style={{ overflowY: 'auto', padding: '4px 0 8px' }}>
            {tab === 'create' ? (
              <CreateTab query={query} onPreset={beginPreset} onType={beginType} />
            ) : (
              <ExistingTab listId={listId} query={query} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderBottom: `1px solid ${LV.border}`,
      }}
    >
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: LV.textPrimary }}>
        Fields
      </span>
      <IconButton label="Field settings" onClick={() => undefined}>
        <GearIcon />
      </IconButton>
      <IconButton label="Close" onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </div>
  );
}

// ── Search ───────────────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ padding: '8px 12px 4px' }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for new or existing fields"
        style={{
          width: '100%',
          height: 32,
          padding: '0 10px',
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

// ── Tabs ─────────────────────────────────────────────────────────────────────

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '4px 14px 0',
        borderBottom: `1px solid ${LV.border}`,
      }}
    >
      <TabButton active={tab === 'create'} onClick={() => onChange('create')}>
        Create new
      </TabButton>
      <TabButton active={tab === 'existing'} onClick={() => onChange('existing')}>
        Add existing
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 0 8px',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? LV.accent : 'transparent'}`,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? LV.textPrimary : LV.textMuted,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// ── Create tab ───────────────────────────────────────────────────────────────

function CreateTab({
  query,
  onPreset,
  onType,
}: {
  query: string;
  onPreset: (p: FieldPreset) => void;
  onType: (t: CustomFieldType) => void;
}) {
  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);

  const presets = SUGGESTED_PRESETS.filter((p) => match(p.label));
  const ai = AI_TYPES.filter((t) => match(t.label));
  const all = ALL_TYPES.filter((t) => match(t.label));

  return (
    <>
      {presets.length > 0 && (
        <Section label="Suggested">
          {presets.map((p) => (
            <FieldRow
              key={p.id}
              type={p.type}
              label={p.label}
              onClick={() => onPreset(p)}
            />
          ))}
        </Section>
      )}
      {ai.length > 0 && (
        <Section label="AI fields">
          {ai.map((t) => (
            <FieldRow
              key={`ai-${t.label}`}
              type={t.type}
              label={t.label}
              desc={t.desc}
              onClick={() => onType(t.type)}
            />
          ))}
        </Section>
      )}
      {all.length > 0 && (
        <Section label="All">
          {all.map((t) => (
            <FieldRow
              key={t.type}
              type={t.type}
              label={t.label}
              desc={t.desc}
              onClick={() => onType(t.type)}
            />
          ))}
        </Section>
      )}
      {presets.length + ai.length + all.length === 0 && <EmptyHint text="No fields match" />}
    </>
  );
}

// ── Add existing tab ─────────────────────────────────────────────────────────

function ExistingTab({ listId, query }: { listId: string; query: string }) {
  const fields = useCustomFields(listId);
  const visibleColumns = useWorkspaceStore(
    (s) => s.viewConfigs[listId]?.visibleColumns,
  );
  const toggleColumn = useWorkspaceStore((s) => s.toggleColumn);

  const shown = useMemo(() => {
    const set = new Set(
      (visibleColumns ?? [])
        .filter(isCustomFieldColumn)
        .map((c) => c.slice(3)),
    );
    return set;
  }, [visibleColumns]);

  const q = query.trim().toLowerCase();
  const list = fields.filter((f) => !q || f.name.toLowerCase().includes(q));

  if (list.length === 0) {
    return <EmptyHint text="No existing fields on this list yet" />;
  }

  return (
    <Section label="On this list">
      {list.map((f) => {
        const on = shown.has(f.id);
        return (
          <FieldRow
            key={f.id}
            type={f.type}
            label={f.name}
            onClick={() => toggleColumn(listId, columnIdForCustomField(f.id))}
            trailing={<Toggle on={on} />}
          />
        );
      })}
    </Section>
  );
}

// ── Name prompt ──────────────────────────────────────────────────────────────

function NamePrompt({
  pending,
  onChange,
  onCancel,
  onConfirm,
}: {
  pending: { type: CustomFieldType; name: string };
  onChange: (name: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{ padding: '14px 14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <FieldTypeIcon type={pending.type} />
        <span style={{ fontSize: 13, color: LV.textSecondary }}>
          New {typeLabel(pending.type)} field
        </span>
      </div>
      <input
        autoFocus
        value={pending.name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Field name"
        style={{
          width: '100%',
          height: 34,
          padding: '0 10px',
          fontSize: 13,
          color: LV.textPrimary,
          background: LV.input,
          border: `1px solid ${LV.border}`,
          borderRadius: 6,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          marginBottom: 14,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton onClick={onConfirm}>Create field</PrimaryButton>
      </div>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
        {label}
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  type,
  label,
  desc,
  onClick,
  trailing,
}: {
  type: CustomFieldType;
  label: string;
  desc?: string;
  onClick: () => void;
  trailing?: React.ReactNode;
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
        gap: 10,
        padding: '6px 14px',
        minHeight: 36,
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <FieldTypeIcon type={type} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            color: LV.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {desc && (
          <span
            style={{
              display: 'block',
              fontSize: 11,
              color: LV.textMuted,
              marginTop: 1,
            }}
          >
            {desc}
          </span>
        )}
      </span>
      {trailing}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{ padding: '18px 14px', fontSize: 12, color: LV.textMuted, textAlign: 'center' }}>
      {text}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: LV.textMuted,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 28,
        height: 16,
        borderRadius: 9999,
        background: on ? LV.accent : 'var(--cu-border-strong, rgb(208,208,208))',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 140ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 140ms ease',
        }}
      />
    </span>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 30,
        padding: '0 12px',
        background: hover ? LV.hover : 'transparent',
        border: `1px solid ${LV.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        color: LV.textSecondary,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 30,
        padding: '0 14px',
        background: LV.accent,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        opacity: hover ? 0.92 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// ── Header icons ─────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
