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
  emoji: string;
  verified?: boolean;
}

const TEMPLATES: TemplateDef[] = [
  { id: 'overview', name: 'Project Overview', description: 'Summarize goals, scope, and milestones', emoji: '📋' },
  { id: 'meeting', name: 'Meeting Notes', description: 'Capture an agenda, notes, and action items', emoji: '📝' },
  { id: 'wiki', name: 'Wiki', description: 'Organize information in one place', emoji: '📚', verified: true },
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
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--cu-bg-hover, rgb(244,244,244))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {template.emoji}
      </span>
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
