'use client';

/**
 * A single calendar event chip. Status-coloured (ClickUp `colorTasksBy`),
 * native-draggable to reschedule, and opens the task modal on click. Multi-day
 * runs square off their interior edges so the chip reads as a continuous bar.
 */

import { useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import type { Task } from '@/lib/view-data';
import { CAL } from './tokens';
import type { DayChip } from './chip-layout';

interface EventChipProps {
  chip: DayChip;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

/** Mix the status colour with transparency for the chip background. */
function chipBg(color: string, hover: boolean): string {
  return `color-mix(in srgb, ${color} ${hover ? 28 : 18}%, transparent)`;
}

export function EventChip({ chip, onDragStart, onDragEnd, onContextMenu }: EventChipProps) {
  const [hover, setHover] = useState(false);
  const openTask = useUiStore((s) => s.openTask);
  const { task, color, real, isSpanStart, isSpanEnd } = chip;

  const radiusLeft = isSpanStart ? 4 : 0;
  const radiusRight = isSpanEnd ? 4 : 0;

  return (
    <button
      type="button"
      draggable
      data-testid="calendar-event"
      data-task-id={task.id}
      title={task.name}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        openTask(task.id);
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
        gap: 5,
        width: '100%',
        height: CAL.chipHeight,
        marginLeft: isSpanStart ? 0 : -2,
        marginRight: isSpanEnd ? 0 : -2,
        padding: '0 6px',
        background: chipBg(color, hover),
        border: 'none',
        borderRadius: `${radiusLeft}px ${radiusRight}px ${radiusRight}px ${radiusLeft}px`,
        cursor: 'pointer',
        textAlign: 'left',
        opacity: real ? 1 : 0.78,
        transition: 'background 120ms',
        overflow: 'hidden',
      }}
    >
      {isSpanStart && (
        <span
          style={{
            width: 3,
            height: 12,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: CAL.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {isSpanStart ? task.name : ' '}
      </span>
    </button>
  );
}
