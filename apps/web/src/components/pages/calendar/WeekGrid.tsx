'use client';

/**
 * Week view: a single Sunday-led row of 7 tall day columns for the anchored
 * week. Shares the same chip placement + DayCell affordances as the month grid
 * (drag-to-reschedule, hover add, click-to-open). Scaffolded for parity with
 * ClickUp's day/week/4-day view-type switch; month remains the primary view.
 */

import { useCallback, useMemo, useState } from 'react';
import { ANCHOR_NOW, DAY_MS, startOfDay, type Task } from '@/lib/view-data';
import { CAL, WEEKDAY_SHORT } from './tokens';
import { DayCell } from './DayCell';
import { DayPopover } from './DayPopover';
import { buildChipIndex, type DayChip } from './chip-layout';
import type { CalendarActions } from './use-calendar-actions';

interface WeekGridProps {
  tasks: Task[];
  weekStartMs: number;
  actions: CalendarActions;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

const TODAY = startOfDay(ANCHOR_NOW);
const WEEK_CELL_HEIGHT = 520;
const WEEK_CHIP_CAP = 20;

interface PopoverState {
  dayMs: number;
  chips: DayChip[];
  anchor: { x: number; y: number };
}

export function WeekGrid({ tasks, weekStartMs, actions, onChipContextMenu }: WeekGridProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });

  const days = useMemo(() => {
    // DST-safe: add half a day before clamping to local midnight so a
    // spring-forward day still lands on 00:00 local (not 01:00). Matches the
    // local-midnight keys that buildChipIndex/spanTouchesDay rely on.
    const out: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      out.push(startOfDay(weekStartMs + i * DAY_MS + DAY_MS / 2));
    }
    return out;
  }, [weekStartMs]);

  const chipIndex = useMemo(
    () => buildChipIndex(tasks, days, WEEK_CHIP_CAP),
    [tasks, days],
  );

  const openMore = (dayMs: number) => {
    const bucket = chipIndex.get(dayMs);
    if (bucket) setPopover({ dayMs, chips: bucket.all, anchor: lastPoint });
  };

  // Stable ref so DayPopover's effect does not tear down/re-attach its document
  // listeners on every WeekGrid re-render (chip hover, drag state, etc.).
  const closePopover = useCallback(() => setPopover(null), []);

  return (
    <div
      data-testid="calendar-week-grid"
      onPointerDown={(e) => setLastPoint({ x: e.clientX, y: e.clientY })}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          height: CAL.weekdayHeaderHeight,
          flexShrink: 0,
          borderLeft: `1px solid ${CAL.gridBorder}`,
          background: CAL.headerBg,
        }}
      >
        {days.map((dayMs) => {
          const d = new Date(dayMs);
          return (
            <div
              key={dayMs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                borderRight: `1px solid ${CAL.gridBorder}`,
                borderBottom: `1px solid ${CAL.gridBorder}`,
                fontSize: 11,
                fontWeight: 600,
                color: dayMs === TODAY ? CAL.accent : CAL.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              {WEEKDAY_SHORT[d.getDay()]} {d.getDate()}
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderLeft: `1px solid ${CAL.gridBorder}`,
          borderTop: `1px solid ${CAL.gridBorder}`,
          overflowY: 'auto',
        }}
      >
        {days.map((dayMs) => {
          const d = new Date(dayMs);
          const weekday = d.getDay();
          return (
            <DayCell
              key={dayMs}
              dayMs={dayMs}
              dayNumber={d.getDate()}
              inMonth
              isToday={dayMs === TODAY}
              isPast={dayMs < TODAY}
              isWeekend={weekday === 0 || weekday === 6}
              bucket={chipIndex.get(dayMs)}
              dragActive={actions.draggingId !== null}
              onChipDragStart={actions.beginDrag}
              onChipDragEnd={actions.endDrag}
              onChipContextMenu={onChipContextMenu}
              onDropOnDay={actions.rescheduleTo}
              onQuickCreate={actions.quickCreateOnDay}
              onOpenCreate={actions.createOnDay}
              onShowMore={openMore}
              minHeight={WEEK_CELL_HEIGHT}
            />
          );
        })}
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
