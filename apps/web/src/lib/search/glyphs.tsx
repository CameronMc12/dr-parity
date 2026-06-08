'use client';

/**
 * Inline glyphs for the global ⌘K command palette. Kept local to the search
 * module so the palette owns its iconography and never touches the shared
 * Icons.tsx sprite. All paths are hand-traced to mirror ClickUp's command-bar
 * icon set (search, source tabs, filter chips, row types, footer chrome).
 */

import type { CSSProperties } from 'react';

interface GlyphProps {
  size?: number;
  style?: CSSProperties;
}

function Svg({
  size = 16,
  style,
  children,
  stroke,
}: GlyphProps & { children: React.ReactNode; stroke?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : 'none'}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export function SearchGlyph({ size = 18, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

/** ClickUp brand flower — soft six-petal multi-colour burst (the "Ask AI" mark). */
export function FlowerGlyph({ size = 16, style }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <ellipse cx="8" cy="3.6" rx="2" ry="2.6" fill="#5B9BF0" opacity="0.9" />
      <ellipse cx="11.8" cy="6" rx="2" ry="2.6" transform="rotate(60 11.8 6)" fill="#C06AD6" opacity="0.85" />
      <ellipse cx="11.8" cy="10.4" rx="2" ry="2.6" transform="rotate(120 11.8 10.4)" fill="#E879A9" opacity="0.85" />
      <ellipse cx="8" cy="12.6" rx="2" ry="2.6" fill="#F0935B" opacity="0.88" />
      <ellipse cx="4.2" cy="10.4" rx="2" ry="2.6" transform="rotate(60 4.2 10.4)" fill="#F2B25C" opacity="0.82" />
      <ellipse cx="4.2" cy="6" rx="2" ry="2.6" transform="rotate(120 4.2 6)" fill="#7FB3E8" opacity="0.82" />
      <circle cx="8" cy="8" r="2.1" fill="#FFFFFF" opacity="0.6" />
    </svg>
  );
}

/** Google Drive triangle mark. */
export function DriveGlyph({ size = 16, style }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d="M8.8 3 2.4 14.1l3.2 5.5 6.4-11.1L8.8 3Z" fill="#0066DA" />
      <path d="M15.2 3H8.8l6.4 11.1h6.4L15.2 3Z" fill="#00AC47" />
      <path d="m21.6 14.1-3.2 5.5H5.6l3.2-5.5h12.8Z" fill="#FFBA00" opacity="0.9" />
      <path d="M5.6 19.6 8.8 14.1h6.4L12 19.6H5.6Z" fill="#EA4335" opacity="0.85" />
    </svg>
  );
}

/** Gmail envelope mark. */
export function GmailGlyph({ size = 16, style }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d="M3 6.5 12 13l9-6.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6.5Z" fill="#EA4335" opacity="0.92" />
      <path d="M3 6a1.5 1.5 0 0 1 1.5-1.5h.7L12 9.8l6.8-5.3h.7A1.5 1.5 0 0 1 21 6v.5L12 13 3 6.5V6Z" fill="#FBBC04" />
    </svg>
  );
}

/** SharePoint / Microsoft tile mark. */
export function SharePointGlyph({ size = 16, style }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <circle cx="9" cy="9" r="5.5" fill="#036C70" />
      <circle cx="15.5" cy="13" r="5" fill="#1A9BA1" opacity="0.9" />
      <circle cx="13" cy="18" r="3.6" fill="#37C6D0" opacity="0.85" />
    </svg>
  );
}

/** Apps grid (3×3 dots). */
export function AppsGlyph({ size = 16, style }: GlyphProps) {
  const dots = [4, 12, 20];
  return (
    <Svg size={size} style={style}>
      {dots.flatMap((y) =>
        dots.map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />),
      )}
    </Svg>
  );
}

/** List / lines glyph used as the leading icon for list-type results. */
export function ListLinesGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  );
}

/** Hollow circle used as the leading icon for task-type results. */
export function TaskCircleGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}

export function DocLinesGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function FolderGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Svg>
  );
}

export function SpaceGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a12 12 0 0 0 0 16M4 12h16" />
    </Svg>
  );
}

export function ChannelGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
    </Svg>
  );
}

export function MessageGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M4 5h16v10H9l-4 4V5Z" />
    </Svg>
  );
}

export function AgentGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 4v4M8 13h.01M16 13h.01" />
      <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function FilterGlyph({ size = 14, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
    </Svg>
  );
}

export function SortGlyph({ size = 14, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M7 4v16M7 20l-3-3M7 4l3 3M17 4v16M17 4l-3 3M17 20l3-3" />
    </Svg>
  );
}

export function ExternalGlyph({ size = 14, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M14 4h6v6M20 4l-9 9M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function LinkGlyph({ size = 14, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M9 13a4 4 0 0 0 6 .4l2.5-2.5a4 4 0 0 0-5.6-5.6l-1.4 1.4" />
      <path d="M15 11a4 4 0 0 0-6-.4L6.5 13.1a4 4 0 0 0 5.6 5.6l1.4-1.4" />
    </Svg>
  );
}

export function GearGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Svg>
  );
}

export function NavArrowsGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M11 6 6 12l5 6M18 6l-5 6 5 6" />
    </Svg>
  );
}

export function OverflowGlyph({ size = 16, style }: GlyphProps) {
  return (
    <Svg size={size} style={style}>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </Svg>
  );
}

export function EnterGlyph({ size = 14, style }: GlyphProps) {
  return (
    <Svg size={size} style={style} stroke>
      <path d="M20 6v5a3 3 0 0 1-3 3H5" />
      <path d="m8 11-3 3 3 3" />
    </Svg>
  );
}
