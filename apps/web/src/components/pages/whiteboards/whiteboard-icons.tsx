/** Inline icons local to the Whiteboards hub + sidebar. */

/**
 * The canonical ClickUp whiteboard glyph: a rounded square framing three
 * connected nodes (one top-centre, two below). Used three ways:
 *  - grey + large, centred in each empty card thumbnail
 *  - small inside the active "All Whiteboards" sidebar row
 *  - small inside the yellow tile for per-board sidebar rows
 */
export function WhiteboardGlyph({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" stroke={color} strokeWidth="1.4" />
      <rect x="9.5" y="5.5" width="5" height="3.6" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="4.5" y="14.9" width="5" height="3.6" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="14.5" y="14.9" width="5" height="3.6" rx="1" stroke={color} strokeWidth="1.4" />
      <path d="M12 9.1v2.4M12 11.5H7v3.4M12 11.5h5v3.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SearchGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CaretGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 17a1 1 0 0 1-.707-.293l-6-6a1 1 0 0 1 1.414-1.414L12 14.586l5.293-5.293a1 1 0 1 1 1.414 1.414l-6 6A1 1 0 0 1 12 17Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChevronGlyph({ size = 11, open = true }: { size?: number; open?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 120ms ease' }}
    >
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 1 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Sort glyph: vertical up/down arrows (the "↕" two-arrow control). */
export function SortGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4v16M7 4 4 7m3-3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 20V4m0 16 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ListViewGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GridViewGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Yellow rounded tile holding a tiny whiteboard glyph. Per-board sidebar row icon.
 */
export function WhiteboardTile({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: 'rgb(255, 196, 61)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <WhiteboardGlyph size={Math.round(size * 0.66)} color="rgb(58, 40, 8)" />
    </span>
  );
}

/* ---- Template card illustrations ---- */

/** Organizational Chart: one node up top branching to three below (purple). */
export function OrgChartIllo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="11" r="5" fill="rgb(196, 181, 253)" />
      <path d="M24 16v6M24 22H12v4M24 22h12v4M24 22v4" stroke="rgb(167, 139, 250)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="30" r="4" fill="rgb(167, 139, 250)" />
      <circle cx="24" cy="30" r="4" fill="rgb(167, 139, 250)" />
      <circle cx="36" cy="30" r="4" fill="rgb(167, 139, 250)" />
    </svg>
  );
}

/** Action Plan: a checklist board with rows + checks (teal). */
export function ActionPlanIllo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="30" height="30" rx="5" fill="rgb(204, 240, 232)" />
      <rect x="14" y="15" width="7" height="7" rx="1.5" fill="rgb(45, 178, 154)" />
      <path d="M15.6 18.4l1 1 1.8-2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 18.5h10" stroke="rgb(45, 178, 154)" strokeWidth="2" strokeLinecap="round" />
      <rect x="14" y="27" width="7" height="7" rx="1.5" fill="rgb(45, 178, 154)" />
      <path d="M15.6 30.4l1 1 1.8-2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 30.5h10" stroke="rgb(45, 178, 154)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Customer Journey Map: a rising path of connected dots (blue). */
export function JourneyMapIllo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M11 35l8-7 7 4 11-12" stroke="rgb(96, 165, 250)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="35" r="3.4" fill="rgb(147, 197, 253)" />
      <circle cx="19" cy="28" r="3.4" fill="rgb(96, 165, 250)" />
      <circle cx="26" cy="32" r="3.4" fill="rgb(147, 197, 253)" />
      <circle cx="37" cy="20" r="3.8" fill="rgb(59, 130, 246)" />
    </svg>
  );
}

/** Burst of stars used in the "Favorites" empty hint. */
export function FavoritesBurst({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.6)} viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <path d="M40 14l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L40 26.9l-5.2 2.9 1.2-5.6L31.8 19.8l5.6-.6L40 14Z" fill="rgb(255, 199, 60)" />
      <path d="M22 9l1 2.1 2.3.3-1.7 1.5.5 2.3L22 14l-2.1 1.2.5-2.3-1.7-1.5 2.3-.3L22 9Z" fill="rgb(255, 219, 130)" />
      <path d="M59 11l1 2.1 2.3.3-1.7 1.5.5 2.3L59 16l-2.1 1.2.5-2.3-1.7-1.5 2.3-.3L59 11Z" fill="rgb(255, 219, 130)" />
    </svg>
  );
}
