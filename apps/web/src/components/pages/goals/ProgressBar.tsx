const GREEN = 'rgb(36, 174, 100)';
const TRACK = 'rgb(232, 232, 232)';

/** ClickUp Goals green progress bar. Width scales with `progress` (0–100). */
export function ProgressBar({
  progress,
  width = 120,
  height = 6,
}: {
  progress: number;
  width?: number | string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width,
        height,
        borderRadius: 9999,
        background: TRACK,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 9999,
          background: GREEN,
          transition: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

/** Round owner avatar chip. */
export function OwnerAvatar({
  owner,
  size = 22,
}: {
  owner: { initials: string; color: string };
  size?: number;
}) {
  return (
    <span
      title={owner.initials}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: owner.color,
        color: 'white',
        fontSize: size <= 20 ? 9 : 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {owner.initials}
    </span>
  );
}
