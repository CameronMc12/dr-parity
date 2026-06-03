'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { formatTaskDate } from '@/lib/format-date';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

function isDone(task: Task): boolean {
  return task.statusType === 'closed' || task.statusType === 'done';
}

/**
 * One task row, used in My Tasks and dashboard widgets. Provides the complete
 * checkbox, inline rename (double-click the name), and an overflow menu with
 * Delete. `dense` trims paddings for the compact widget context.
 */
export function TaskRow({ task, dense }: { task: Task; dense?: boolean }) {
  const toggle = useWorkspaceStore((s) => s.toggleTaskComplete);
  const update = useWorkspaceStore((s) => s.updateTask);
  const remove = useWorkspaceStore((s) => s.deleteTask);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = isDone(task);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const next = draft.trim();
    if (next && next !== task.name) update(task.id, { name: next });
    else setDraft(task.name);
    setEditing(false);
  }

  return (
    <div
      data-testid="task-row"
      data-task-id={task.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMenuOpen(false);
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: dense ? 34 : 40,
        padding: dense ? '0 6px' : '0 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: hover ? HOVER_BG : 'transparent',
      }}
    >
      <button
        type="button"
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        data-testid="task-complete"
        onClick={() => toggle(task.id)}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `2px solid ${done ? '#6bc950' : 'rgb(190,190,190)'}`,
          background: done ? '#6bc950' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        {done ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
        ) : null}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(task.name);
              setEditing(false);
            }
          }}
          data-testid="task-rename-input"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            fontSize: dense ? 13 : 14,
            color: TEXT_PRIMARY,
            background: 'transparent',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => {
            setDraft(task.name);
            setEditing(true);
          }}
          data-testid="task-name"
          title="Double-click to rename"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: dense ? 13 : 14,
            color: done ? TEXT_MUTED : TEXT_PRIMARY,
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'text',
          }}
        >
          {task.name}
        </span>
      )}

      {task.priority ? (
        <span
          title={`Priority: ${PRIORITY_LABELS[task.priority] ?? task.priority}`}
          style={{
            fontSize: 11,
            color: task.priorityColor ?? TEXT_MUTED,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: task.priorityColor ?? TEXT_MUTED }} />
          {!dense ? PRIORITY_LABELS[task.priority] ?? task.priority : null}
        </span>
      ) : null}

      {task.dueDate ? (
        <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>
          {formatTaskDate(task.dueDate)}
        </span>
      ) : null}

      {!dense ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            color: '#fff',
            background: task.statusColor,
            flexShrink: 0,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          {task.status}
        </span>
      ) : null}

      {task.assignees[0] ? (
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: task.assignees[0].color,
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {task.assignees[0].initials}
        </span>
      ) : null}

      <button
        type="button"
        aria-label="Task actions"
        data-testid="task-menu-trigger"
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          ...overflowBtn,
          visibility: hover || menuOpen ? 'visible' : 'hidden',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          onMouseLeave={() => setMenuOpen(false)}
          style={{
            position: 'absolute',
            top: '100%',
            right: 8,
            marginTop: 2,
            minWidth: 140,
            background: 'var(--cu-bg-menu, #fff)',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            padding: '6px 0',
            zIndex: 60,
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="task-rename"
            onClick={() => {
              setMenuOpen(false);
              setDraft(task.name);
              setEditing(true);
            }}
            style={menuRow(TEXT_PRIMARY)}
            onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="task-delete"
            onClick={() => {
              setMenuOpen(false);
              remove(task.id);
            }}
            style={menuRow('#e5343d')}
            onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

const overflowBtn: CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  color: TEXT_MUTED,
  flexShrink: 0,
};

function menuRow(color: string): CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    minHeight: 30,
    padding: '0 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color,
    fontSize: 13,
    textAlign: 'left',
    fontFamily: 'inherit',
  };
}
