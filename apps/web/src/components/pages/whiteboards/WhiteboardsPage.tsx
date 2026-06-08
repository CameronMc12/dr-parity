'use client';

import { useState, type CSSProperties } from 'react';
import { PageSurface, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '../page-primitives';
import { WhiteboardCard } from './WhiteboardCard';
import { TemplateCard } from './TemplateCard';
import {
  PlusGlyph,
  CaretGlyph,
  SearchGlyph,
  SortGlyph,
  ListViewGlyph,
  GridViewGlyph,
  OrgChartIllo,
  ActionPlanIllo,
  JourneyMapIllo,
} from './whiteboard-icons';
import { WHITEBOARDS } from '@/data/whiteboards-seed';

const CTA_BG = 'var(--cu-text-primary)';

const TEMPLATES = [
  { illo: <OrgChartIllo />, title: 'Organizational Chart', description: 'Visualize your team structure' },
  { illo: <ActionPlanIllo />, title: 'Action Plan', description: 'Turn goals into actionable steps' },
  { illo: <JourneyMapIllo />, title: 'Customer Journey Map', description: 'Optimize every customer touchpoint' },
];

/**
 * Whiteboards hub ("All Whiteboards"): a Templates row of three starter cards
 * above a Sort/Search toolbar and a responsive grid of whiteboard cards. Each
 * card is an empty light panel with a faint centred whiteboard glyph. Matches
 * real ClickUp 1:1.
 */
export function WhiteboardsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <PageSurface>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 32px 48px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0, flex: 1 }}>
              All Whiteboards
            </h1>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 32,
                paddingLeft: 14,
                paddingRight: 10,
                background: CTA_BG,
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                color: 'var(--cu-bg-app)',
                fontSize: 13,
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <PlusGlyph size={14} />
              New Whiteboard
              <span style={{ display: 'inline-flex', opacity: 0.8 }}>
                <CaretGlyph size={11} />
              </span>
            </button>
          </div>

          {/* Templates */}
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_MUTED, marginBottom: 10 }}>Templates</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
            {TEMPLATES.map((t) => (
              <TemplateCard key={t.title} illo={t.illo} title={t.title} description={t.description} />
            ))}
          </div>

          {/* Sort / Search / view toggle toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <button type="button" style={controlBtn(TEXT_SECONDARY)}>
              <SortGlyph size={14} />
              Sort
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" style={{ ...controlBtn(TEXT_SECONDARY), marginRight: 8 }}>
              <SearchGlyph size={14} />
              Search
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${BORDER}`,
                borderRadius: 7,
                overflow: 'hidden',
                height: 30,
              }}
            >
              <button type="button" aria-label="List view" onClick={() => setView('list')} style={toggleBtn(view === 'list')}>
                <ListViewGlyph size={15} />
              </button>
              <span style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
              <button type="button" aria-label="Grid view" onClick={() => setView('grid')} style={toggleBtn(view === 'grid')}>
                <GridViewGlyph size={15} />
              </button>
            </div>
          </div>

          {/* Whiteboard grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))',
              gap: 20,
            }}
          >
            {WHITEBOARDS.map((board) => (
              <WhiteboardCard key={board.id} board={board} />
            ))}
          </div>
        </div>
      </div>
    </PageSurface>
  );
}

function controlBtn(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 10,
    paddingRight: 12,
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 7,
    cursor: 'pointer',
    color,
    fontSize: 13,
    fontWeight: 500,
  };
}

function toggleBtn(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: '100%',
    background: active ? 'var(--cu-bg-active)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: active ? TEXT_PRIMARY : TEXT_MUTED,
  };
}
