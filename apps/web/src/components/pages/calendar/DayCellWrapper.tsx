'use client';

/**
 * Thin wrapper around DayCell for the month grids: captures the pointer position
 * on press so the "+N more" overflow popover can anchor near the trigger, and
 * wires the cell's drag / drop / quick-create affordances to calendar actions.
 * Memoized so unaffected cells skip re-render while a single task is dragged.
 */

import { memo, useState } from 'react';
import type { Task } from '@/lib/view-data';
import { DayCell } from './DayCell';
import type { DayChipBucket } from './chip-layout';
import type { CalendarActions } from './use-calendar-actions';

type ChipContextMenu = (e: React.MouseEvent, task: Task) => void;

interface DayCellWrapperProps {
  dayMs: number;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  bucket: DayChipBucket | undefined;
  actions: CalendarActions;
  onChipContextMenu: ChipContextMenu;
  onShowMore: (dayMs: number, point: { x: number; y: number }) => void;
}

function DayCellWrapperInner({
  dayMs,
  dayNumber,
  inMonth,
  isToday,
  isPast,
  isWeekend,
  bucket,
  actions,
  onChipContextMenu,
  onShowMore,
}: DayCellWrapperProps) {
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });
  return (
    <div
      onPointerDown={(e) => setLastPoint({ x: e.clientX, y: e.clientY })}
      style={{ display: 'contents' }}
    >
      <DayCell
        dayMs={dayMs}
        dayNumber={dayNumber}
        inMonth={inMonth}
        isToday={isToday}
        isPast={isPast}
        isWeekend={isWeekend}
        bucket={bucket}
        dragActive={actions.draggingId !== null}
        onChipDragStart={actions.beginDrag}
        onChipDragEnd={actions.endDrag}
        onChipContextMenu={onChipContextMenu}
        onDropOnDay={actions.rescheduleTo}
        onQuickCreate={actions.quickCreateOnDay}
        onOpenCreate={actions.createOnDay}
        onShowMore={(d) => onShowMore(d, lastPoint)}
      />
    </div>
  );
}

export const DayCellWrapper = memo(DayCellWrapperInner);
