'use client';

/**
 * Timeline chart body. Lays the sticky date header above a vertical stack of
 * lane bands. Each band draws weekend tints + per-day grid lines as a backdrop
 * and absolutely positions its packed bars. A single red today line runs the
 * full chart height. This column is the scrollable child; the parent flex row
 * pairs it with the sticky LaneRail.
 */

import { memo, useMemo, useRef, useState } from 'react';
import { ANCHOR_NOW } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { BACKLOG_DND_MIME } from './backlog-dnd';
import { TL } from './tokens';
import { xForMs, type TimelineAxis } from './axis';
import { laneHeight, type Swimlane } from './swimlanes';
import { TimelineHeader } from './TimelineHeader';
import { TimelineBar } from './TimelineBar';
import type { TimelineDnd } from './useTimelineDnd';

export function TimelineChart({
  axis,
  lanes,
  dnd,
  onContextMenu,
}: {
  axis: TimelineAxis;
  lanes: Swimlane[];
  dnd: TimelineDnd;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const todayX = xForMs(axis, ANCHOR_NOW);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dropX, setDropX] = useState<number | null>(null);
  const bodyHeight = useMemo(
    () => lanes.reduce((sum, l) => sum + laneHeight(l.rowCount), 0),
    [lanes],
  );

  const localXFromEvent = (e: React.DragEvent): number => {
    const rect = bodyRef.current?.getBoundingClientRect();
    return rect ? e.clientX - rect.left : 0;
  };

  return (
    <div style={{ position: 'relative', width: axis.width, minWidth: axis.width }}>
      <TimelineHeader axis={axis} />

      <div
        ref={bodyRef}
        style={{ position: 'relative' }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(BACKLOG_DND_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropX(localXFromEvent(e));
        }}
        onDragLeave={() => setDropX(null)}
        onDrop={(e) => {
          const taskId = e.dataTransfer.getData(BACKLOG_DND_MIME);
          setDropX(null);
          if (!taskId) return;
          e.preventDefault();
          dnd.scheduleAtX(taskId, localXFromEvent(e));
        }}
      >
        {/* Weekend tint columns spanning all lanes */}
        {axis.weekendDays.map((day) => (
          <div
            key={`wk-${day}`}
            style={{
              position: 'absolute',
              left: xForMs(axis, day),
              top: 0,
              width: axis.dayWidth,
              height: bodyHeight,
              background: TL.weekendTint,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Lane bands */}
        {lanes.map((lane) => (
          <LaneBand
            key={lane.key}
            lane={lane}
            axis={axis}
            dnd={dnd}
            onContextMenu={onContextMenu}
          />
        ))}

        {/* Today line over the whole body */}
        {todayX >= 0 && todayX <= axis.width && (
          <div
            style={{
              position: 'absolute',
              left: todayX,
              top: 0,
              width: 2,
              height: bodyHeight,
              background: TL.todayLine,
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Drop guide while a backlog task hovers the chart */}
        {dropX !== null && (
          <div
            style={{
              position: 'absolute',
              left: Math.round(dropX / axis.dayWidth) * axis.dayWidth,
              top: 0,
              width: axis.dayWidth,
              height: bodyHeight,
              background: 'rgba(92, 142, 255, 0.16)',
              borderLeft: '2px solid var(--cu-accent, #5c8eff)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

const LaneBand = memo(function LaneBand({
  lane,
  axis,
  dnd,
  onContextMenu,
}: {
  lane: Swimlane;
  axis: TimelineAxis;
  dnd: TimelineDnd;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const height = laneHeight(lane.rowCount);

  // One index per day, rebuilt only when the day count actually changes — not on
  // every drag delta tick, which previously recreated dayCount divs per lane per
  // pointermove (600+ nodes at month zoom × 10 lanes).
  const dayIndices = useMemo(
    () => Array.from({ length: axis.dayCount }, (_, i) => i),
    [axis.dayCount],
  );
  const showGridlines = axis.dayWidth >= 18;

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: axis.width,
        borderBottom: `1px solid ${TL.gridBorder}`,
      }}
    >
      {/* Faint day gridlines (only when columns are wide enough to read) */}
      {showGridlines &&
        dayIndices.map((i) => (
          <div
            key={`g-${i}`}
            style={{
              position: 'absolute',
              left: i * axis.dayWidth,
              top: 0,
              width: 1,
              height,
              background: TL.gridBorder,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
        ))}

      {lane.packed.map((item) => (
        <TimelineBar
          key={item.task.id}
          item={item}
          axis={axis}
          dnd={dnd}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
});
