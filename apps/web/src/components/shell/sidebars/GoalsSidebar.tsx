'use client';

/**
 * Goals sidebar. The real Goals landing shows no expanded secondary panel: the
 * left is just the icon rail. We mirror that with a minimal panel carrying only
 * a thin "Goals" header, so the surface reads 1:1 with the captured oracle.
 */
export function GoalsSidebar() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--cu-font)',
      }}
    >
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--cu-text-primary)', fontSize: 15, fontWeight: 700 }}>Goals</span>
      </div>
    </div>
  );
}
