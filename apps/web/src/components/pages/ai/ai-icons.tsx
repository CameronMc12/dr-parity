/**
 * Inline SVG glyphs local to the AI hub. Kept here so the shared Icons.tsx
 * is never touched. ClickUp's AI accent is a violet sparkle (rgb(124,77,255)).
 */

import type { AiQuickAction, AiSuggestion } from '@/data/ai-seed';

export const AI_ACCENT = 'rgb(124, 77, 255)';

/** Multi-tone "Brain" sparkle used on the prompt input and brand mark. */
export function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.7 4.1a4 4 0 0 0 2.2 2.2L20 11l-4.1 1.7a4 4 0 0 0-2.2 2.2L12 19l-1.7-4.1a4 4 0 0 0-2.2-2.2L4 11l4.1-1.7a4 4 0 0 0 2.2-2.2L12 3Z"
        fill={AI_ACCENT}
      />
      <path d="M19 4l.7 1.7L21.4 6.4 19.7 7l-.7 1.7L18.3 7l-1.7-.6L18.3 5.7 19 4Z" fill="rgb(255, 138, 76)" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PencilGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19h4l9.5-9.5a2 2 0 0 0-2.8-2.8L6 16.2V19Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 7.5l2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ListGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="4.5" cy="6" r="1.3" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

function CheckSquareGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BulbGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function DocGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function StatusGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5M4 6l5-1.5L15 6l5-1.5v9L15 14l-6-1.5L4 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockerGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="m6.5 6.5 11 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const QUICK_GLYPHS: Record<AiQuickAction['glyph'], (p: { size?: number }) => React.JSX.Element> = {
  write: PencilGlyph,
  summarize: ListGlyph,
  tasks: CheckSquareGlyph,
  brainstorm: BulbGlyph,
  docs: DocGlyph,
};

export function QuickActionGlyph({ glyph, size = 15 }: { glyph: AiQuickAction['glyph']; size?: number }) {
  const Glyph = QUICK_GLYPHS[glyph];
  return <Glyph size={size} />;
}

const SUGGESTION_GLYPHS: Record<AiSuggestion['glyph'], (p: { size?: number }) => React.JSX.Element> = {
  brief: DocGlyph,
  summarize: ListGlyph,
  sprint: CalendarGlyph,
  status: StatusGlyph,
  blockers: BlockerGlyph,
  standup: CheckSquareGlyph,
};

export function SuggestionGlyph({ glyph, size = 18 }: { glyph: AiSuggestion['glyph']; size?: number }) {
  const Glyph = SUGGESTION_GLYPHS[glyph];
  return <Glyph size={size} />;
}
