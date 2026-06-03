'use client';

/**
 * Day view: a single tall column for the anchored day. Shares the chip
 * placement + DayCell affordances of the month/week grids (drag-to-reschedule,
 * hover quick-create, click-to-open). The header reads the full weekday + date;
 * the column body is one DayCell stretched to fill the viewport.
 */

import { useCallback, useMemo, useState } from 'react';
import { ANCHOR_NOW, startOfDay, type Task } from '@/lib/view-data';
import { CAL, WEEKDAY_LABELS, MONTH_SHORT } from './tokens';
import { DayCell } from './DayCell';
import { DayPopover } from './DayPopover';
import { buildChipIndex, type DayChip } from './chip-layout';
import type { CalendarActions } from './use-calendar-actions';

interface DayGridProps {
  tasks: Task[];
  dayStartMs: number;
  actions: CalendarActions;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

const TODAY = startOfDay(ANCHOR_NOW);
const DAY_CELL_HEIGHT = 560;
const DAY_CHIP_CAP = 40;

interface PopoverState {
  dayMs: number;
  chips: DayChip[];
  anchor: { x: number; y: number };
}

export function DayGrid({ tasks, dayStartMs, actions, onChipContextMenu }: DayGridProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });

  const days = useMemo(() => [dayStartMs], [dayStartMs]);
  const chipIndex = useMemo(
    () => buildChipIndex(tasks, days, DAY_CHIP_CAP),
    [tasks, days],
  );

  const closePopover = useCallback(() => setPopover(null), []);
  const openMore = (dayMs: number) => {
    const bucket = chipIndex.get(dayMs);
    if (bucket) setPopover({ dayMs, chips: bucket.all, anchor: lastPoint });
  };

  const d = new Date(dayStartMs);
  const weekday = d.getDay();
  const heading = `${WEEKDAY_LABELS[weekday]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

  return (
    <div
      data-testid="calendar-day-grid"
      onPointerDown={(e) => setLastPoint({ x: e.clientX, y: e.clientY })}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          height: CAL.weekdayHeaderHeight,
          flexShrink: 0,
          borderLeft: `1px solid ${CAL.gridBorder}`,
          borderBottom: `1px solid ${CAL.gridBorder}`,
          background: CAL.headerBg,
          fontSize: 12,
          fontWeight: 600,
          color: weekday === 0 || weekday === 6 ? CAL.textSecondary : CAL.textPrimary,
          textTransform: 'uppercase',
        }}
      >
        {heading}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr',
          borderLeft: `1px solid ${CAL.gridBorder}`,
          overflowY: 'auto',
        }}
      >
        <DayCell
          dayMs={dayStartMs}
          dayNumber={d.getDate()}
          inMonth
          isToday={dayStartMs === TODAY}
          isPast={dayStartMs < TODAY}
          isWeekend={weekday === 0 || weekday === 6}
          bucket={chipIndex.get(dayStartMs)}
          dragActive={actions.draggingId !== null}
          onChipDragStart={actions.beginDrag}
          onChipDragEnd={actions.endDrag}
          onChipContextMenu={onChipContextMenu}
          onDropOnDay={actions.rescheduleTo}
          onQuickCreate={actions.quickCreateOnDay}
          onShowMore={openMore}
          minHeight={DAY_CELL_HEIGHT}
          hideDayNumber
        />
      </div>

      {popover && (
        <DayPopover
          dayMs={popover.dayMs}
          chips={popover.chips}
          anchor={popover.anchor}
          onClose={closePopover}
          onChipDragStart={actions.beginDrag}
          onChipDragEnd={actions.endDrag}
          onChipContextMenu={onChipContextMenu}
        />
      )}
    </div>
  );
}
