'use client';

/**
 * One month block in the continuously-scrolling month stack: a "June 2026"
 * label header followed by the 6×7 DayCell grid for that month. Chip placement
 * is scoped to this block's own grid days and memoized, so scrolling through
 * dozens of months never recomputes every block. Leading/trailing days from
 * adjacent months are muted (out-of-month) but still drop targets.
 */

import { memo, useMemo } from 'react';
import { type Task, startOfDay } from '@/lib/view-data';
import { CAL } from './tokens';
import { DayCellWrapper } from './DayCellWrapper';
import { type MonthBlock as MonthBlockData, buildBlock } from './month-blocks';
import { type DayChip, buildChipIndex } from './chip-layout';
import type { CalendarActions } from './use-calendar-actions';

type ChipContextMenu = (e: React.MouseEvent, task: Task) => void;
type ShowMore = (dayMs: number, point: { x: number; y: number }, chips: DayChip[]) => void;

interface MonthBlockProps {
  monthKey: number;
  tasks: Task[];
  cap: number;
  today: number;
  actions: CalendarActions;
  onChipContextMenu: ChipContextMenu;
  onShowMore: ShowMore;
}

function MonthBlockInner({
  monthKey,
  tasks,
  cap,
  today,
  actions,
  onChipContextMenu,
  onShowMore,
}: MonthBlockProps) {
  const block: MonthBlockData = useMemo(() => buildBlock(monthKey), [monthKey]);
  const gridDays = useMemo(() => block.range.weeks.flat(), [block.range.weeks]);
  const chipIndex = useMemo(
    () => buildChipIndex(tasks, gridDays, cap),
    [tasks, gridDays, cap],
  );

  const monthStartDay = startOfDay(block.range.monthStart);
  const monthEndDay = startOfDay(block.range.monthEnd);

  // Resolve the day's full chip list from this block's index, then bubble up so
  // the parent can render a single shared "+N more" popover.
  const showMore = (dayMs: number, point: { x: number; y: number }) => {
    onShowMore(dayMs, point, chipIndex.get(dayMs)?.all ?? []);
  };

  return (
    <section data-testid="calendar-month-block" data-month={monthKey}>
      <h3
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 3,
          margin: 0,
          padding: '8px 12px',
          background: CAL.headerBg,
          borderBottom: `1px solid ${CAL.gridBorder}`,
          borderLeft: `1px solid ${CAL.gridBorder}`,
          fontSize: 14,
          fontWeight: 600,
          color: CAL.textPrimary,
        }}
      >
        {block.label}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${block.range.weeks.length}, minmax(${CAL.cellMinHeight}px, 1fr))`,
          borderLeft: `1px solid ${CAL.gridBorder}`,
          borderTop: `1px solid ${CAL.gridBorder}`,
        }}
      >
        {block.range.weeks.map((week) => (
          <div
            key={week[0]}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
          >
            {week.map((dayMs) => {
              const d = new Date(dayMs);
              const inMonth = dayMs >= monthStartDay && dayMs <= monthEndDay;
              const weekday = d.getDay();
              return (
                <DayCellWrapper
                  key={dayMs}
                  dayMs={dayMs}
                  dayNumber={d.getDate()}
                  inMonth={inMonth}
                  isToday={dayMs === today}
                  isPast={dayMs < today}
                  isWeekend={weekday === 0 || weekday === 6}
                  bucket={chipIndex.get(dayMs)}
                  actions={actions}
                  onChipContextMenu={onChipContextMenu}
                  onShowMore={showMore}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export const MonthBlock = memo(MonthBlockInner);
