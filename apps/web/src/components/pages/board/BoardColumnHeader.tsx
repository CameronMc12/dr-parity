'use client';

/**
 * Board-group header: status indicator glyph + status-colored label + WIP count,
 * with a hover-revealed "+ add task" button and a kebab (group actions menu).
 * Mirrors ClickUp's `board-group-header` anatomy. Collapse chevron lives at the
 * far left. The label colour is the group's status colour mapped to dark tokens.
 */

import { useState } from 'react';
import type { StatusColumn } from '@/lib/view-data';
import { Chevron } from '../list-view-icons';
import { GroupKebabMenu } from './GroupKebabMenu';
import { StatusGroupIcon, statusGroupKind } from './StatusGroupIcon';
import { BOARD } from './tokens';

function HeaderIconButton({
  testid,
  label,
  onClick,
  children,
  visible,
}: {
  testid: string;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  visible: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid={testid}
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? BOARD.iconHoverBg : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: BOARD.textSecondary,
        opacity: visible ? 1 : 0,
        transition: 'opacity 90ms, background 90ms',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export function BoardColumnHeader({
  column,
  statusType,
  count,
  collapsed,
  onToggle,
  onAdd,
  onCollapseAll,
  onDeleteGroup,
}: {
  column: StatusColumn;
  statusType: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onCollapseAll?: () => void;
  onDeleteGroup?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const kind = statusGroupKind(statusType, column.status);

  return (
    <div
      data-testid="board-column-header"
      data-test={`board-group-header__colored_${column.status.toLowerCase()}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 6px 0 6px',
        flexShrink: 0,
      }}
    >
      <button
        data-testid="board-column-collapse"
        aria-label={collapsed ? `Expand ${column.status}` : `Collapse ${column.status}`}
        aria-expanded={!collapsed}
        onClick={onToggle}
        style={{
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: BOARD.textSecondary,
          opacity: hover ? 1 : 0,
          transition: 'opacity 90ms',
          flexShrink: 0,
        }}
      >
        <Chevron open={!collapsed} />
      </button>

      <StatusGroupIcon kind={kind} color={column.color} size={16} />

      <span
        data-testid="board-column-name"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: column.color,
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {column.status}
      </span>

      <span
        data-testid="board-column-count"
        data-test="board-grouping-wip-label"
        style={{ fontSize: 12, fontWeight: 600, color: BOARD.textMuted, flexShrink: 0 }}
      >
        {count}
      </span>

      <span style={{ flex: 1 }} />

      <HeaderIconButton
        testid="board-column-add"
        label={`Add task to ${column.status}`}
        onClick={onAdd}
        visible={hover}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </HeaderIconButton>

      <GroupKebabMenu
        status={column.status}
        canDelete={!!onDeleteGroup}
        onAddTask={onAdd}
        onCollapse={onToggle}
        onCollapseAll={onCollapseAll}
        onDelete={onDeleteGroup}
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-testid="board-column-menu"
            aria-label={`${column.status} group actions`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={onClick}
            style={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: open ? BOARD.iconHoverBg : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: BOARD.textSecondary,
              opacity: hover || open ? 1 : 0,
              transition: 'opacity 90ms, background 90ms',
              flexShrink: 0,
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        )}
      />
    </div>
  );
}

/** Accent "+ Add Task" link rendered at the top of every group body (ClickUp `board-group__create-task-button`). */
export function AddTaskRow({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid="board-group-add-task"
      data-test="board-group__create-task-button__Add Task"
      aria-label="Add Task"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        width: '100%',
        padding: '0 8px',
        background: hover ? BOARD.cardHoverBg : 'transparent',
        border: 'none',
        borderRadius: BOARD.cardRadius,
        cursor: 'pointer',
        color: BOARD.accent,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'background 90ms',
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Add Task
    </button>
  );
}
