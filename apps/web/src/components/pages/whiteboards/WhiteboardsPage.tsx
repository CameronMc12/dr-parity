'use client';

import { useMemo, useState } from 'react';
import { PageSurface, BORDER, TEXT_PRIMARY, TEXT_MUTED } from '../page-primitives';
import { WhiteboardCard } from './WhiteboardCard';
import { WhiteboardsBigIcon, PlusGlyph, SearchGlyph } from './whiteboard-icons';
import {
  WHITEBOARDS,
  whiteboardsForTab,
  type Whiteboard,
  type WhiteboardTab,
} from '@/data/whiteboards-seed';

const ACCENT = 'rgb(122, 90, 248)';
const CTA_BG = 'rgb(48, 48, 48)';

const TABS: { id: WhiteboardTab; label: string }[] = [
  { id: 'recents', label: 'Recents' },
  { id: 'created', label: 'Created by me' },
  { id: 'shared', label: 'Shared' },
  { id: 'private', label: 'Private' },
];

const BLANK_PREVIEW = {
  bg: 'rgb(250, 250, 250)',
  notes: [{ x: 38, y: 36, w: 24, h: 28, fill: 'rgb(255, 221, 102)' }],
  lines: [],
};

let blankCounter = 0;

function createBlankWhiteboard(tab: WhiteboardTab): Whiteboard {
  blankCounter += 1;
  const tabs: WhiteboardTab[] = tab === 'shared' ? ['recents', 'created', 'shared'] : ['recents', 'created'];
  if (tab === 'private') tabs.push('private');
  return {
    id: `wb-new-${blankCounter}-${Date.now()}`,
    name: 'Untitled Whiteboard',
    space: 'Workspace',
    editedLabel: 'Edited just now',
    author: { initials: 'CM', color: ACCENT },
    tabs,
    preview: BLANK_PREVIEW,
  };
}

/**
 * Whiteboards hub: /<wsId>/whiteboards. Gallery of whiteboard cards filtered by
 * a Recents/Created/Shared/Private tab strip, with a Create CTA that prepends a
 * live blank card. Per-card rename/duplicate/delete are local state only.
 */
export function WhiteboardsPage() {
  const [boards, setBoards] = useState<Whiteboard[]>(WHITEBOARDS);
  const [tab, setTab] = useState<WhiteboardTab>('recents');

  const visible = useMemo(() => whiteboardsForTab(boards, tab), [boards, tab]);

  const handleCreate = () => {
    const blank = createBlankWhiteboard(tab);
    setBoards((prev) => [blank, ...prev]);
  };

  const handleRename = (id: string, name: string) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  };

  const handleDuplicate = (id: string) => {
    setBoards((prev) => {
      const source = prev.find((b) => b.id === id);
      if (!source) return prev;
      const copy: Whiteboard = {
        ...source,
        id: `${source.id}-copy-${Date.now()}`,
        name: `${source.name} (Copy)`,
        editedLabel: 'Edited just now',
      };
      const index = prev.findIndex((b) => b.id === id);
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setBoards((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <PageSurface>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 52,
          paddingLeft: 24,
          paddingRight: 16,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>Whiteboards</h1>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          aria-label="Search whiteboards"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            paddingLeft: 10,
            paddingRight: 12,
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            cursor: 'pointer',
            color: 'rgb(90, 90, 90)',
            fontSize: 13,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgb(244,244,244)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <SearchGlyph />
          Search
        </button>
        <button
          type="button"
          onClick={handleCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            paddingLeft: 12,
            paddingRight: 14,
            background: CTA_BG,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <PlusGlyph size={14} />
          Create Whiteboard
        </button>
      </div>

      {/* Tab strip */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 18,
          paddingLeft: 24,
          paddingRight: 24,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? TEXT_PRIMARY : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
                color: active ? TEXT_PRIMARY : TEXT_MUTED,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = TEXT_PRIMARY;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = TEXT_MUTED;
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Gallery */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {visible.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {visible.map((board) => (
              <WhiteboardCard
                key={board.id}
                board={board}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'rgb(205, 205, 205)' }}>
              <WhiteboardsBigIcon />
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>No whiteboards here yet</div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, maxWidth: 320 }}>
              Whiteboards you create or that are shared with you will show up under this tab.
            </div>
          </div>
        )}
      </div>
    </PageSurface>
  );
}
