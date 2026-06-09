/**
 * Goal-card circular progress ring, sampled 1:1 from the captured oracle:
 *   viewBox 0 0 60 60, r=24, 6px stroke, round line cap, a small head dot, and
 *   centered "<n>%" text. Track + progress map to design tokens so the ring
 *   stays visible in dark mode (track = subtle border, progress = neutral text).
 */

const TRACK = 'var(--cu-border)';
const PROGRESS = 'var(--cu-text-secondary)';
const RADIUS = 24;
const CENTER = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ percent, size = 60 }: { percent: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * CIRCUMFERENCE;
  // Head-dot angle: progress starts at 12 o'clock and runs clockwise.
  const angle = (clamped / 100) * 2 * Math.PI - Math.PI / 2;
  const dotX = CENTER + RADIUS * Math.cos(angle);
  const dotY = CENTER + RADIUS * Math.sin(angle);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={TRACK} strokeWidth={6} />
      {clamped > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={PROGRESS}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      )}
      <circle cx={dotX} cy={dotY} r={2.4} fill={PROGRESS} />
      <text x={CENTER} y={CENTER} textAnchor="middle" fill={PROGRESS}>
        <tspan x={CENTER} y={CENTER} dy="0.32em" fontSize={20} fontWeight="normal">
          {clamped}
        </tspan>
        <tspan fontSize={10} fontWeight="normal">
          %
        </tspan>
      </text>
    </svg>
  );
}
