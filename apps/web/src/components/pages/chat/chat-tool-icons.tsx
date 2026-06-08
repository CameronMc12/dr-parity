'use client';

/**
 * Composer toolbar glyphs not present in chatview/chat-icons. Thin 16px line
 * icons tinted via `currentColor` so the parent's `color` drives them. Covers
 * the +, AI sparkle, emoji face, video camera, microphone, and dropdown chevron.
 */

const BASE = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PlusToolIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  );
}

export function AiSparkleIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="M8 2.5 9.1 6 12.5 7 9.1 8 8 11.5 6.9 8 3.5 7 6.9 6 8 2.5Z" />
      <path d="M12.6 11.4 13 12.6l1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" />
    </svg>
  );
}

export function EmojiFaceIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.6 9.3a2.8 2.8 0 0 0 4.8 0" />
      <path d="M6 6.4h.01M10 6.4h.01" strokeWidth="2" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <rect x="2" y="4.5" width="8.5" height="7" rx="1.6" />
      <path d="M10.5 7.2 14 5.2v5.6l-3.5-2V7.2Z" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <rect x="6" y="2" width="4" height="7" rx="2" />
      <path d="M4 7.5a4 4 0 0 0 8 0" />
      <path d="M8 11.5V14M6 14h4" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/** Compose: a pencil inside a rounded square — the Chat header primary button. */
export function ComposeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

/** Grouped/list view toggle for the sidebar bottom bar. */
export function GroupedViewIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Recent/activity clock toggle for the sidebar bottom bar. */
export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Plain channel hash "#". */
export function HashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" />
    </svg>
  );
}

/** List-style channel glyph: a hash with small list rows in the lower-right. */
export function HashListIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M9 3 7.6 14M15 3l-1.4 11M4 8h13M3.4 12.5H15" />
      <path d="M14 18.5h6M14 21.5h6" strokeWidth="1.6" />
    </svg>
  );
}

/** Workspace badge: small green rounded square with a white letter. */
export function WorkspaceBadgeIcon({ size = 16, letter = 'C' }: { size?: number; letter?: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: 'rgb(76, 156, 99)',
        color: 'white',
        fontSize: Math.round(size * 0.62),
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

/** Mention box (rounded square with @). */
export function MentionBoxIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.4" />
      <circle cx="8" cy="8" r="1.9" />
      <path d="M9.9 8v1a1.3 1.3 0 0 0 2.6 0V8" />
    </svg>
  );
}

/** Colourful AI "@" circle (gradient-stroked). */
export function AiAtIcon() {
  const id = 'ai-at-grad';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7b68ee" />
          <stop offset="1" stopColor="#fc419e" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="6.2" stroke={`url(#${id})`} strokeWidth="1.6" />
      <circle cx="8" cy="8" r="2.3" stroke={`url(#${id})`} strokeWidth="1.6" />
      <path d="M10.3 8v1.4a1.6 1.6 0 0 0 3.2 0V8" stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Colourful AI flower/sparkle (gradient-filled petals). */
export function AiFlowerIcon() {
  const id = 'ai-flower-grad';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7b68ee" />
          <stop offset="0.5" stopColor="#fc419e" />
          <stop offset="1" stopColor="#ffab40" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M8 1.5c.5 0 .9.4 1 .9l.4 2c.6-.4 1.3-.6 2-.6a.95.95 0 0 1 .7 1.6l-1.3 1.4c.6.2 1.2.6 1.6 1.1a.95.95 0 0 1-.9 1.5l-2-.4c.1.7 0 1.4-.3 2a.95.95 0 0 1-1.7 0c-.3-.6-.4-1.3-.3-2l-2 .4a.95.95 0 0 1-.9-1.5c.4-.5 1-.9 1.6-1.1L4.9 5.4A.95.95 0 0 1 5.6 3.8c.7 0 1.4.2 2 .6l.4-2c.1-.5.5-.9 1-.9Z"
      />
    </svg>
  );
}

/** Task-check icon (clipboard with check). */
export function TaskCheckIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <rect x="3" y="3" width="10" height="11" rx="2" />
      <path d="M5.8 8.2 7.3 9.7 10.2 6.6" />
    </svg>
  );
}

/** Doc-plus icon. */
export function DocPlusIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
      <path d="M8.8 2.6V6h3.2M8 8v3.4M6.3 9.7h3.4" />
    </svg>
  );
}

/** Image-plus icon. */
export function ImagePlusIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="9" rx="1.6" />
      <circle cx="5.6" cy="6" r="1" />
      <path d="m3.5 11 3-3 2.5 2.4 2-1.8 2 1.9" />
      <path d="M11.5 2v3M10 3.5h3" strokeWidth="1.4" />
    </svg>
  );
}

export function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
