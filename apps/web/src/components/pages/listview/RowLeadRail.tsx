'use client';

import { useState } from 'react';
import { statusOrder } from '@/data/status-order';
import type { Task } from '@/store/workspace/types';
import { CheckboxIcon, Chevron, DragHandleIcon } from '../list-view-icons';

const MUTED = 'var(--cu-text-muted)';
const TEXT = 'var(--cu-text-secondary)';

function isDone(task: Task): boolean {
  return task.statusType === 'closed' || task.statusType === 'done';
}

/** Drag handle (six-dot). Reveals on hover; the drag itself is wired by the row. */
export function DragHandle({
  visible,
  onPointerDown,
}: {
  visible: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <span
      data-testid="row-drag-handle"
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 14,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        color: hover ? TEXT : MUTED,
        opacity: visible ? 1 : 0,
        transition: 'opacity 90ms',
        flexShrink: 0,
        touchAction: 'none',
      }}
    >
      <DragHandleIcon size={13} />
    </span>
  );
}

/** Selection checkbox. Reveals on hover; stays visible while checked. */
export function SelectCheckbox({
  checked,
  visible,
  onToggle,
}: {
  checked: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid="row-select-checkbox"
      aria-label={checked ? 'Deselect task' : 'Select task'}
      aria-pressed={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 18,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        color: hover ? TEXT : MUTED,
        opacity: visible || checked ? 1 : 0,
        transition: 'opacity 90ms',
        flexShrink: 0,
      }}
    >
      <CheckboxIcon size={16} checked={checked} />
    </button>
  );
}

/** Subtask expand/collapse chevron. */
export function SubtaskToggle({
  expanded,
  hasSubtasks,
  visible,
  onToggle,
}: {
  expanded: boolean;
  hasSubtasks: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  // Always interactive (revealing the add-subtask affordance), but only show at
  // rest when subtasks already exist — otherwise hover-reveal like ClickUp.
  const show = hasSubtasks || visible;
  return (
    <button
      data-testid="row-subtask-toggle"
      aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
        color: hover ? TEXT : MUTED,
        opacity: show ? 1 : 0,
        transition: 'opacity 90ms',
        flexShrink: 0,
      }}
    >
      <Chevron open={expanded} />
    </button>
  );
}

/** Round status toggle (TO-DO donut → tick on complete). */
export function StatusCircle({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  const done = isDone(task);
  const color = task.statusColor || '#87909e';
  const notStarted = !done && statusOrder(task.status) === 0;
  const SIZE = 16;

  const ring = done
    ? { background: color, border: 'none' as const }
    : notStarted
      ? { background: 'transparent', border: `1.5px dashed ${color}` }
      : { background: 'transparent', border: `1.5px solid ${color}` };

  return (
    <button
      aria-label="Toggle complete"
      data-testid="list-row-checkbox"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: ring.background,
        border: ring.border,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        transition: 'background 100ms',
      }}
    >
      {done ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4 10-10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : hover ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4 10-10" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}
