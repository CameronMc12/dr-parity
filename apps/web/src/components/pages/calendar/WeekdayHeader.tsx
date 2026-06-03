'use client';

/**
 * Sunday-led weekday header row (ClickUp default `showWeekends:true`). Sticks to
 * the top of the scrolling month stack so the day-of-week labels stay visible
 * while month blocks scroll past.
 */

import { CAL, WEEKDAY_LABELS } from './tokens';

export function WeekdayHeader({ sticky = false }: { sticky?: boolean }) {
  return (
    <div
      data-testid="calendar-weekday-header"
      style={{
        position: sticky ? 'sticky' : 'static',
        top: 0,
        zIndex: 4,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        height: CAL.weekdayHeaderHeight,
        flexShrink: 0,
        borderLeft: `1px solid ${CAL.gridBorder}`,
        background: CAL.headerBg,
      }}
    >
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '0 10px',
            borderRight: `1px solid ${CAL.gridBorder}`,
            borderBottom: `1px solid ${CAL.gridBorder}`,
            fontSize: 12,
            fontWeight: 500,
            color: CAL.textSecondary,
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
