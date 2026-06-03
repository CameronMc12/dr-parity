'use client';

import { useState } from 'react';
import {
  groupStatusOptions,
  listStatusOptions,
} from '@/components/pages/listview/statuses';
import type { Assignee, Member, Task } from '@/store/workspace/types';
import { Popover } from './Popover';
import { CheckIcon, ChevronRightSmallIcon } from './icons';

export const PRIORITY_OPTIONS: { name: string; color: string }[] = [
  { name: 'Urgent', color: '#e23f29' },
  { name: 'High', color: '#f8ae00' },
  { name: 'Normal', color: '#6395fa' },
  { name: 'Low', color: '#d8d8d8' },
];

function DropRow({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 32,
        background: hover ? 'var(--cu-bg-hover, #2a2a2a)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--cu-text-primary, #eee)',
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {children}
      </span>
      {active && (
        <span style={{ color: 'var(--cu-accent, #7b68ee)', display: 'flex' }}>
          <CheckIcon size={14} />
        </span>
      )}
    </button>
  );
}

// ── Status pill + editor ───────────────────────────────────────────────────

export function StatusField({
  task,
  listTasks,
  onChange,
}: {
  task: Task;
  /** Every task in this task's List, so the option set matches the list cell. */
  listTasks: Task[];
  onChange: (patch: Partial<Task>) => void;
}) {
  const groups = groupStatusOptions(listStatusOptions(listTasks));
  return (
    <Popover
      width={220}
      trigger={({ onClick, open }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          data-testid="panel-status-trigger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 24,
            padding: '0 8px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.02em',
            textTransform: 'uppercase',
            color: '#fff',
            background: task.statusColor,
          }}
        >
          {task.status}
          <ChevronRightSmallIcon size={12} />
        </button>
      )}
    >
      {(close) => (
        <>
          {groups.map((g) => (
            <div key={g.heading} data-testid="panel-status-section">
              <DropSectionLabel>{g.heading}</DropSectionLabel>
              {g.options.map((s) => (
                <DropRow
                  key={s.status}
                  active={s.status === task.status}
                  onClick={() => {
                    onChange({ status: s.status, statusColor: s.statusColor, statusType: s.statusType });
                    close();
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: s.statusColor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>
                    {s.status}
                  </span>
                </DropRow>
              ))}
            </div>
          ))}
        </>
      )}
    </Popover>
  );
}

function DropSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 12px 4px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'var(--cu-text-muted, #7b7b7b)',
      }}
    >
      {children}
    </div>
  );
}

export function StatusCompleteToggle({
  task,
  onChange,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const done = task.statusType === 'closed' || task.statusType === 'done';
  return (
    <button
      type="button"
      title="Mark complete"
      onClick={() =>
        onChange(
          done
            ? { status: 'to do', statusColor: '#87909e', statusType: 'open' }
            : { status: 'complete', statusColor: '#64c6a2', statusType: 'closed' },
        )
      }
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: done ? '#64c6a2' : 'var(--cu-text-muted, #7b7b7b)',
      }}
    >
      <CheckIcon size={16} />
    </button>
  );
}

// ── Priority editor ─────────────────────────────────────────────────────────

export function PriorityField({
  task,
  onChange,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const current = task.priority;
  return (
    <Popover
      width={200}
      trigger={({ onClick }) => (
        <ValueButton onClick={onClick} empty={!current}>
          {current ? (
            <>
              <FlagSwatch color={task.priorityColor ?? '#d8d8d8'} />
              <span style={{ textTransform: 'capitalize' }}>{current}</span>
            </>
          ) : (
            'Empty'
          )}
        </ValueButton>
      )}
    >
      {(close) => (
        <>
          {PRIORITY_OPTIONS.map((p) => (
            <DropRow
              key={p.name}
              active={p.name.toLowerCase() === current?.toLowerCase()}
              onClick={() => {
                onChange({ priority: p.name.toLowerCase(), priorityColor: p.color });
                close();
              }}
            >
              <FlagSwatch color={p.color} />
              {p.name}
            </DropRow>
          ))}
          {current && (
            <DropRow
              onClick={() => {
                onChange({ priority: null, priorityColor: null });
                close();
              }}
            >
              <span style={{ color: 'var(--cu-text-muted, #7b7b7b)' }}>Clear</span>
            </DropRow>
          )}
        </>
      )}
    </Popover>
  );
}

function FlagSwatch({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Assignee editor ─────────────────────────────────────────────────────────

export function AssigneeField({
  task,
  members,
  onChange,
}: {
  task: Task;
  members: Member[];
  onChange: (patch: Partial<Task>) => void;
}) {
  const selectedIds = new Set(task.assignees.map((a) => a.id));

  function toggle(member: Member) {
    const next: Assignee[] = selectedIds.has(member.id)
      ? task.assignees.filter((a) => a.id !== member.id)
      : [
          ...task.assignees,
          { id: member.id, name: member.name, initials: member.initials, color: member.color },
        ];
    onChange({ assignees: next });
  }

  return (
    <Popover
      width={240}
      trigger={({ onClick }) => (
        <ValueButton onClick={onClick} empty={task.assignees.length === 0}>
          {task.assignees.length === 0 ? (
            'Empty'
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {task.assignees.map((a) => (
                <AvatarChip key={a.id} initials={a.initials} color={a.color} />
              ))}
            </span>
          )}
        </ValueButton>
      )}
    >
      {() => (
        <>
          {members.map((m) => (
            <DropRow key={m.id} active={selectedIds.has(m.id)} onClick={() => toggle(m)}>
              <AvatarChip initials={m.initials} color={m.color} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
            </DropRow>
          ))}
        </>
      )}
    </Popover>
  );
}

export function AvatarChip({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        fontSize: 10,
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

// ── Date editor (start / due) ────────────────────────────────────────────────

function toInputValue(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromInputValue(v: string): number | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function fmtDate(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

export function DateField({
  field,
  label,
  value,
  icon,
  onChange,
}: {
  field: 'startDate' | 'dueDate';
  label: string;
  value: number | null;
  icon: React.ReactNode;
  onChange: (patch: Partial<Task>) => void;
}) {
  return (
    <Popover
      width={240}
      trigger={({ onClick }) => (
        <button
          type="button"
          onClick={onClick}
          data-testid={`panel-date-${field}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 24,
            padding: '0 4px',
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            color: value ? 'var(--cu-text-primary, #eee)' : 'var(--cu-text-muted, #7b7b7b)',
          }}
        >
          <span style={{ display: 'flex', color: 'var(--cu-text-muted, #7b7b7b)' }}>{icon}</span>
          {value ? fmtDate(value) : label}
        </button>
      )}
    >
      {(close) => (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="date"
            defaultValue={toInputValue(value)}
            autoFocus
            onChange={(e) => onChange({ [field]: fromInputValue(e.target.value) } as Partial<Task>)}
            style={{
              width: '100%',
              height: 32,
              padding: '0 8px',
              borderRadius: 6,
              border: '1px solid var(--cu-border-divider, #333)',
              background: 'var(--cu-bg-input, #222)',
              color: 'var(--cu-text-primary, #eee)',
              fontFamily: 'inherit',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />
          {value != null && (
            <button
              type="button"
              onClick={() => {
                onChange({ [field]: null } as Partial<Task>);
                close();
              }}
              style={{
                height: 28,
                border: '1px solid var(--cu-border-divider, #333)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--cu-text-secondary, #aaa)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

// ── Generic "Empty" value button ─────────────────────────────────────────────

export function ValueButton({
  onClick,
  empty,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  empty?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 6px',
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        background: hover ? 'var(--cu-bg-hover, #2a2a2a)' : 'transparent',
        color: empty ? 'var(--cu-text-muted, #7b7b7b)' : 'var(--cu-text-primary, #eee)',
      }}
    >
      {children}
    </button>
  );
}
