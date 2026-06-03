'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId, useSpaces } from '@/store/workspace/hooks';
import type { Assignee, ListNode } from '@/store/workspace/types';
import { formatTaskDate } from '@/lib/format-date';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const BORDER_STRONG = 'var(--cu-border-strong, rgb(200,200,200))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const APP_BG = 'var(--cu-bg-app, #fff)';
const PRIMARY_BTN_BG = 'var(--cu-text-primary, rgb(24,24,24))';

interface FlatList {
  id: string;
  name: string;
  path: string;
}

interface PriorityOpt {
  value: string;
  label: string;
  color: string;
}

const PRIORITIES: PriorityOpt[] = [
  { value: 'urgent', label: 'Urgent', color: '#f50000' },
  { value: 'high', label: 'High', color: '#f8ae00' },
  { value: 'normal', label: 'Normal', color: '#6fddff' },
  { value: 'low', label: 'Low', color: '#d8d8d8' },
];

const STATUSES = [
  { value: 'to do', label: 'TO DO', color: '#87909e', type: 'open' },
  { value: 'in progress', label: 'IN PROGRESS', color: '#3db8ec', type: 'custom' },
  { value: 'complete', label: 'COMPLETE', color: '#6bc950', type: 'closed' },
] as const;

/**
 * Global Create-Task modal. ClickUp-style centered card: status pill, name
 * input, then a row of attribute pickers (List / Assignee / Due / Priority).
 * Submits to the persisted workspace store, then closes. Functional first,
 * styled with --cu-* tokens to match the live app.
 */
export function CreateTaskModal() {
  const open = useUiStore((s) => s.createTaskOpen);
  const defaultListId = useUiStore((s) => s.defaultListId);
  const close = useUiStore((s) => s.closeCreateTask);

  const spaces = useSpaces();
  const myId = useCurrentMemberId();
  const createTask = useWorkspaceStore((s) => s.createTask);
  const members = useWorkspaceStore((s) => s.members);

  const lists = useMemo<FlatList[]>(() => flattenLists(spaces), [spaces]);
  const me = members.find((m) => m.id === myId);

  const [name, setName] = useState('');
  const [listId, setListId] = useState<string>('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]['value']>('to do');
  const [priority, setPriority] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [assignToMe, setAssignToMe] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset form each time the modal opens; seed list from caller or first list.
  useEffect(() => {
    if (!open) return;
    setName('');
    setStatus('to do');
    setPriority(null);
    setDueDate('');
    setAssignToMe(true);
    setListId(defaultListId ?? lists[0]?.id ?? '');
    const t = setTimeout(() => nameRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, defaultListId, lists]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && listId !== '';

  function submit() {
    if (!canSubmit) return;
    const st = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
    const pr = PRIORITIES.find((p) => p.value === priority);
    const assignees: Assignee[] =
      assignToMe && me
        ? [{ id: me.id, name: me.name, initials: me.initials, color: me.color }]
        : [];
    createTask({
      name: name.trim(),
      listId,
      status: st.value,
      statusColor: st.color,
      statusType: st.type,
      priority: pr?.value ?? null,
      priorityColor: pr?.color ?? null,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      assignees,
    });
    close();
  }

  const activeStatus = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
  const activePriority = PRIORITIES.find((p) => p.value === priority) ?? null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      <div
        role="dialog"
        aria-label="Create task"
        aria-modal="true"
        data-testid="create-task-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--cu-bg-menu, #fff)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          border: `1px solid ${BORDER}`,
          overflow: 'hidden',
        }}
      >
        {/* Header: status pill + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px 6px',
          }}
        >
          <StatusPill
            options={STATUSES.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
            value={activeStatus.value}
            label={activeStatus.label}
            color={activeStatus.color}
            onChange={(v) => setStatus(v as (typeof STATUSES)[number]['value'])}
          />
          <span style={{ flex: 1 }} />
          <button
            aria-label="Close"
            onClick={close}
            style={iconBtn}
            onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <CloseGlyph />
          </button>
        </div>

        {/* Task name */}
        <div style={{ padding: '4px 18px 6px' }}>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) submit();
            }}
            placeholder="Task name"
            aria-label="Task name"
            data-testid="create-task-name"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 22,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
              background: 'transparent',
            }}
          />
        </div>

        {/* Attribute row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '6px 18px 16px',
          }}
        >
          <SelectChip
            label="List"
            value={lists.find((l) => l.id === listId)?.name ?? 'Select list'}
            required
            testid="create-task-list-trigger"
            options={lists.map((l) => ({ value: l.id, label: l.name, sub: l.path }))}
            onChange={setListId}
          />

          <button
            type="button"
            onClick={() => setAssignToMe((v) => !v)}
            style={chip(assignToMe)}
            data-testid="create-task-assignee"
          >
            {assignToMe && me ? (
              <Avatar initials={me.initials} color={me.color} />
            ) : (
              <PersonGlyph />
            )}
            {assignToMe && me ? me.name : 'Assignee'}
          </button>

          <label style={{ ...chip(Boolean(dueDate)), cursor: 'pointer' }}>
            <CalendarGlyph />
            <span>{dueDate ? formatDate(dueDate) : 'Due date'}</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              data-testid="create-task-due"
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
          </label>

          <SelectChip
            label="Priority"
            value={activePriority?.label ?? 'Priority'}
            dotColor={activePriority?.color}
            testid="create-task-priority-trigger"
            options={[
              { value: '', label: 'None' },
              ...PRIORITIES.map((p) => ({ value: p.value, label: p.label, dot: p.color })),
            ]}
            onChange={(v) => setPriority(v === '' ? null : v)}
            leading={<FlagGlyph color={activePriority?.color} />}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span style={{ flex: 1 }} />
          <button onClick={close} style={ghostBtn}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="create-task-submit"
            style={{
              ...primaryBtn,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chips & pickers ────────────────────────────────────────────────────────

function StatusPill({
  options,
  value,
  label,
  color,
  onChange,
}: {
  options: { value: string; label: string; color: string }[];
  value: string;
  label: string;
  color: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        data-testid="create-task-status-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
          padding: '0 10px',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          color: '#fff',
          background: color,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
      {open && (
        <Dropdown>
          {options.map((o) => (
            <DropdownRow key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: o.color }} />
              <span style={{ fontWeight: value === o.value ? 600 : 400 }}>{o.label}</span>
            </DropdownRow>
          ))}
        </Dropdown>
      )}
    </span>
  );
}

interface ChipOption {
  value: string;
  label: string;
  sub?: string;
  dot?: string;
}

function SelectChip({
  label,
  value,
  options,
  onChange,
  required,
  dotColor,
  leading,
  testid,
}: {
  label: string;
  value: string;
  options: ChipOption[];
  onChange: (v: string) => void;
  required?: boolean;
  dotColor?: string;
  leading?: React.ReactNode;
  testid?: string;
}) {
  const [open, setOpen] = useState(false);
  const filled = value !== label && value !== `Select ${label.toLowerCase()}`;
  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        data-testid={testid}
        style={chip(filled, required && !filled)}
      >
        {leading ?? null}
        {dotColor && !leading ? (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor }} />
        ) : null}
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </span>
      </button>
      {open && (
        <Dropdown>
          {options.map((o) => (
            <DropdownRow key={o.value || '_none'} onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.dot ? (
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.dot }} />
              ) : null}
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block' }}>{o.label}</span>
                {o.sub ? (
                  <span style={{ display: 'block', fontSize: 11, color: TEXT_MUTED }}>{o.sub}</span>
                ) : null}
              </span>
            </DropdownRow>
          ))}
        </Dropdown>
      )}
    </span>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        minWidth: 200,
        maxHeight: 260,
        overflowY: 'auto',
        background: 'var(--cu-bg-menu, #fff)',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
        padding: '6px 0',
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}

function DropdownRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        minHeight: 32,
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TEXT_PRIMARY,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        fontSize: 9,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function flattenLists(spaces: ReturnType<typeof useSpaces>): FlatList[] {
  const out: FlatList[] = [];
  for (const space of spaces) {
    const push = (l: ListNode, path: string) => out.push({ id: l.id, name: l.name, path });
    for (const l of space.folderlessLists) push(l, space.name);
    for (const folder of space.folders) {
      for (const l of folder.lists) push(l, `${space.name} / ${folder.name}`);
    }
  }
  return out;
}

function formatDate(iso: string): string {
  return formatTaskDate(iso);
}

// ── Styles & glyphs ──────────────────────────────────────────────────────────

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: TEXT_MUTED,
};

function chip(filled: boolean, missing?: boolean): CSSProperties {
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px ${missing ? 'dashed' : 'solid'} ${missing ? '#f50000' : BORDER_STRONG}`,
    background: filled ? HOVER_BG : 'transparent',
    cursor: 'pointer',
    color: filled ? TEXT_PRIMARY : TEXT_MUTED,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
}

const ghostBtn: CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  cursor: 'pointer',
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
  height: 34,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  background: PRIMARY_BTN_BG,
  color: APP_BG,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
};

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function CalendarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function FlagGlyph({ color }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color ?? 'none'} stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinejoin="round">
      <path d="M5 21V4h13l-2 4 2 4H5" />
    </svg>
  );
}
