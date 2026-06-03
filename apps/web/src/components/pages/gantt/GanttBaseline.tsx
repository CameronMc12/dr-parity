'use client';

/**
 * Baseline ghost-bar. Drawn behind the live Gantt bar to show a task's saved
 * baseline span, so a viewer can see how far the current schedule has drifted
 * from the snapshot. Pointer-inert; purely a visual reference layer.
 */

import { GANTT } from './tokens';
import { barRect, type TimelineAxis } from './timeline';

const BASELINE_HEIGHT = 6;

export function GanttBaselineBar({
  axis,
  rowHeight,
  span,
}: {
  axis: TimelineAxis;
  rowHeight: number;
  span: { start: number; end: number };
}) {
  const rect = barRect(axis, { start: span.start, end: span.end, real: true });
  // Sit just below the live bar's vertical band.
  const top = (rowHeight - GANTT.barHeight) / 2 + GANTT.barHeight - 1;

  return (
    <div
      data-testid="gantt-baseline-bar"
      aria-hidden
      style={{
        position: 'absolute',
        left: rect.x,
        top,
        width: rect.width,
        height: BASELINE_HEIGHT,
        background: GANTT.baselineFill,
        borderRadius: 3,
        pointerEvents: 'none',
        opacity: 0.85,
      }}
    />
  );
}
