'use client';

/** Inline glyphs local to the Teams hub. Sampled to match ClickUp's cu3 icons. */

/** Sidebar "All Teams" — overlapping people (userGroup). */
export function UserGroupIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 18.5c0-2.6 2.5-4.4 5.5-4.4s5.5 1.8 5.5 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 14.4c2.3.1 4.5 1.6 4.5 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Sidebar "All People" — single identity badge (userId). */
export function UserIdIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="11" r="2.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 16.2c0-1.6 1.3-2.5 3-2.5s3 .9 3 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.5 10h3.5M14.5 13.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Sidebar "Analytics" — pulse / activity wave. */
export function PulseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h3l2.5-6 4 13 2.5-7H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Toolbar chevron used inside filter pills. */
export function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 1 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 0 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Sidebar header create chevron (smaller). */
export function CaretMini({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 15 7 10h10l-5 5Z" />
    </svg>
  );
}

export function PlusGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SearchGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** View switcher: list / table-rows glyph. */
export function ListViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** View switcher: gallery / box glyph. */
export function GalleryViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
