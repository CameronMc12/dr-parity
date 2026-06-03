'use client';

/**
 * Overflow popover for a single day. Opened from a cell's "+N more" trigger;
 * lists every chip for that day in a small floating panel. Closes on outside
 * click or Escape. Chips inside it still open the task modal / are draggable.
 */

import { useEffect, useRef } from 'react';
import type { Task } from '@/lib/view-data';
import { CAL, MONTH_NAMES, WEEKDAY_SHORT } from './tokens';
import { EventChip } from './EventChip';
import type { DayChip } from './chip-layout';

interface DayPopoverProps {
  dayMs: number;
  chips: DayChip[];
  anchor: { x: number; y: number };
  onClose: () => void;
  onChipDragStart: (taskId: string) => void;
  onChipDragEnd: () => void;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function DayPopover({
  dayMs,
  chips,
  anchor,
  onClose,
  onChipDragStart,
  onChipDragEnd,
  onChipContextMenu,
}: DayPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use mousedown (not pointerdown) and never dismiss when the press starts on
    // a draggable element: dragging a chip out to a day cell would otherwise
    // close the popover mid-drag, leaking the in-flight drag id.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('[draggable]')) return;
      if (ref.current && !ref.current.contains(target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [onClose]);

  const d = new Date(dayMs);
  const heading = `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

  // Keep the panel on-screen near the trigger. SSR-safe: `window` is undefined
  // during server render / hydration, so fall back to sensible defaults.
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(anchor.x, winW - 260);
  const top = Math.min(anchor.y, winH - 320);

  return (
    <div
      ref={ref}
      data-testid="calendar-day-popover"
      role="dialog"
      aria-label={`Tasks on ${heading}`}
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: Math.max(8, top),
        zIndex: 10050,
        width: 240,
        maxHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cu-bg-menu)',
        border: `1px solid ${CAL.gridBorder}`,
        borderRadius: 8,
        boxShadow: 'var(--cu-shadow-lg, 0 8px 28px rgba(0,0,0,0.5))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: `1px solid ${CAL.gridBorder}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: CAL.textPrimary }}>{heading}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: CAL.textSecondary,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: CAL.chipGap,
          padding: 8,
          overflowY: 'auto',
        }}
      >
        {chips.map((chip) => (
          <EventChip
            key={`${chip.task.id}-pop`}
            chip={{ ...chip, isSpanStart: true, isSpanEnd: true }}
            onDragStart={(taskId) => {
              // Dismiss the panel before the drag begins so it does not occlude
              // the day-cell drop targets behind it.
              onClose();
              onChipDragStart(taskId);
            }}
            onDragEnd={onChipDragEnd}
            onContextMenu={onChipContextMenu}
          />
        ))}
      </div>
    </div>
  );
}
