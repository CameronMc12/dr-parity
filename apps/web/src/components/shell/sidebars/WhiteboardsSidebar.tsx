'use client';

import { useState, type CSSProperties } from 'react';
import {
  PlusGlyph,
  WhiteboardGlyph,
  WhiteboardTile,
  FavoritesBurst,
} from '@/components/pages/whiteboards/whiteboard-icons';
import { RECENT_WHITEBOARDS, type Whiteboard } from '@/data/whiteboards-seed';

const TEXT = 'var(--cu-text-primary, rgb(32, 32, 32))';
const MUTED = 'var(--cu-text-muted, rgb(130, 130, 130))';
const HOVER = 'var(--cu-bg-hover, rgb(244, 244, 244))';
const ACTIVE = 'var(--cu-bg-active, rgb(238, 238, 240))';

type NavId = 'all' | 'my';

interface NavRowProps {
  id: NavId;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: (id: NavId) => void;
}

function NavRow({ id, label, icon, active, onSelect }: NavRowProps) {
  return (
    <button type="button" onClick={() => onSelect(id)} style={rowStyle(active)} {...hoverHandlers(active)}>
      <span style={{ display: 'flex', flexShrink: 0, color: active ? TEXT : 'rgb(110, 110, 110)' }}>{icon}</span>
      <span style={ellipsis}>{label}</span>
    </button>
  );
}

function BoardRow({ board }: { board: Whiteboard }) {
  return (
    <button type="button" style={rowStyle(false)} {...hoverHandlers(false)}>
      <WhiteboardTile size={18} />
      <span style={ellipsis}>{board.name}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '0 12px',
        marginTop: 16,
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

/** Workspace avatar glyph ("C") used by the "My Whiteboards" row. */
function WorkspaceAvatar() {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: 'rgb(120, 200, 120)',
        color: 'white',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      C
    </span>
  );
}

export function WhiteboardsSidebar() {
  const [active, setActive] = useState<NavId>('all');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--cu-font)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 14px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 16, fontWeight: 700, flex: 1 }}>Whiteboards</span>
        <button type="button" aria-label="New whiteboard" style={headerPlus} {...hoverHandlers(false)}>
          <PlusGlyph size={16} />
        </button>
      </div>

      {/* Scrolling body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px 16px' }}>
        <NavRow
          id="all"
          label="All Whiteboards"
          icon={<WhiteboardGlyph size={18} color="currentColor" />}
          active={active === 'all'}
          onSelect={setActive}
        />
        <NavRow
          id="my"
          label="My Whiteboards"
          icon={<WorkspaceAvatar />}
          active={active === 'my'}
          onSelect={setActive}
        />

        {/* Favorites */}
        <SectionLabel>Favorites</SectionLabel>
        <div
          style={{
            margin: '0 8px',
            padding: '20px 12px',
            borderRadius: 10,
            background: 'rgb(248, 248, 249)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <FavoritesBurst size={58} />
          <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
            Star a Whiteboard to see it here
          </span>
        </div>

        {/* Recents */}
        <SectionLabel>Recents</SectionLabel>
        {RECENT_WHITEBOARDS.map((board, i) => (
          <BoardRow key={`${board.id}-${i}`} board={board} />
        ))}
      </div>
    </div>
  );
}

const ellipsis: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const headerPlus: CSSProperties = {
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'rgb(90, 90, 90)',
};

function rowStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    fontSize: 13.5,
    fontWeight: active ? 600 : 400,
    color: active ? TEXT : 'rgb(70, 70, 70)',
    background: active ? ACTIVE : 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  };
}

function hoverHandlers(active: boolean) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) e.currentTarget.style.background = HOVER;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    },
  };
}
