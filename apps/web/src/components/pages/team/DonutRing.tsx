'use client';

/**
 * Completion donut, 1:1 with ClickUp's `circle-progress` in the user-box stat:
 * a thin green ring filled to `pct`% over a muted track, with the percentage
 * centred. Defaults to the ~46px capture size. Stroke-dasharray drives the arc.
 */

import { TEAM } from './tokens';

interface DonutRingProps {
  pct: number;
  size?: number;
  stroke?: number;
}

export function DonutRing({ pct, size = 46, stroke = 4 }: DonutRingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);

  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TEAM.track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TEAM.done}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 280ms ease' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: 11,
          fontWeight: 500,
          color: TEAM.textSecondary,
        }}
      >
        {clamped}%
      </span>
    </span>
  );
}
