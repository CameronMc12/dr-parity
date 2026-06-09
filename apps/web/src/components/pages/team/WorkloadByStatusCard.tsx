'use client';

/**
 * Workload-by-Status donut. Renders the two captured slices (IN PROGRESS 1 /
 * TO DO 11) as arcs with thin leader lines to outside labels. Pure SVG so it
 * stays crisp at any DPR; arc maths is local to avoid pulling in a chart lib.
 */

import { OverviewCard } from './OverviewCard';
import { OVERVIEW, STATUS_SLICE } from './overview-tokens';
import { WORKLOAD_STATUS } from './overview-data';

const SIZE = 150;
const CENTER = SIZE / 2;
const RADIUS = 52;
const STROKE = 22;
const GAP_DEG = 4;

interface Slice {
  label: string;
  count: number;
  color: string;
}

const SLICES: Slice[] = [
  { label: 'IN PROGRESS', count: WORKLOAD_STATUS.inProgress, color: STATUS_SLICE.inProgress },
  { label: 'TO DO', count: WORKLOAD_STATUS.toDo, color: STATUS_SLICE.toDo },
];

export function WorkloadByStatusCard() {
  const total = SLICES.reduce((n, s) => n + s.count, 0) || 1;

  let cursor = -90;
  const arcs = SLICES.map((slice) => {
    const sweep = (slice.count / total) * 360;
    const start = cursor + GAP_DEG / 2;
    const end = cursor + sweep - GAP_DEG / 2;
    const mid = cursor + sweep / 2;
    cursor += sweep;
    return { slice, start, end, mid };
  });

  return (
    <OverviewCard title="Workload by Status" minHeight={180}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
          {arcs.map(({ slice, start, end, mid }) => (
            <g key={slice.label}>
              <path
                d={arcPath(start, end)}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
              />
              <Leader mid={mid} color={slice.color} />
            </g>
          ))}
        </svg>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {SLICES.map((slice) => (
            <li
              key={slice.label}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: slice.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: OVERVIEW.textMuted }}>
                {slice.label}{' '}
                <span style={{ color: OVERVIEW.textBody, fontWeight: 600 }}>{slice.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewCard>
  );
}

/** Thin leader tick from the arc midpoint outward. */
function Leader({ mid, color }: { mid: number; color: string }) {
  const inner = polar(RADIUS + STROKE / 2, mid);
  const outer = polar(RADIUS + STROKE / 2 + 8, mid);
  return (
    <line
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      stroke={color}
      strokeWidth={1}
      opacity={0.6}
    />
  );
}

function polar(r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number): string {
  const start = polar(RADIUS, startDeg);
  const end = polar(RADIUS, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}
