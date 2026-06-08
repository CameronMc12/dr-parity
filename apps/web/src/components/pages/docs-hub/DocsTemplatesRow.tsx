'use client';

import type { ReactNode } from 'react';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER = 'var(--cu-bg-hover, rgb(248,248,248))';

interface TemplateDef {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  verified?: boolean;
}

/** Peach circle, orange document + bookmark (Project Overview). */
function ProjectOverviewIcon() {
  return (
    <TemplateBadge bg="rgb(255,233,219)">
      <rect x="8" y="7" width="13" height="18" rx="2.5" fill="rgb(247,142,75)" />
      <path d="M14 7h4v6l-2-1.6L14 13V7z" fill="rgb(214,98,38)" />
      <path d="M11 14h6M11 17.5h6M11 21h4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m11 11 1 1 1.6-1.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </TemplateBadge>
  );
}

/** Soft yellow circle with a notepad (Meeting Notes). */
function MeetingNotesIcon() {
  return (
    <TemplateBadge bg="rgb(255,244,214)">
      <rect x="8" y="8" width="16" height="16" rx="3" fill="rgb(247,201,72)" />
      <path d="M12 13h8M12 16h8M12 19h5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9.5" cy="7" r="1.4" fill="rgb(214,167,38)" />
      <circle cx="22.5" cy="7" r="1.4" fill="rgb(214,167,38)" />
    </TemplateBadge>
  );
}

/** Blue circle with a stacked book (Wiki). */
function WikiIcon() {
  return (
    <TemplateBadge bg="rgb(224,232,255)">
      <path d="M8 12c2-1.4 5-1.4 8 0 3-1.4 6-1.4 8 0v8c-3-1.4-6-1.4-8 0-3-1.4-6-1.4-8 0v-8z" fill="rgb(110,140,236)" />
      <path d="M16 12v8" stroke="#fff" strokeWidth="1.4" />
      <path d="M10 14.5c1.4-.7 3-.7 4.4 0M17.6 14.5c1.4-.7 3-.7 4.4 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </TemplateBadge>
  );
}

function TemplateBadge({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

const TEMPLATES: TemplateDef[] = [
  { id: 'overview', name: 'Project Overview', description: 'Summarize goals, scope, and milestones', icon: <ProjectOverviewIcon /> },
  { id: 'meeting', name: 'Meeting Notes', description: 'Capture an agenda, notes, and action items', icon: <MeetingNotesIcon /> },
  { id: 'wiki', name: 'Wiki', description: 'Organize information in one place', icon: <WikiIcon />, verified: true },
];

function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M12 2.5l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.6 1 2.5-2 1.8.1 2.7-2.6.6L14.6 21 12 19.7 9.4 21l-1.8-2 -2.6-.6.1-2.7-2-1.8 1-2.5-.6-2.6L5.8 6.4l1-2.5 2.7.2L12 2.5z"
        fill="rgb(79,153,255)"
      />
      <path d="m9 12 2.2 2.2L15 10.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TemplateCard({ template, onUse }: { template: TemplateDef; onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {template.icon}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{template.name}</span>
          {template.verified && <VerifiedBadge />}
        </span>
        <span
          style={{
            display: 'block',
            color: MUTED,
            fontSize: 12,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {template.description}
        </span>
      </span>
    </button>
  );
}

/**
 * Templates row above the docs table. Oracle: a "Templates" label and three
 * cards (Project Overview / Meeting Notes / Wiki). Cards are visual only —
 * selecting one routes to the New Doc flow (here a no-op that the parent owns).
 */
export function DocsTemplatesRow({ onUseTemplate }: { onUseTemplate?: (id: string) => void }): ReactNode {
  return (
    <div style={{ padding: '16px 24px 0' }}>
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Templates</div>
      <div style={{ display: 'flex', gap: 16 }}>
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={() => onUseTemplate?.(template.id)}
          />
        ))}
      </div>
    </div>
  );
}
