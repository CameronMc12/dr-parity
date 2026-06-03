'use client';

/**
 * Doc-view-local icon set. ClickUp's doc chrome uses a handful of glyphs the
 * shared list-view sprite doesn't carry (doc page mark, star, comment bubble,
 * "Aa" typography, link, AI sparkle, download, table, columns, list embed,
 * subpage). Kept here so the doc folder is self-contained.
 *
 * All strokes use `currentColor` so callers control colour via the parent's
 * `color`. 24-grid viewBoxes, 2px strokes — ClickUp's icon weight.
 */

interface IconProps {
  size?: number;
  color?: string;
}

function svg(size: number, children: React.ReactNode, color?: string) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      {children}
    </svg>
  );
}

/** Filled blue doc/page mark shown at the head of the doc header bar. */
export function DocMarkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="rgb(89,165,255)" />
      <rect x="7.5" y="7" width="9" height="1.6" rx="0.8" fill="#fff" opacity="0.92" />
      <rect x="7.5" y="11" width="9" height="1.6" rx="0.8" fill="#fff" opacity="0.92" />
      <rect x="7.5" y="15" width="6" height="1.6" rx="0.8" fill="#fff" opacity="0.92" />
    </svg>
  );
}

export function StarIcon({ size = 16, filled = false, color }: IconProps & { filled?: boolean }) {
  return svg(
    size,
    <path
      d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L12 3.5z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill={filled ? 'currentColor' : 'none'}
    />,
    color,
  );
}

export function TagOutlineIcon({ size = 16, color }: IconProps) {
  return svg(
    size,
    <>
      <path
        d="M3.6 11.2l7.2-7.2 8.4.4.4 8.4-7.2 7.2a1.6 1.6 0 01-2.26 0L3.6 13.46a1.6 1.6 0 010-2.26z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="15.4" cy="8.6" r="1.4" fill="currentColor" />
    </>,
    color,
  );
}

export function MoreHorizIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" />
    </>,
    color,
  );
}

export function CommentBubbleIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <path
      d="M4 5.5h16v10H9l-4 3.2V15.5H4a0 0 0 010 0v-10z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />,
    color,
  );
}

/** "Aa" typography toggle. */
export function TypographyIcon({ size = 18, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
        fontFamily="inherit"
      >
        Aa
      </text>
    </svg>
  );
}

export function LinkIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path
        d="M9.5 14.5l5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11 7.5l1.2-1.2a3.2 3.2 0 014.5 4.5L15.5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 16.5l-1.2 1.2a3.2 3.2 0 01-4.5-4.5L8.5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>,
    color,
  );
}

export function SparkleIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path
        d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"
        fill="currentColor"
      />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="currentColor" />
    </>,
    color,
  );
}

export function DownloadIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8 10.5l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>,
    color,
  );
}

/** Two-way arrows for the "Relationships" rail control. */
export function RelationshipsIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path d="M4 8h11l-3-3M20 16H9l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>,
    color,
  );
}

/** Stacked layout glyph for the "Templates" rail control. */
export function TemplatesIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <rect x="3.5" y="3.5" width="17" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="11" width="8" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="11" width="6.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </>,
    color,
  );
}

/** AI orb for the floating "Ask about this Doc" button (bottom-right). */
export function AskAiIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path d="M12 3l1.7 4.6L18.5 9l-4.8 1.4L12 15l-1.7-4.6L5.5 9l4.8-1.4L12 3z" fill="currentColor" />
      <path d="M18 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" fill="currentColor" />
    </>,
    color,
  );
}

export function PageStackIcon({ size = 14, color }: IconProps) {
  return svg(
    size,
    <>
      <rect x="6" y="3.5" width="13" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 7v13.5a1 1 0 001 1H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>,
    color,
  );
}

export function TableBlockIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15M15 4.5v15" stroke="currentColor" strokeWidth="1.5" />
    </>,
    color,
  );
}

export function ColumnsBlockIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <rect x="3.5" y="4.5" width="7" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="4.5" width="7" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
    </>,
    color,
  );
}

export function ListEmbedIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <circle cx="5" cy="7" r="1.3" fill="currentColor" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="5" cy="17" r="1.3" fill="currentColor" />
      <path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>,
    color,
  );
}

export function SubpageIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9.5h6M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>,
    color,
  );
}

export function PenIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <path
      d="M5 19l1-3.5L15.5 6a1.8 1.8 0 012.5 0l.5.5a1.8 1.8 0 010 2.5L9 18.5 5 19z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />,
    color,
  );
}

export function WikiIcon({ size = 18, color }: IconProps) {
  return svg(
    size,
    <>
      <path
        d="M5 4.5h6.5a2 2 0 012 2V19a2 2 0 00-2-1.5H5V4.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M19 4.5h-6.5a2 2 0 00-2 2V19a2 2 0 012-1.5H19V4.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>,
    color,
  );
}
