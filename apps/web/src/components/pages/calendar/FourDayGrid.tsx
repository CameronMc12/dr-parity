'use client';

/**
 * 4-days view: a strip of 4 consecutive tall day columns starting at the anchor.
 * Shares the chip placement + DayCell affordances of the month/week grids
 * (drag-to-reschedule, hover quick-create, click-to-open). Part of the real
 * ClickUp "Time period" set (Day / 4 days / Week / Month).
 */

import { useCallback, useMemo, useState } from 'react';
import { ANCHOR_NOW, DAY_MS, type Task, startOfDay } from '@/lib/view-data';
import { CAL, WEEKDAY_SHORT } from './tokens';
import { DayCell } from './DayCell';
import { DayPopover } from './DayPopover';
import { type DayChip, buildChipIndex } from './chip-layout';
import type { CalendarActions } from './use-calendar-actions';

interface FourDayGridProps {
  tasks: Task[];
  startMs: number;
  actions: CalendarActions;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

const TODAY = startOfDay(ANCHOR_NOW);
const STRIP_CELL_HEIGHT = 520;
const STRIP_CHIP_CAP = 20;
const DAY_COUNT = 4;

interface PopoverState {
  dayMs: number;
  chips: DayChip[];
  anchor: { x: number; y: number };
}

export function FourDayGrid({ tasks, startMs, actions, onChipContextMenu }: FourDayGridProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });

  const days = useMemo(() => {
    // DST-safe: add half a day before clamping to local midnight.
    const out: number[] = [];
    for (let i = 0; i < DAY_COUNT; i += 1) {
      out.push(startOfDay(startMs + i * DAY_MS + DAY_MS / 2));
    }
    return out;
  }, [startMs]);

  const chipIndex = useMemo(
    () => buildChipIndex(tasks, days, STRIP_CHIP_CAP),
    [tasks, days],
  );

  const closePopover = useCallback(() => setPopover(null), []);
  const openMore = (dayMs: number) => {
    const bucket = chipIndex.get(dayMs);
    if (bucket) setPopover({ dayMs, chips: bucket.all, anchor: lastPoint });
  };

  return (
    <div
      data-testid="calendar-fourday-grid"
      onPointerDown={(e) => setLastPoint({ x: e.clientX, y: e.clientY })}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${DAY_COUNT}, 1fr)`,
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
          gridTemplateColumns: `repeat(${DAY_COUNT}, 1fr)`,
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
              minHeight={STRIP_CELL_HEIGHT}
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
