'use client';

/**
 * One day cell in the month/week/day grid. ClickUp layout: the date number sits
 * at the BOTTOM-RIGHT of the cell (muted for leading/trailing/past days), chips
 * stack from the top, "+N more" collapses overflow, and a hover "+" affordance
 * (`cal-month-view__add`, a dropdown toggle in the real DOM) opens an inline
 * quick-create composer that creates a dated task on Enter. Double-clicking empty
 * cell space opens the full create-task modal. The cell is a drop target:
 * dropping a dragged chip (or a sidebar task) reschedules that task onto this day.
 *
 * The "today" cell is rendered as a 1px box outline with no fill (matching the
 * capture), and its date number gets a filled accent pill.
 */

import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/view-data';
import { PlusIcon } from '@/components/ui/Icons';
import { CAL } from './tokens';
import { EventChip } from './EventChip';
import type { DayChipBucket } from './chip-layout';

export interface DayCellProps {
  dayMs: number;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  bucket: DayChipBucket | undefined;
  dragActive: boolean;
  onChipDragStart: (taskId: string) => void;
  onChipDragEnd: () => void;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
  onDropOnDay: (taskId: string, dayMs: number) => void;
  /** Inline quick-create: (dayMs, name) → create a dated task without the modal. */
  onQuickCreate: (dayMs: number, name: string) => void;
  onShowMore: (dayMs: number) => void;
  /** Open the full create-task modal dated to this day (double-click). */
  onOpenCreate?: (dayMs: number) => void;
  /** Override the default cell min-height (week/day views use tall columns). */
  minHeight?: number;
  /** Day view stretches a single cell and renders its date in the header. */
  hideDayNumber?: boolean;
}

export function DayCell({
  dayMs,
  dayNumber,
  inMonth,
  isToday,
  isPast,
  isWeekend,
  bucket,
  dragActive,
  onChipDragStart,
  onChipDragEnd,
  onChipContextMenu,
  onDropOnDay,
  onQuickCreate,
  onShowMore,
  onOpenCreate,
  minHeight = CAL.cellMinHeight,
  hideDayNumber = false,
}: DayCellProps) {
  const [hover, setHover] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [composing, setComposing] = useState(false);

  const chips = bucket?.visible ?? [];
  const overflow = bucket?.overflow ?? 0;

  const background = dropHover ? CAL.hoverBg : CAL.bg;

  return (
    <div
      data-testid="calendar-day-cell"
      data-day={dayMs}
      data-in-month={inMonth}
      data-today={isToday}
      role="gridcell"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={(e) => {
        // Only react when the empty cell surface is double-clicked, not a chip.
        if ((e.target as HTMLElement).closest('[data-task-id]')) return;
        onOpenCreate?.(dayMs);
      }}
      onDragOver={(e) => {
        if (!dragActive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dropHover) setDropHover(true);
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropHover(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) onDropOnDay(taskId, dayMs);
      }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: CAL.chipGap,
        minHeight,
        height: '100%',
        padding: hideDayNumber ? '6px 6px' : '6px 5px 22px',
        borderRight: `1px solid ${CAL.gridBorder}`,
        borderBottom: `1px solid ${CAL.gridBorder}`,
        background,
        cursor: 'default',
        transition: 'background 100ms',
        // Today = a 1px box outline (no fill), matching the capture. The real
        // capture uses a neutral/dark border for this outline, NOT the orange
        // brand accent.
        outline: isToday ? `1px solid ${CAL.todayOutline}` : 'none',
        outlineOffset: -1,
        boxShadow: dropHover ? `inset 0 0 0 1.5px ${CAL.accent}` : 'none',
      }}
    >
      {hover && !composing && (
        <button
          type="button"
          data-testid="calendar-day-add"
          aria-label="Create task"
          title="Create task"
          onClick={(e) => {
            e.stopPropagation();
            setComposing(true);
          }}
          style={{
            position: 'absolute',
            top: 4,
            left: 5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            border: 'none',
            borderRadius: 4,
            background: CAL.hoverBg,
            color: CAL.textSecondary,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <PlusIcon size={14} />
        </button>
      )}

      {composing && (
        <QuickCreateComposer
          onSubmit={(name) => {
            onQuickCreate(dayMs, name);
            setComposing(false);
          }}
          onCancel={() => setComposing(false)}
        />
      )}

      {chips.map((chip) => (
        <EventChip
          key={`${chip.task.id}-${chip.dayMs}`}
          chip={chip}
          onDragStart={onChipDragStart}
          onDragEnd={onChipDragEnd}
          onContextMenu={onChipContextMenu}
        />
      ))}

      {overflow > 0 && (
        <button
          type="button"
          data-testid="calendar-day-more"
          onClick={(e) => {
            e.stopPropagation();
            onShowMore(dayMs);
          }}
          style={{
            alignSelf: 'flex-start',
            padding: '1px 6px',
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: CAL.textSecondary,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          +{overflow} more
        </button>
      )}

      {!hideDayNumber && (
        <DayNumber
          dayNumber={dayNumber}
          inMonth={inMonth}
          isPast={isPast}
          isWeekend={isWeekend}
        />
      )}
    </div>
  );
}

function QuickCreateComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      data-testid="calendar-quick-create"
      value={value}
      placeholder="Task name"
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onSubmit(value);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => {
        if (value.trim()) onSubmit(value);
        else onCancel();
      }}
      style={{
        width: '100%',
        height: CAL.chipHeight,
        padding: '0 6px',
        border: `1px solid ${CAL.accent}`,
        borderRadius: 4,
        background: CAL.inputBg,
        color: CAL.textPrimary,
        fontSize: 11,
        fontWeight: 500,
        outline: 'none',
        zIndex: 3,
      }}
    />
  );
}

function DayNumber({
  dayNumber,
  inMonth,
  isPast,
  isWeekend,
}: {
  dayNumber: number;
  inMonth: boolean;
  isPast: boolean;
  isWeekend: boolean;
}) {
  // In the real capture the today number is rendered exactly like every other
  // day number (plain, muted) — there is NO filled accent pill. The "today"
  // affordance is the cell outline alone.
  const color = !inMonth
    ? CAL.textMuted
    : isPast
      ? CAL.textMuted
      : isWeekend
        ? CAL.textSecondary
        : CAL.textPrimary;

  return (
    <span
      className="cal-day-number"
      style={{
        position: 'absolute',
        bottom: 4,
        right: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: 0,
        borderRadius: 0,
        background: 'transparent',
        color,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {dayNumber}
    </span>
  );
}
