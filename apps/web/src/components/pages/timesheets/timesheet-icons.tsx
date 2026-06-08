'use client';

/** Inline SVGs local to the Timesheets page (no shared Icons.tsx dependency). */

export function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small clock used beside the "Timesheets" title and on the filter pill. */
export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Gear / settings icon for the Configure button. */
export function SettingsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Dollar / billable status pill icon. */
export function DollarIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M16 7.5c-.7-1.3-2.1-2-4-2-2.2 0-4 1.1-4 3 0 4.5 8 2 8 6.5 0 1.9-1.8 3-4 3-1.9 0-3.3-.7-4-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Tag pill icon. */
export function TagIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Concentric "tracked time" pill icon. */
export function TrackedTimeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Timesheet (grid) icon for the segmented toggle. */
export function TimesheetViewIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M9 9.5v10" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Time-entries (list) icon for the segmented toggle. */
export function ListViewIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h12M8 12h12M8 18h12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6" r="1.3" fill="currentColor" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" />
      <circle cx="4" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

/* ── Empty-state option-card icons ── */

/** "All assigned tasks" — two people. */
export function UsersIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.2M17 14.4c2.3.5 3.9 2.1 3.9 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** "Last week's tasks" — copy / duplicate. */
export function CopyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** "Individual tasks" — plus in circle. */
export function PlusCircleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** "Track time" — stopwatch / timer. */
export function TimerIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 13.5V9.5M9.5 2h5M12 2v3.5M18.5 6.5l1.3-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ── Big stopwatch hero (empty-state image) ── */

/** Large outlined stopwatch with a + badge, mirroring ClickUp's empty-state art. */
export function StopwatchHero({ size = 88 }: { size?: number }) {
  const muted = 'var(--cu-text-muted, rgb(168, 168, 168))';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, color: muted }}>
      <svg width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <circle cx="44" cy="50" r="30" stroke="currentColor" strokeWidth="3" />
        <circle cx="44" cy="50" r="2.6" fill="currentColor" />
        <path d="M44 50V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 50l11 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M37 9h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 9v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 24l5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M68 26l4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span
        style={{
          position: 'absolute',
          right: 2,
          bottom: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: muted,
          color: 'var(--cu-bg-app, rgb(255, 255, 255))',
        }}
        aria-hidden="true"
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
