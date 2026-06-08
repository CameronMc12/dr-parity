/**
 * Inline SVG glyphs local to ClickUp Brain (the AI hub). Kept here so the
 * shared Icons.tsx is never touched. The Brain mark is a multi-color flower;
 * the "Brain" wordmark is a warm orange→pink→violet gradient.
 */

import type { AiSuggestionCard, AiSuperAgentLink } from '@/data/ai-seed';

export const STROKE = 'rgb(99, 110, 130)';

/* ---- Brand: flower icon + rainbow wordmark ---- */

/**
 * ClickUp Brain flower: six overlapping translucent petals around a white
 * center, cycling through the brand rainbow. Used at 48px in the hero, 16px in
 * the sidebar / tabs / model selector.
 */
export function BrainFlower({ size = 48 }: { size?: number }) {
  const petals = [
    { c: 'rgb(253, 176, 34)', a: 0 },
    { c: 'rgb(249, 115, 22)', a: 60 },
    { c: 'rgb(236, 72, 153)', a: 120 },
    { c: 'rgb(168, 85, 247)', a: 180 },
    { c: 'rgb(99, 102, 241)', a: 240 },
    { c: 'rgb(56, 189, 248)', a: 300 },
  ];
  const r = 24;
  const petalR = 9.2;
  const dist = 8.6;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g style={{ mixBlendMode: 'multiply' }}>
        {petals.map((p) => {
          const rad = (p.a * Math.PI) / 180;
          const cx = r + Math.cos(rad) * dist;
          const cy = r + Math.sin(rad) * dist;
          return <circle key={p.a} cx={cx} cy={cy} r={petalR} fill={p.c} fillOpacity={0.82} />;
        })}
      </g>
      <circle cx={r} cy={r} r={4.4} fill="#fff" />
    </svg>
  );
}

/** Warm-to-cool "Brain" wordmark with a small superscript TM. */
export function BrainWordmark({ height = 30 }: { height?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
      <span
        style={{
          fontSize: height,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.5px',
          backgroundImage:
            'linear-gradient(90deg, rgb(249, 137, 38) 0%, rgb(236, 72, 153) 45%, rgb(147, 51, 234) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Brain
      </span>
      <span
        style={{
          fontSize: height * 0.3,
          fontWeight: 600,
          marginLeft: 2,
          marginTop: 1,
          color: 'rgb(147, 51, 234)',
          lineHeight: 1,
        }}
      >
        TM
      </span>
    </span>
  );
}

/* ---- Prompt box + tabs ---- */

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M12 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Agents tab glyph: a small robot/agent face. */
export function AgentIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="7" width="16" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="13" r="1.3" fill="currentColor" />
      <circle cx="15" cy="13" r="1.3" fill="currentColor" />
      <path d="M12 4v3M9 19v1.5M15 19v1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="3.4" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function HistoryIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.3l2.8 1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- Suggestion card glyphs ---- */

function MeetingGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9h10M7 12.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 17v2.5M15 17v2.5M7.5 20h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DocGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3.5h7.5L18.5 8v12.5H6V3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 3.5V8h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 12.5h7M8.5 15.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BrainstormGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.3 6.3l1.8 1.8M15.9 15.9l1.8 1.8M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FindGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const CARD_GLYPHS: Record<AiSuggestionCard['glyph'], (p: { size?: number }) => React.JSX.Element> = {
  meeting: MeetingGlyph,
  doc: DocGlyph,
  brainstorm: BrainstormGlyph,
  find: FindGlyph,
};

export function SuggestionCardGlyph({ glyph, size = 18 }: { glyph: AiSuggestionCard['glyph']; size?: number }) {
  const Glyph = CARD_GLYPHS[glyph];
  return <Glyph size={size} />;
}

/* ---- Sidebar glyphs ---- */

/** Compose / new chat pencil-in-square (sidebar header button). */
export function ComposeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14.5V20h5.5L19 10.5 13.5 5 4 14.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12.5 6 18 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Create Agent: outlined goggle / agent face on a tile. */
function CreateAgentGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="11" rx="3" fill="rgb(59, 130, 246)" />
      <circle cx="9" cy="12" r="2" fill="#fff" />
      <circle cx="15" cy="12" r="2" fill="#fff" />
    </svg>
  );
}

/** All Agents: two overlapping head silhouettes. */
function AllAgentsGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" fill="rgb(245, 158, 11)" />
      <path d="M3.5 18c0-3 2.5-5 5.5-5s5.5 2 5.5 5" fill="rgb(245, 158, 11)" />
      <circle cx="16" cy="8.5" r="2.8" fill="rgb(168, 85, 247)" />
      <path d="M11.5 18c0-2.6 2-4.4 4.5-4.4s4.5 1.8 4.5 4.4" fill="rgb(168, 85, 247)" />
    </svg>
  );
}

/** Activity: history clock. */
function ActivityGlyph({ size = 16 }: { size?: number }) {
  return <HistoryIcon size={size} />;
}

const SUPER_AGENT_GLYPHS: Partial<
  Record<AiSuperAgentLink['glyph'], (p: { size?: number }) => React.JSX.Element>
> = {
  createAgent: CreateAgentGlyph,
  allAgents: AllAgentsGlyph,
  activity: ActivityGlyph,
};

/** Returns a glyph for super-agent rows that use icons (not avatars). */
export function SuperAgentGlyph({ glyph, size = 18 }: { glyph: AiSuperAgentLink['glyph']; size?: number }) {
  const Glyph = SUPER_AGENT_GLYPHS[glyph];
  return Glyph ? <Glyph size={size} /> : null;
}

/** Connections: grid of app tiles. */
export function ConnectionsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" fill="rgb(59, 130, 246)" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" fill="rgb(245, 158, 11)" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" fill="rgb(34, 197, 94)" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" fill="rgb(236, 72, 153)" />
    </svg>
  );
}

export function NewTabIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-8.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Round progress ring with centered value, used in the sidebar footer. */
export function CreditRing({ size = 20, progress }: { size?: number; progress: number }) {
  const r = 7;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, progress)) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r={r} fill="none" stroke="rgb(228, 230, 234)" strokeWidth="3" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke="rgb(34, 161, 96)"
        strokeWidth="3"
        strokeLinecap="butt"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}
