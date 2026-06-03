'use client';

/**
 * A single workload cell: one assignee's scheduled load for one day, shown as a
 * green-tinted capacity pill ("<N>h"). When the day's load exceeds the daily
 * capacity baseline the pill turns red. Empty days read a muted "0h".
 *
 * Hovering a non-empty cell opens a popover listing that day's tasks; each pill
 * opens the task modal on click and the task context menu on right-click. The
 * popover is portalled to `document.body` so it escapes the grid's
 * `overflow:auto` clipping ancestor.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '@/lib/view-data';
import { WL, type WorkloadMetric } from './tokens';
import { formatHours } from './periods';

interface WorkloadCellProps {
  tasks: Task[];
  hours: number;
  capacity: number;
  metric: WorkloadMetric;
  width: number;
  isToday: boolean;
  isWeekend: boolean;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

const POPOVER_WIDTH = 248;
const POPOVER_MAX_HEIGHT = 280;
const VIEWPORT_MARGIN = 8;

export function WorkloadCell({
  tasks,
  hours,
  capacity,
  metric,
  width,
  isToday,
  isWeekend,
  onOpenTask,
  onContextMenu,
}: WorkloadCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const empty = hours < 0.05;
  const over = hours > capacity + 0.05;
  const label = formatHours(hours, metric);

  return (
    <div
      ref={cellRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width,
        flexShrink: 0,
        height: '100%',
        borderRight: `1px solid ${WL.gridBorder}`,
        background: isToday
          ? WL.todayTint
          : isWeekend
            ? WL.weekendHatch
            : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12px',
        transition: 'background 120ms',
        ...(hover && !empty ? { background: WL.hover } : null),
      }}
    >
      {!empty && (
        <span
          title={`${label} scheduled · capacity ${capacity}h`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 48,
            height: 30,
            padding: '0 12px',
            borderRadius: WL.radiusFull,
            fontSize: 13,
            fontWeight: 700,
            background: over ? WL.pillOverBg : WL.pillUnderBg,
            color: over ? WL.pillOverText : WL.pillUnderText,
            transition: 'background 120ms, color 120ms',
          }}
        >
          {label}
        </span>
      )}

      {hover && !empty && tasks.length > 0 && (
        <CellPopover
          anchorRef={cellRef}
          tasks={tasks}
          label={label}
          onOpenTask={onOpenTask}
          onContextMenu={onContextMenu}
        />
      )}
    </div>
  );
}

interface PopoverPosition {
  left: number;
  top: number;
}

/** Viewport-clamped position anchored to the cell; flips above when tight. */
function computePosition(rect: DOMRect): PopoverPosition {
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove =
    spaceBelow < POPOVER_MAX_HEIGHT + VIEWPORT_MARGIN && rect.top > spaceBelow;
  const top = openAbove
    ? Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_MAX_HEIGHT - 4)
    : rect.bottom + 4;
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left + 8),
    Math.max(VIEWPORT_MARGIN, maxLeft),
  );
  return { left, top };
}

function CellPopover({
  anchorRef,
  tasks,
  label,
  onOpenTask,
  onContextMenu,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  tasks: Task[];
  label: string;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const [pos, setPos] = useState<PopoverPosition | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setPos(computePosition(anchor.getBoundingClientRect()));
  }, [anchorRef, tasks.length]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      role="dialog"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 1000,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        overflowY: 'auto',
        background: WL.menuBg,
        border: `1px solid ${WL.gridBorderStrong}`,
        borderRadius: WL.radiusMd,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: WL.textMuted,
          padding: '4px 8px 6px',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label} scheduled · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </div>
      {tasks.map((task) => (
        <TaskPill
          key={task.id}
          task={task}
          onOpenTask={onOpenTask}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>,
    document.body,
  );
}

function TaskPill({
  task,
  onOpenTask,
  onContextMenu,
}: {
  task: Task;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="workload-task-pill"
      onClick={() => onOpenTask(task.id)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        background: hover ? WL.hover : 'transparent',
        border: 'none',
        borderRadius: WL.radiusSm,
        cursor: 'pointer',
        textAlign: 'left',
        color: WL.textPrimary,
        fontSize: 13,
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: task.statusColor || WL.textMuted,
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.name}
      </span>
    </button>
  );
}
