'use client';

/**
 * The workload grid body. A sticky left lane-label column (avatar + name +
 * scheduled total) pinned beside a horizontally-scrolling day area. The day-tick
 * header and a vertical "today" marker are drawn over the column containing
 * ANCHOR_NOW. Below the lanes sits a "Show N person without scheduled tasks in
 * this period" link that reveals/collapses empty lanes, and a +/- zoom control.
 */

import { useMemo } from 'react';
import type { Task } from '@/lib/view-data';
import { WorkloadCell } from './WorkloadCell';
import { DayTickRow, SubHeaderControls } from './WorkloadSubHeader';
import { EmptyLanesLink, ZoomControl } from './WorkloadFooter';
import { formatHours, type Day, type Lane, type WorkloadMatrix } from './periods';
import { WL, type WorkloadMetric } from './tokens';

interface WorkloadGridProps {
  lanes: Lane[];
  days: Day[];
  matrix: WorkloadMatrix;
  /** Live overload threshold (Infinity when the capacity guide is off). */
  capacity: number;
  /** Finite baseline shown in lane labels regardless of the guide toggle. */
  displayCapacity: number;
  metric: WorkloadMetric;
  colWidth: number;
  hiddenEmptyCount: number;
  showEmpty: boolean;
  onToggleEmpty: () => void;
  /** Sub-header (range stepper + eye + face) props, rendered as the header's left cell. */
  rangeLabel: string;
  onToday: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  capacityOn: boolean;
  onToggleCapacity: () => void;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function WorkloadGrid({
  lanes,
  days,
  matrix,
  capacity,
  displayCapacity,
  metric,
  colWidth,
  hiddenEmptyCount,
  showEmpty,
  onToggleEmpty,
  rangeLabel,
  onToday,
  onPrevWeek,
  onNextWeek,
  capacityOn,
  onToggleCapacity,
  onOpenTask,
  onContextMenu,
  onZoomIn,
  onZoomOut,
}: WorkloadGridProps) {
  const trackWidth = days.length * colWidth;
  const todayIndex = useMemo(() => days.findIndex((d) => d.isToday), [days]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <LaneLabelColumn
        lanes={lanes}
        matrix={matrix}
        capacity={displayCapacity}
        metric={metric}
        header={
          <SubHeaderControls
            rangeLabel={rangeLabel}
            onToday={onToday}
            onPrev={onPrevWeek}
            onNext={onNextWeek}
            showEmpty={showEmpty}
            onToggleEmpty={onToggleEmpty}
            capacityOn={capacityOn}
            onToggleCapacity={onToggleCapacity}
          />
        }
      />

      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div style={{ width: trackWidth, position: 'relative' }}>
          <DayTickRow days={days} colWidth={colWidth} />

          {todayIndex >= 0 && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: WL.headerHeight,
                bottom: 0,
                left: todayIndex * colWidth + colWidth / 2 - 1,
                width: 2,
                background: WL.todayLine,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}

          {lanes.map((lane) => (
            <LaneRow
              key={lane.id}
              days={days}
              hours={matrix.hours.get(lane.id) ?? []}
              cells={matrix.tasksByCell.get(lane.id) ?? []}
              capacity={capacity}
              metric={metric}
              colWidth={colWidth}
              onOpenTask={onOpenTask}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </div>

      <ZoomControl onZoomIn={onZoomIn} onZoomOut={onZoomOut} />

      {hiddenEmptyCount > 0 && (
        <EmptyLanesLink
          count={hiddenEmptyCount}
          showEmpty={showEmpty}
          onToggle={onToggleEmpty}
          topOffset={WL.headerHeight + lanes.length * WL.rowHeight + 16}
        />
      )}
    </div>
  );
}

function LaneRow({
  days,
  hours,
  cells,
  capacity,
  metric,
  colWidth,
  onOpenTask,
  onContextMenu,
}: {
  days: Day[];
  hours: number[];
  cells: Task[][];
  capacity: number;
  metric: WorkloadMetric;
  colWidth: number;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: WL.rowHeight,
        borderBottom: `1px solid ${WL.gridBorder}`,
      }}
    >
      {days.map((day, i) => (
        <WorkloadCell
          key={day.start}
          tasks={cells[i] ?? []}
          hours={hours[i] ?? 0}
          capacity={capacity}
          metric={metric}
          width={colWidth}
          isToday={day.isToday}
          isWeekend={day.isWeekend}
          onOpenTask={onOpenTask}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

function LaneLabelColumn({
  lanes,
  matrix,
  capacity,
  metric,
  header,
}: {
  lanes: Lane[];
  matrix: WorkloadMatrix;
  capacity: number;
  metric: WorkloadMetric;
  header: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: WL.labelColWidth,
        flexShrink: 0,
        borderRight: `1px solid ${WL.gridBorderStrong}`,
        background: WL.panelBg,
        position: 'sticky',
        left: 0,
        zIndex: 3,
      }}
    >
      <div
        style={{
          height: WL.headerHeight,
          borderBottom: `1px solid ${WL.gridBorderStrong}`,
        }}
      >
        {header}
      </div>
      {lanes.map((lane) => (
        <LaneLabel
          key={lane.id}
          lane={lane}
          total={matrix.laneTotals.get(lane.id) ?? 0}
          capacity={capacity}
          metric={metric}
        />
      ))}
    </div>
  );
}

function LaneLabel({
  lane,
  total,
  capacity,
  metric,
}: {
  lane: Lane;
  total: number;
  capacity: number;
  metric: WorkloadMetric;
}) {
  return (
    <div
      style={{
        height: WL.rowHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderBottom: `1px solid ${WL.gridBorder}`,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          flexShrink: 0,
          background: lane.color,
          color: lane.unassigned ? WL.textSecondary : '#fff',
          fontSize: 13,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: lane.unassigned ? `1px dashed ${WL.gridBorderStrong}` : 'none',
        }}
      >
        {lane.initials}
      </span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: WL.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lane.name}
        </span>
        <span style={{ fontSize: 12, color: WL.textMuted }}>
          {formatHours(total, metric)} scheduled · {formatHours(capacity, metric)}/day capacity
        </span>
      </div>
    </div>
  );
}

