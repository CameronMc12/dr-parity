'use client';

/**
 * One row in the calendar task sidebar: a status circle + task name. Native
 * draggable (drag onto a day cell to schedule it) and opens the task modal on
 * click. Mirrors the List view's lead-rail status circle styling.
 */

import { useState } from 'react';
import type { Task } from '@/lib/view-data';
import { useUiStore } from '@/store/ui-store';
import { CAL } from './tokens';

interface SidebarTaskRowProps {
  task: Task;
  overdue?: boolean;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

function statusRing(task: Task): { background: string; border: string } {
  const color = task.statusColor || '#87909e';
  const done = task.statusType === 'closed' || task.statusType === 'done';
  if (done) return { background: color, border: 'none' };
  const notStarted = task.statusType === 'open';
  return { background: 'transparent', border: `1.5px ${notStarted ? 'dashed' : 'solid'} ${color}` };
}

export function SidebarTaskRow({
  task,
  overdue = false,
  onDragStart,
  onDragEnd,
  onContextMenu,
}: SidebarTaskRowProps) {
  const [hover, setHover] = useState(false);
  const openTask = useUiStore((s) => s.openTask);
  const ring = statusRing(task);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="calendar-sidebar-task"
      data-task-id={task.id}
      title={task.name}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, task)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: '0 8px',
        borderRadius: 6,
        background: hover ? CAL.hoverBg : 'transparent',
        cursor: 'grab',
        transition: 'background 120ms',
        userSelect: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: ring.background,
          border: ring.border,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 500,
          color: CAL.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {task.name}
      </span>
      {overdue && task.dueDate != null && (
        <span style={{ fontSize: 11, color: CAL.overdue, flexShrink: 0 }}>
          {formatDue(task.dueDate)}
        </span>
      )}
    </div>
  );
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDue(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}
