'use client';

/**
 * Small leading icons for the Channel-view empty state: the two outline buttons
 * (Add People, Import from Slack) and the three suggestion cards (Track Tasks,
 * Add Doc, Start SyncUp). 24x24 viewBox, currentColor-driven, so they tint from
 * the surrounding card colour.
 */

export interface IconProps {
  size?: number;
  color?: string;
}

export function AddPeopleIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SlackIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="6" height="3" rx="1.5" />
      <rect x="11" y="14" width="6" height="3" rx="1.5" />
      <rect x="10" y="4" width="3" height="6" rx="1.5" />
      <rect x="14" y="11" width="3" height="6" rx="1.5" />
    </svg>
  );
}

export function TrackTasksIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2" />
    </svg>
  );
}

export function AddDocIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z" />
      <path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h3" />
    </svg>
  );
}

export function SyncUpIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5.5a1.5 1.5 0 0 1 1.5-1.5h2A1 1 0 0 1 9.5 5l.6 2.4a1 1 0 0 1-.3 1L8.4 9.6a12 12 0 0 0 6 6l1.2-1.4a1 1 0 0 1 1-.3l2.4.6a1 1 0 0 1 .8 1v2A1.5 1.5 0 0 1 18.5 19 13.5 13.5 0 0 1 5 5.5Z" />
    </svg>
  );
}
