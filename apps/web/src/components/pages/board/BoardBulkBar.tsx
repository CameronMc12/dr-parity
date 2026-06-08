'use client';

/**
 * Board-level floating bulk-action bar. Shown while ≥1 card is selected on the
 * Kanban board. Mirrors the listview BulkActionBar's dark floating-pill visual
 * style, but lives in the board folder so the board owns its own bulk affordance.
 *
 * Each action applies to EVERY selected task id via the shared workspace store:
 *   - Set status   -> updateTask(status/statusColor/statusType)
 *   - Set priority -> updateTask(priority/priorityColor)
 *   - Set assignee -> updateTask(assignees)
 *   - Delete       -> deleteTasks(ids)
 *   - Clear        -> ui-store clearSelection
 *
 * Reads selection from the shared ui-store (selectedTaskIds) so List / Table /
 * Board all share one selection model. The status options are derived from the
 * board's visible columns so "Set status" only offers statuses that exist in
 * the current scope.
 */

import { useState, type ReactNode } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useMembers } from '@/store/workspace/hooks';
import type { Assignee } from '@/store/workspace/types';
import type { StatusColumn } from '@/lib/view-data';
import {
  DeleteIcon,
  FlagOutline,
  PersonAddIcon,
  ClosedIcon,
} from '../list-view-icons';
import { PRIORITY_OPTIONS } from '../listview/statuses';

const BAR_BG = 'rgb(30, 30, 30)';
const BORDER = 'var(--cu-border-strong, rgba(255,255,255,0.14))';
const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-secondary)';
const OVERDUE = 'rgb(226, 67, 41)';
const MENU_BG = 'rgb(38, 38, 38)';
const MENU_HOVER = 'rgba(255,255,255,0.08)';

interface StatusChoice {
  status: string;
  color: string;
  statusType: string;
}

/** Distinct status choices from the visible board columns (first column wins). */
function statusChoicesFrom(columns: StatusColumn[]): StatusChoice[] {
  const seen = new Set<string>();
  const out: StatusChoice[] = [];
  for (const col of columns) {
    const key = col.status.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      status: col.status,
      color: col.color,
      statusType: col.statusType || col.tasks[0]?.statusType || 'custom',
    });
  }
  return out;
}

export function BoardBulkBar({ columns }: { columns: StatusColumn[] }) {
  const selected = useUiStore((s) => s.selectedTaskIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const deleteTasks = useWorkspaceStore((s) => s.deleteTasks);
  const members = useMembers();

  const [openMenu, setOpenMenu] = useState<'status' | 'priority' | 'assignee' | null>(null);

  if (selected.length === 0) return null;

  const closeMenu = () => setOpenMenu(null);

  const applyStatus = (c: StatusChoice) => {
    for (const id of selected) {
      updateTask(id, { status: c.status, statusColor: c.color, statusType: c.statusType });
    }
    closeMenu();
  };

  const applyPriority = (key: string | null, color: string | null) => {
    for (const id of selected) updateTask(id, { priority: key, priorityColor: color });
    closeMenu();
  };

  const applyAssignee = (assignee: Assignee | null) => {
    const assignees = assignee
      ? [{ id: assignee.id, name: assignee.name, initials: assignee.initials, color: assignee.color }]
      : [];
    for (const id of selected) updateTask(id, { assignees });
    closeMenu();
  };

  const handleDelete = () => {
    deleteTasks(selected);
    clearSelection();
  };

  const statusChoices = statusChoicesFrom(columns);

  return (
    <div
      data-testid="board-bulk-bar"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 48,
        padding: '0 8px 0 16px',
        background: BAR_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        zIndex: 50,
        animation: 'cuBoardBulkIn 140ms ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 22,
          padding: '0 6px',
          background: 'var(--cu-accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        {selected.length}
      </span>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginRight: 6 }}>selected</span>

      <span style={{ width: 1, height: 22, background: BORDER, margin: '0 4px' }} />

      <BarMenu
        label="Set status"
        icon={<ClosedIcon size={15} />}
        open={openMenu === 'status'}
        onToggle={() => setOpenMenu((m) => (m === 'status' ? null : 'status'))}
      >
        {statusChoices.map((c) => (
          <MenuRow key={c.status} onClick={() => applyStatus(c)}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
            <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
              {c.status}
            </span>
          </MenuRow>
        ))}
      </BarMenu>

      <BarMenu
        label="Set priority"
        icon={<FlagOutline size={15} color="currentColor" />}
        open={openMenu === 'priority'}
        onToggle={() => setOpenMenu((m) => (m === 'priority' ? null : 'priority'))}
      >
        {PRIORITY_OPTIONS.map((p) => (
          <MenuRow key={p.key} onClick={() => applyPriority(p.key, p.color)}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            {p.label}
          </MenuRow>
        ))}
        <MenuRow onClick={() => applyPriority(null, null)}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', border: `1px solid ${MUTED}`, flexShrink: 0 }} />
          None
        </MenuRow>
      </BarMenu>

      <BarMenu
        label="Set assignee"
        icon={<PersonAddIcon size={15} color="currentColor" />}
        open={openMenu === 'assignee'}
        onToggle={() => setOpenMenu((m) => (m === 'assignee' ? null : 'assignee'))}
      >
        {members.map((m) => (
          <MenuRow key={m.id} onClick={() => applyAssignee(m)}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: m.color,
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {m.initials}
            </span>
            {m.name}
          </MenuRow>
        ))}
        <MenuRow onClick={() => applyAssignee(null)}>
          <PersonAddIcon size={15} color="currentColor" />
          Unassign
        </MenuRow>
      </BarMenu>

      <BarButton label="Delete" danger icon={<DeleteIcon />} onClick={handleDelete} />

      <span style={{ width: 1, height: 22, background: BORDER, margin: '0 4px' }} />

      <BarButton
        label="Clear"
        icon={<span style={{ fontSize: 15, lineHeight: 1 }}>×</span>}
        onClick={clearSelection}
      />

      <style>{`@keyframes cuBoardBulkIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}

function BarButton({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = danger ? OVERDUE : hover ? TEXT : MUTED;
  return (
    <button
      data-testid={`board-bulk-${label.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={barBtnStyle(hover, color)}
    >
      <span style={{ display: 'inline-flex', color }}>{icon}</span>
      {label}
    </button>
  );
}

function BarMenu({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const color = open || hover ? TEXT : MUTED;
  return (
    <span style={{ position: 'relative' }}>
      <button
        data-testid={`board-bulk-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={barBtnStyle(open || hover, color)}
      >
        <span style={{ display: 'inline-flex', color }}>{icon}</span>
        {label}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            minWidth: 180,
            maxHeight: 280,
            overflowY: 'auto',
            background: MENU_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            padding: '6px 0',
            zIndex: 60,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

function MenuRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
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
        background: hover ? MENU_HOVER : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TEXT,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function barBtnStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 10px',
    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
}
