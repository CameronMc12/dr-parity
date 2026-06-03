'use client';

/**
 * One Gantt bar. Renders a task's resolved span as a rounded bar positioned on
 * the timeline axis, coloured by status or priority. Supports:
 *   - whole-bar drag (move → reschedule start+due)
 *   - edge drag (resize → change duration)
 *   - click (open the task modal)
 * The live drag delta is applied as a transform/width preview before commit.
 */

import { useRef, useState } from 'react';
import { deriveSpan, startOfDay } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { useUiStore } from '@/store/ui-store';
import { GANTT } from './tokens';
import { barRect, xForMs, type TimelineAxis } from './timeline';
import type { GanttColorBy } from './GanttView';
import type { GanttDnd } from './useGanttDnd';

const HANDLE_W = 7;

function barColor(task: Task, colorBy: GanttColorBy): string {
  if (colorBy === 'priority') return task.priorityColor || GANTT.gridBorderStrong;
  return task.statusColor || '#87909e';
}

export function GanttBar({
  task,
  axis,
  rowHeight,
  colorBy,
  critical = false,
  dnd,
  onContextMenu,
}: {
  task: Task;
  axis: TimelineAxis;
  rowHeight: number;
  colorBy: GanttColorBy;
  /** Draw a red critical-path outline around this bar. */
  critical?: boolean;
  dnd: GanttDnd;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const [hover, setHover] = useState(false);
  // True once a gesture has moved far enough to count as a drag (not a click).
  const draggedRef = useRef(false);

  const span = deriveSpan(task);
  const rect = barRect(axis, span);
  const color = barColor(task, colorBy);

  const dragging = dnd.activeId === task.id;
  const delta = dragging ? dnd.deltaPx : 0;
  if (dragging && Math.abs(delta) > 3) draggedRef.current = true;

  // Apply the live preview: move shifts both edges, resize shifts one.
  let x = rect.x;
  let width = rect.width;
  if (dragging) {
    if (dnd.mode === 'move') x += delta;
    else if (dnd.mode === 'resize-start') {
      x += delta;
      width -= delta;
    } else if (dnd.mode === 'resize-end') {
      width += delta;
    }
    width = Math.max(axis.dayWidth, width);
  }

  const top = (rowHeight - GANTT.barHeight) / 2;
  const labelInside = width > 64;
  const assignee = task.assignees[0];

  return (
    <div
      data-testid="gantt-bar-row"
      data-task-id={task.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'absolute', left: 0, top: 0, width: axis.width, height: rowHeight }}
    >
      <div
        data-testid="gantt-bar"
        role="button"
        tabIndex={0}
        aria-label={`${task.name} timeline bar`}
        onClick={() => {
          // Suppress the click that ends a real drag; allow a clean click.
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          openTask(task.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTask(task.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, task)}
        onPointerDown={(e) => {
          draggedRef.current = false;
          dnd.onBarPointerDown(task, 'move')(e);
        }}
        style={{
          position: 'absolute',
          left: x,
          top,
          width,
          height: GANTT.barHeight,
          background: color,
          borderRadius: GANTT.barRadius,
          cursor: dragging && dnd.mode === 'move' ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 8,
          paddingRight: 8,
          boxShadow: critical
            ? `0 0 0 1.5px ${GANTT.criticalLine}`
            : hover || dragging
              ? '0 0 0 1px rgba(255,255,255,0.25)'
              : 'none',
          touchAction: 'none',
          overflow: 'hidden',
          userSelect: 'none',
          transition: dragging ? 'none' : 'box-shadow 100ms',
          opacity: span.real ? 1 : 0.82,
        }}
      >
        {/* resize-start handle */}
        <span
          data-testid="gantt-bar-resize-start"
          onPointerDown={(e) => {
            e.stopPropagation();
            draggedRef.current = false;
            dnd.onBarPointerDown(task, 'resize-start')(e);
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: HANDLE_W,
            height: '100%',
            cursor: 'ew-resize',
            opacity: hover ? 1 : 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.28), transparent)',
            touchAction: 'none',
          }}
        />
        {assignee && (
          <span
            title={assignee.name}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.28)',
              color: '#fff',
              fontSize: 8,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {assignee.initials}
          </span>
        )}
        {labelInside && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {task.name}
          </span>
        )}
        {/* resize-end handle */}
        <span
          data-testid="gantt-bar-resize-end"
          onPointerDown={(e) => {
            e.stopPropagation();
            draggedRef.current = false;
            dnd.onBarPointerDown(task, 'resize-end')(e);
          }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: HANDLE_W,
            height: '100%',
            cursor: 'ew-resize',
            opacity: hover ? 1 : 0,
            background: 'linear-gradient(to left, rgba(0,0,0,0.28), transparent)',
            touchAction: 'none',
          }}
        />
      </div>

      {/* label trailing the bar when it's too narrow to hold text */}
      {!labelInside && (
        <span
          style={{
            position: 'absolute',
            left: x + width + 8,
            top,
            height: GANTT.barHeight,
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 11,
            color: GANTT.textSecondary,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {task.name}
        </span>
      )}
    </div>
  );
}

/**
 * Milestone marker for a due-date-only task (no span). Renders a yellow diamond
 * at the task's date with a trailing label. Click opens the task; right-click
 * opens the shared context menu. Milestones aren't draggable (no span to resize).
 */
export function GanttMilestone({
  task,
  axis,
  rowHeight,
  onContextMenu,
}: {
  task: Task;
  axis: TimelineAxis;
  rowHeight: number;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const [hover, setHover] = useState(false);

  const span = deriveSpan(task);
  const cx = xForMs(axis, startOfDay(span.start)) + axis.dayWidth / 2;
  const size = GANTT.milestoneSize;
  const top = (rowHeight - size) / 2;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: axis.width, height: rowHeight }}>
      <div
        data-testid="gantt-milestone"
        data-task-id={task.id}
        role="button"
        tabIndex={0}
        aria-label={`${task.name} milestone`}
        onClick={() => openTask(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTask(task.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, task)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'absolute',
          left: cx - size / 2,
          top,
          width: size,
          height: size,
          background: GANTT.milestone,
          transform: 'rotate(45deg)',
          borderRadius: 3,
          cursor: 'pointer',
          boxShadow: hover ? '0 0 0 2px rgba(255,191,0,0.35)' : 'none',
          transition: 'box-shadow 100ms',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: cx + size,
          top,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 11,
          color: GANTT.textSecondary,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {task.name}
      </span>
    </div>
  );
}
