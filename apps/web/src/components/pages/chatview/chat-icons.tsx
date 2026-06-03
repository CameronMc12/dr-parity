'use client';

/**
 * Inline chat affordance glyphs. ClickUp's composer uses thin 16px line icons for
 * attach / emoji / send and a circular send button. Kept local to the chatview
 * folder (the shared list-view-icons set has no composer glyphs) and tinted via
 * `currentColor` so callers control colour through the parent's `color`.
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

export function AttachIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="M13 7.5 7.7 12.8a2.6 2.6 0 0 1-3.7-3.7l5.6-5.6a1.7 1.7 0 0 1 2.4 2.4L6.4 11.5a.8.8 0 0 1-1.1-1.1L10 5.7" />
    </svg>
  );
}

export function EmojiIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.6 9.3a2.8 2.8 0 0 0 4.8 0" />
      <path d="M6 6.4h.01M10 6.4h.01" strokeWidth="2" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="m2.5 8 11-5-4 11-2.4-4.6L2.5 8Z" />
    </svg>
  );
}

export function MentionIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" />
      <circle cx="8" cy="8" r="2.3" />
      <path d="M10.3 8v1.4a1.6 1.6 0 0 0 3.2 0V8" />
    </svg>
  );
}

export function SmileAddIcon() {
  return (
    <svg {...BASE} aria-hidden="true">
      <path d="M14 8A6 6 0 1 1 8 2" />
      <path d="M5.7 9.4a2.6 2.6 0 0 0 4 .3" />
      <path d="M6.2 6.5h.01M9.6 6.5h.01" strokeWidth="2" />
      <path d="M12 2v3.2M13.6 3.6h-3.2" />
    </svg>
  );
}
