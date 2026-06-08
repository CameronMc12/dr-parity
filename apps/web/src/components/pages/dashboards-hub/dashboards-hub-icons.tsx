/** Dashboards hub inline icons. */

export function DashboardsBigIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <rect x="14" y="16" width="30" height="26" rx="4" stroke="currentColor" strokeWidth="3" />
      <rect x="52" y="16" width="30" height="40" rx="4" stroke="currentColor" strokeWidth="3" />
      <rect x="14" y="50" width="30" height="30" rx="4" stroke="currentColor" strokeWidth="3" />
      <rect x="52" y="64" width="30" height="16" rx="4" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function DashboardCardGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="4" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="14" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="17" width="7" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
