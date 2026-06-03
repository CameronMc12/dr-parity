'use client';

/**
 * View-type glyph icons for the Add-view menu and view-tab strip. The five core
 * data views (List, Board, Calendar, Gantt, Table) reuse the existing glyphs in
 * `components/pages/list-view-icons.tsx`; the additional ClickUp view types
 * (Timeline, Workload, Activity, Map, Mind Map, Chat, Form, Whiteboard, Embed)
 * get the new glyphs below, styled to match: 24x24 viewBox, stroke/fill driven
 * by a required `color`, 1.8 stroke width, round caps/joins.
 *
 * Every glyph shares the signature `({ size = 14, color })` so they slot into
 * the same `Glyph` field on a view-type definition.
 */

import type { ReactElement } from 'react';

export interface GlyphProps {
  size?: number;
  color: string;
}

export type GlyphComponent = (props: GlyphProps) => ReactElement;

export function TimelineGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5" y="9" width="8" height="3" rx="1.4" fill={color} />
      <rect x="10" y="14" width="9" height="3" rx="1.4" fill={color} />
      <circle cx="9" cy="10.5" r="1.1" fill="#000" opacity="0.18" />
    </svg>
  );
}

export function WorkloadGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="13" width="3.5" height="6" rx="1.2" fill={color} />
      <rect x="10.25" y="9" width="3.5" height="10" rx="1.2" fill={color} />
      <rect x="16.5" y="6" width="3.5" height="13" rx="1.2" fill={color} />
    </svg>
  );
}

export function ActivityGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l2-6 4 12 2-6h6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MapGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.2" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function MindMapGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.6" stroke={color} strokeWidth="1.8" />
      <circle cx="18" cy="6" r="2.2" stroke={color} strokeWidth="1.8" />
      <circle cx="18" cy="18" r="2.2" stroke={color} strokeWidth="1.8" />
      <path d="M8.4 10.6 15.8 7M8.4 13.4 15.8 17" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ChatGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 12h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FormGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2.2" stroke={color} strokeWidth="1.8" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function WhiteboardGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="11" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="7" y="8" width="4" height="3" rx="0.8" fill={color} />
      <path d="M13.5 9h3M13.5 12h3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16v3M9.5 20h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EmbedGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M9.5 10 7 12.5l2.5 2.5M14.5 10 17 12.5l-2.5 2.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4M9.5 12h5M9.5 15.5h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.4" stroke={color} strokeWidth="1.8" />
      <rect x="7" y="12.5" width="2.6" height="4" rx="0.9" fill={color} />
      <rect x="10.7" y="9.5" width="2.6" height="7" rx="0.9" fill={color} />
      <rect x="14.4" y="7" width="2.6" height="9.5" rx="0.9" fill={color} />
    </svg>
  );
}

export function TeamGlyph({ size = 14, color }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" stroke={color} strokeWidth="1.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.8" cy="8" r="2.3" stroke={color} strokeWidth="1.6" opacity="0.85" />
      <path d="M15.5 13.4c2.6.1 5 1.8 5 4.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
