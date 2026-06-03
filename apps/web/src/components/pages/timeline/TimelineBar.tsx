'use client';

/**
 * One packed Timeline bar. Renders a task's resolved span as a rounded,
 * status-coloured bar positioned on the time axis and stacked at its packed row.
 * Supports horizontal drag-to-reschedule, click-to-open, and right-click for the
 * shared task context menu. The live drag delta is applied as a transform
 * preview before commit.
 */

import { useState } from 'react';
import type { Task } from '@/lib/view-data';
import { useUiStore } from '@/store/ui-store';
import { TL } from './tokens';
import { barRect, type TimelineAxis } from './axis';
import { rowTop, type PackedTask } from './swimlanes';
import type { TimelineDnd } from './useTimelineDnd';

export function TimelineBar({
  item,
  axis,
  dnd,
  onContextMenu,
}: {
  item: PackedTask;
  axis: TimelineAxis;
  dnd: TimelineDnd;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const [hover, setHover] = useState(false);

  const { task, span } = item;
  const rect = barRect(axis, span);
  const color = task.statusColor || TL.laneFallback;

  const dragging = dnd.activeId === task.id;
  const delta = dragging ? dnd.deltaPx : 0;

  const left = rect.x + (dragging ? delta : 0);
  const top = rowTop(item.row);
  const labelInside = rect.width > 56;
  const assignee = task.assignees[0];

  return (
    <div
      data-testid="timeline-bar"
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      aria-label={`${task.name} timeline bar`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onClick={() => {
        // Suppress the trailing click that follows a drag gesture.
        if (dnd.hasMoved()) return;
        openTask(task.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      onPointerDown={(e) => {
        dnd.onBarPointerDown(task)(e);
      }}
      style={{
        position: 'absolute',
        left,
        top,
        width: rect.width,
        height: TL.barHeight,
        background: color,
        borderRadius: TL.barRadius,
        cursor: dragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 8,
        boxShadow: hover || dragging ? '0 0 0 1px rgba(255,255,255,0.28)' : 'none',
        touchAction: 'none',
        overflow: 'hidden',
        userSelect: 'none',
        transition: dragging ? 'none' : 'box-shadow 120ms',
        opacity: span.real ? 1 : 0.82,
      }}
    >
      {assignee && (
        <span
          title={assignee.name}
          style={{
            width: 16,
            height: 16,
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
            fontSize: 11.5,
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
    </div>
  );
}
