import { TEXT_SECONDARY } from '../page-primitives';

/**
 * Goal progress ring. Oracle: a thin light-grey track, a single dark dot marker
 * at the 12-o'clock start position, and the percentage centred inside.
 */
export function ProgressRing({ progress, size = 76 }: { progress: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgb(229, 229, 229)" strokeWidth={stroke} />
        {filled > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="rgb(36, 174, 100)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
      </svg>
      {/* start-position dot marker */}
      <span
        style={{
          position: 'absolute',
          top: stroke / 2,
          left: '50%',
          width: 5,
          height: 5,
          marginLeft: -2.5,
          borderRadius: 9999,
          background: 'rgb(120, 120, 120)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 500,
          color: TEXT_SECONDARY,
        }}
      >
        {Math.round(progress)}%
      </span>
    </div>
  );
}
