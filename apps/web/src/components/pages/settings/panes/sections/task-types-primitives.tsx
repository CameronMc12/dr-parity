'use client';

import type { ReactNode } from 'react';

/**
 * Icon glyphs and the icon tile used by TaskTypesPane. Each task type has a
 * small rounded tile with a tinted icon, matching the ClickUp Task Types list.
 */

export function TaskTypeIcon({
  glyph,
  color,
}: {
  glyph: ReactNode;
  color: string;
}) {
  return (
    <span
      className="grid place-items-center w-8 h-8 rounded-[7px] shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {glyph}
    </span>
  );
}

export const CheckCircleGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </svg>
);

export const MilestoneGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 3v18a1 1 0 0 0 2 0v-5h11.5a1 1 0 0 0 .8-1.6L15.5 11l2.8-3.4A1 1 0 0 0 17.5 6H6V3a1 1 0 0 0-2 0Z" />
  </svg>
);

export const BugGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="7" width="8" height="11" rx="4" />
    <path d="M12 7V4M8 10H4M20 10h-4M8 15H4M20 15h-4M8.5 5.5 10 7M15.5 5.5 14 7" />
  </svg>
);

export const FeatureGlyph = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
    <path d="m12 2 2.4 5.9L20.5 9l-4.5 4 1.3 6L12 16.1 6.7 19l1.3-6L3.5 9l6.1-1.1Z" />
  </svg>
);
