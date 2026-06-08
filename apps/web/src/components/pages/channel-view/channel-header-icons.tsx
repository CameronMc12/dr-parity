'use client';

/**
 * Inline glyphs for the Channel-view location header: the property-picker row
 * (description / assignee / priority / dates) and the right action cluster
 * (SyncUp / Agents / Automate / Ask / Share). 24x24 viewBox, currentColor so the
 * host button drives hover colour.
 */

const s = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function DescriptionIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M4 6h16M4 10h16M4 14h11M4 18h7" />
    </svg>
  );
}

export function AssigneeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function PriorityIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M6 21V4M6 4h9l-2 3 2 3H6" />
    </svg>
  );
}

export function DatesIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <rect x="4" y="5" width="16" height="16" rx="2.4" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </svg>
  );
}

export function EllipsisIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
    </svg>
  );
}

export function SyncUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M5 5.5a1.5 1.5 0 0 1 1.5-1.5h2A1 1 0 0 1 9.5 5l.6 2.4a1 1 0 0 1-.3 1L8.4 9.6a12 12 0 0 0 6 6l1.2-1.4a1 1 0 0 1 1-.3l2.4.6a1 1 0 0 1 .8 1v2A1.5 1.5 0 0 1 18.5 19 13.5 13.5 0 0 1 5 5.5Z" />
    </svg>
  );
}

export function AutomateIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.7 15.7 6.3M8.3 13.3l7.4 4.4" />
    </svg>
  );
}

/** Multicolor ClickUp-Brain sparkle for Agents / Ask. */
export function AiBrandIcon({ size = 16 }: { size?: number }) {
  const gid = `cu-ch-ai-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff4dd2" />
          <stop offset="0.5" stopColor="#ff7a45" />
          <stop offset="1" stopColor="#3f8cff" />
        </linearGradient>
      </defs>
      <path d="M12 3l1.7 4.8L18.5 9.5 13.7 11.2 12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3Z" fill={`url(#${gid})`} />
      <path d="M18 14.2l.75 2.05L20.8 17l-2.05.75L18 19.8l-.75-2.05L15.2 17l2.05-.75L18 14.2Z" fill={`url(#${gid})`} />
    </svg>
  );
}

export function ChevronIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
