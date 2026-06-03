'use client';

/**
 * Dependency link layer. Draws finish-to-start elbow connectors between tasks
 * that declare `linkedTaskIds`. Source = right edge of the predecessor bar;
 * target = left edge of the dependent bar. Rendered as one absolutely-positioned
 * SVG overlaying the chart rows. Gracefully renders nothing when no links exist.
 */

import { deriveSpan } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { GANTT } from './tokens';
import type { DependencyMode } from './tokens';
import { barRect, type TimelineAxis } from './timeline';

interface RowGeom {
  task: Task;
  /** Vertical center y of the task's bar. */
  centerY: number;
}

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  // Step out from the predecessor's end, drop/rise to the target row, step in.
  const out = 12;
  return `M ${x1} ${y1} H ${x1 + out} V ${y2} H ${x2}`;
}

export function GanttLinks({
  rows,
  axis,
  totalHeight,
  mode,
}: {
  rows: RowGeom[];
  axis: TimelineAxis;
  totalHeight: number;
  mode: DependencyMode;
}) {
  const dashed = mode === 'waiting';
  const byId = new Map<string, RowGeom>();
  for (const r of rows) byId.set(r.task.id, r);

  const segments: { id: string; d: string; tx: number; ty: number }[] = [];
  for (const row of rows) {
    const links = row.task.linkedTaskIds ?? [];
    for (const targetId of links) {
      const target = byId.get(targetId);
      if (!target) continue;
      const fromRect = barRect(axis, deriveSpan(row.task));
      const toRect = barRect(axis, deriveSpan(target.task));
      const x1 = fromRect.x + fromRect.width;
      const y1 = row.centerY;
      const x2 = toRect.x;
      const y2 = target.centerY;
      segments.push({
        id: `${row.task.id}->${targetId}`,
        d: elbowPath(x1, y1, x2, y2),
        tx: x2,
        ty: y2,
      });
    }
  }

  if (segments.length === 0) return null;

  return (
    <svg
      data-testid="gantt-links"
      width={axis.width}
      height={totalHeight}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {segments.map((s) => (
        <g key={s.id}>
          <path
            d={s.d}
            fill="none"
            stroke={GANTT.linkLine}
            strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined}
            opacity={0.7}
          />
          <path
            d={`M ${s.tx - 5} ${s.ty - 3.5} L ${s.tx} ${s.ty} L ${s.tx - 5} ${s.ty + 3.5} Z`}
            fill={GANTT.linkLine}
            opacity={0.85}
          />
        </g>
      ))}
    </svg>
  );
}
