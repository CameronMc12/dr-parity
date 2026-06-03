'use client';

/**
 * Right timeline pane of the Gantt. Owns the canonical scroll (horizontal +
 * vertical). Renders a sticky two-row date header (week band + day ticks with
 * weekday/date and a red TODAY badge), weekend diagonal-hatch tints, a red
 * "today" vertical line, one grid row per GanttRow, the task bars / milestone
 * dots, the dependency-link overlay, and a floating +/- zoom control.
 */

import { forwardRef } from 'react';
import { ANCHOR_NOW } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { GANTT } from './tokens';
import { xForMs, type TimelineAxis, type BandCell, type DayTick } from './timeline';
import type { GanttRow } from './rows';
import { taskRowsOnly } from './rows';
import { GanttBar, GanttMilestone } from './GanttBar';
import { GanttLinks } from './GanttLinks';
import { GanttBaselineBar } from './GanttBaseline';
import type { GanttColorBy } from './GanttView';
import type { DependencyMode } from './tokens';
import type { GanttDnd } from './useGanttDnd';

/** Baseline span (snapshot start/end ms) keyed by task id. */
export type BaselineMap = Record<string, { start: number; end: number }>;

function BandHeaderCell({ band }: { band: BandCell }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: band.x,
        top: 0,
        width: band.width,
        height: GANTT.weekBandHeight,
        borderLeft: `1px solid ${GANTT.gridBorder}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        fontSize: 11,
        fontWeight: 600,
        color: GANTT.textSecondary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {band.label}
    </div>
  );
}

function DayHeaderCell({ tick }: { tick: DayTick }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: tick.x,
        top: 0,
        bottom: 0,
        width: tick.width,
        borderLeft: `1px solid ${GANTT.gridBorder}`,
        background: tick.weekend ? GANTT.weekendHatch : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 10, color: GANTT.textMuted, lineHeight: 1 }}>{tick.weekday}</span>
      {tick.today ? (
        <span
          data-testid="gantt-today-badge"
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 9,
            background: GANTT.todayBadgeBg,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {tick.date}
        </span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 500, color: GANTT.textPrimary, lineHeight: 1 }}>
          {tick.date}
        </span>
      )}
    </div>
  );
}

function ZoomStepper({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  const btn: React.CSSProperties = {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: GANTT.panelBg,
    border: `1px solid ${GANTT.gridBorder}`,
    cursor: 'pointer',
    color: GANTT.textSecondary,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'inherit',
    lineHeight: 1,
  };
  return (
    <div
      data-testid="gantt-zoom-stepper"
      style={{
        position: 'sticky',
        top: GANTT.headerHeight + 8,
        float: 'right',
        right: 12,
        marginRight: 12,
        zIndex: 4,
        display: 'inline-flex',
        height: 0,
      }}
    >
      <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', boxShadow: 'var(--cu-shadow-md)' }}>
        <button
          data-testid="gantt-zoom-out"
          aria-label="Zoom out"
          onClick={onZoomOut}
          style={{ ...btn, borderRight: 'none', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
        >
          −
        </button>
        <button
          data-testid="gantt-zoom-in"
          aria-label="Zoom in"
          onClick={onZoomIn}
          style={{ ...btn, borderTopRightRadius: 6, borderBottomRightRadius: 6 }}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface TimelineProps {
  axis: TimelineAxis;
  rows: GanttRow[];
  colorBy: GanttColorBy;
  dependencyMode: DependencyMode;
  /** Highlight the critical path (red outline on connected bars + red links). */
  criticalPath: boolean;
  /** Saved baselines to draw as ghost bars behind each live bar, or undefined. */
  baselines?: BaselineMap;
  dnd: GanttDnd;
  /** Called on every scroll frame with the live vertical offset (no re-render). */
  onScroll: (scrollTop: number) => void;
  /** Right-click handler for each task bar (shared task context menu). */
  onTaskContextMenu: (e: React.MouseEvent, task: Task) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const GanttTimeline = forwardRef<HTMLDivElement, TimelineProps>(
  function GanttTimeline(
    { axis, rows, colorBy, dependencyMode, criticalPath, baselines, dnd, onScroll, onTaskContextMenu, onZoomIn, onZoomOut },
    ref,
  ) {
    const bodyHeight = rows.length * GANTT.rowHeight;
    const todayX = xForMs(axis, ANCHOR_NOW);

    // Vertical center y per task row (for dependency-link geometry).
    const taskRows = taskRowsOnly(rows);
    const rowIndex = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === 'task') rowIndex.set(r.task.id, i);
    });
    const linkRows = taskRows.map((r) => ({
      task: r.task,
      centerY: (rowIndex.get(r.task.id) ?? 0) * GANTT.rowHeight + GANTT.rowHeight / 2,
    }));

    return (
      <div
        ref={ref}
        data-testid="gantt-timeline"
        onScroll={(e) => onScroll((e.currentTarget as HTMLDivElement).scrollTop)}
        style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative', background: GANTT.bg }}
      >
        <ZoomStepper onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
        <div style={{ width: axis.width, position: 'relative' }}>
          {/* sticky two-row date header: week band + day ticks */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              height: GANTT.headerHeight,
              background: GANTT.bg,
              borderBottom: `1px solid ${GANTT.gridBorderStrong}`,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, height: GANTT.weekBandHeight, width: axis.width }}>
              {axis.bands.map((b) => (
                <BandHeaderCell key={`b-${b.start}`} band={b} />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                top: GANTT.weekBandHeight,
                left: 0,
                bottom: 0,
                width: axis.width,
                borderTop: `1px solid ${GANTT.gridBorder}`,
              }}
            >
              {axis.dayTicks.map((t) => (
                <DayHeaderCell key={`t-${t.day}`} tick={t} />
              ))}
            </div>
          </div>

          {/* scrollable chart body */}
          <div style={{ position: 'relative', height: bodyHeight, width: axis.width }}>
            {/* weekend column tints (diagonal hatch) */}
            {axis.weekendDays.map((d) => (
              <div
                key={`w-${d}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: xForMs(axis, d),
                  width: axis.dayWidth,
                  height: bodyHeight,
                  background: GANTT.weekendHatch,
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* today vertical marker (red) */}
            {todayX >= 0 && todayX <= axis.width && (
              <div
                data-testid="gantt-today-line"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: todayX,
                  width: 2,
                  height: bodyHeight,
                  background: GANTT.todayLine,
                  opacity: 0.9,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            )}

            {/* row grid lines + bars / milestones */}
            {rows.map((row, i) => {
              const top = i * GANTT.rowHeight;
              if (row.kind !== 'task') {
                return (
                  <div
                    key={row.key}
                    style={{
                      position: 'absolute',
                      top,
                      left: 0,
                      width: axis.width,
                      height: GANTT.rowHeight,
                      borderBottom: `1px solid ${GANTT.gridBorder}`,
                      background: row.kind === 'group' ? 'rgba(255,255,255,0.012)' : 'transparent',
                    }}
                  />
                );
              }
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top,
                    left: 0,
                    width: axis.width,
                    height: GANTT.rowHeight,
                    borderBottom: `1px solid ${GANTT.gridBorder}`,
                  }}
                >
                  {baselines?.[row.task.id] && (
                    <GanttBaselineBar
                      axis={axis}
                      rowHeight={GANTT.rowHeight}
                      span={baselines[row.task.id]!}
                    />
                  )}
                  {row.milestone ? (
                    <GanttMilestone
                      task={row.task}
                      axis={axis}
                      rowHeight={GANTT.rowHeight}
                      onContextMenu={onTaskContextMenu}
                    />
                  ) : (
                    <GanttBar
                      task={row.task}
                      axis={axis}
                      rowHeight={GANTT.rowHeight}
                      colorBy={colorBy}
                      critical={criticalPath && (row.task.linkedTaskIds?.length ?? 0) > 0}
                      dnd={dnd}
                      onContextMenu={onTaskContextMenu}
                    />
                  )}
                </div>
              );
            })}

            <GanttLinks
              rows={linkRows}
              axis={axis}
              totalHeight={bodyHeight}
              mode={dependencyMode}
            />
          </div>
        </div>
      </div>
    );
  },
);
