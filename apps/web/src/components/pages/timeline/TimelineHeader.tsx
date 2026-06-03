'use client';

/**
 * Sticky two-row date header for the Timeline chart. Top row is the month band,
 * bottom row is the per-zoom tick row (day numbers / week-of / month). A red
 * today marker is drawn over the header at ANCHOR_NOW. Scrolls horizontally in
 * lockstep with the lane body but stays pinned to the top (sticky).
 */

import { ANCHOR_NOW, DAY_MS, startOfDay } from '@/lib/view-data';
import { TL } from './tokens';
import { xForMs, type TimelineAxis } from './axis';

const TODAY_DAY = startOfDay(ANCHOR_NOW);

export function TimelineHeader({ axis }: { axis: TimelineAxis }) {
  const todayX = xForMs(axis, ANCHOR_NOW);

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        width: axis.width,
        height: TL.headerHeight,
        background: TL.headerBg,
        borderBottom: `1px solid ${TL.gridBorderStrong}`,
      }}
    >
      {/* Month band */}
      <div style={{ position: 'relative', height: TL.monthBandHeight }}>
        {axis.months.map((m) => (
          <div
            key={m.start}
            style={{
              position: 'absolute',
              left: m.x,
              top: 0,
              width: m.width,
              height: TL.monthBandHeight,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
              fontSize: 11,
              fontWeight: 600,
              color: TL.textSecondary,
              borderRight: `1px solid ${TL.gridBorder}`,
              borderBottom: `1px solid ${TL.gridBorder}`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Tick row */}
      <div style={{ position: 'relative', height: TL.headerHeight - TL.monthBandHeight }}>
        {axis.ticks.map((t) => {
          // Highlight the day tick covering ANCHOR_NOW with a red badge so the
          // header echoes ClickUp's "today is N" marker. The badge always
          // renders regardless of zoom; only its size/centring scale with the
          // column width so it stays legible from Day (44px) down to Month (7px).
          const isToday = startOfDay(t.start) <= TODAY_DAY && TODAY_DAY < t.start + DAY_MS;
          const centered = axis.dayWidth >= 40;
          const badgeSize = Math.min(20, Math.max(14, axis.dayWidth - 4));
          return (
            <div
              key={t.start}
              style={{
                position: 'absolute',
                left: t.x,
                top: 0,
                width: t.width,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: centered || isToday ? 'center' : 'flex-start',
                paddingLeft: centered || isToday ? 0 : 6,
                fontSize: 11,
                color: isToday ? '#fff' : TL.textMuted,
                fontWeight: isToday ? 600 : 400,
                borderRight: `1px solid ${TL.gridBorder}`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {isToday ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: badgeSize,
                    height: badgeSize,
                    padding: centered ? '0 4px' : 0,
                    borderRadius: 999,
                    background: TL.todayLine,
                    color: '#fff',
                    fontSize: badgeSize >= 18 ? 11 : 9,
                  }}
                >
                  {t.label}
                </span>
              ) : (
                t.label
              )}
            </div>
          );
        })}
      </div>

      {/* Today marker head */}
      {todayX >= 0 && todayX <= axis.width && (
        <div
          style={{
            position: 'absolute',
            left: todayX,
            top: 0,
            width: 2,
            height: TL.headerHeight,
            background: TL.todayLine,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: -3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: TL.todayLine,
            }}
          />
        </div>
      )}
    </div>
  );
}
