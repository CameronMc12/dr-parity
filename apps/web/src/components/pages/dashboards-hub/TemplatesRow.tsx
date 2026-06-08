'use client';

/**
 * The "Templates" row above the dashboards table. Three flat-bordered tiles, each
 * with a soft-tinted rounded icon badge, a name, and a one-line description. Maps
 * 1:1 to the real ClickUp landing: Simple Dashboard / AI Team Center / Project
 * Management.
 */

import { DASHBOARD_TEMPLATES } from '@/data/dashboards-seed';
import type { DashboardTemplate, TemplateAccent } from '@/data/dashboards-seed';
import {
  TemplateSimpleGlyph,
  TemplateAiGlyph,
  TemplateProjectGlyph,
} from './dashboards-hub-icons';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32, 32, 32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130, 130, 130))';
const BORDER = 'var(--cu-border-divider, rgb(232, 232, 232))';

const ACCENTS: Record<TemplateAccent, { fg: string; bg: string }> = {
  blue: { fg: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  violet: { fg: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  sky: { fg: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
};

function TemplateGlyph({ id }: { id: string }) {
  if (id === 'tpl-ai-team') return <TemplateAiGlyph />;
  if (id === 'tpl-project') return <TemplateProjectGlyph />;
  return <TemplateSimpleGlyph />;
}

function TemplateTile({ tpl }: { tpl: DashboardTemplate }) {
  const accent = ACCENTS[tpl.accent];
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flex: '1 1 0',
        minWidth: 0,
        height: 64,
        padding: '0 18px',
        background: 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--cu-bg-hover, rgb(248,248,249))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          background: accent.bg,
          color: accent.fg,
          flexShrink: 0,
        }}
      >
        <TemplateGlyph id={tpl.id} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tpl.name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12.5,
            color: TEXT_MUTED,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tpl.description}
        </span>
      </span>
    </button>
  );
}

export function TemplatesRow() {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12.5, color: TEXT_MUTED, fontWeight: 500, marginBottom: 10 }}>
        Templates
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        {DASHBOARD_TEMPLATES.map((tpl) => (
          <TemplateTile key={tpl.id} tpl={tpl} />
        ))}
      </div>
    </div>
  );
}
