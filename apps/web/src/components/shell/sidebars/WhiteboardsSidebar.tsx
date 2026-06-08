'use client';

import { useMemo, useState } from 'react';
import {
  PlusGlyph,
  ChevronGlyph,
  WhiteboardTile,
} from '@/components/pages/whiteboards/whiteboard-icons';
import { WHITEBOARDS, type Whiteboard } from '@/data/whiteboards-seed';

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';
const DIVIDER = 'var(--cu-border-divider)';

interface BoardRowProps {
  board: Whiteboard;
  active: boolean;
  onSelect: (id: string) => void;
}

function BoardRow({ board, active, onSelect }: BoardRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(board.id)}
      style={{
        width: '100%',
        minHeight: 30,
        padding: '5px 8px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? TEXT : MUTED,
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <WhiteboardTile size={18} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {board.name}
      </span>
    </button>
  );
}

interface SectionProps {
  title: string;
  boards: Whiteboard[];
  activeId: string | null;
  onSelect: (id: string) => void;
  divider?: boolean;
}

function Section({ title, boards, activeId, onSelect, divider }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      {divider && <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 8px' }} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '0 8px 4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: MUTED,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: '20px',
          textAlign: 'left',
        }}
      >
        <ChevronGlyph size={11} open={open} />
        {title}
      </button>
      {open && boards.map((board) => (
        <BoardRow key={board.id} board={board} active={board.id === activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function WhiteboardsSidebar() {
  const [activeId, setActiveId] = useState<string | null>(WHITEBOARDS[0]?.id ?? null);

  const recent = useMemo(() => WHITEBOARDS.slice(0, 4), []);
  const bySpace = useMemo(() => {
    const groups = new Map<string, Whiteboard[]>();
    for (const board of WHITEBOARDS) {
      const list = groups.get(board.space) ?? [];
      list.push(board);
      groups.set(board.space, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--cu-font)' }}>
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Whiteboards</span>
      </div>

      {/* New Whiteboard CTA */}
      <div style={{ padding: '0 8px 8px', flexShrink: 0 }}>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            height: 32,
            padding: '0 10px',
            background: 'transparent',
            border: `1px dashed ${DIVIDER}`,
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT,
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <PlusGlyph size={14} />
          New Whiteboard
        </button>
      </div>

      {/* Scrolling sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 12px' }}>
        <Section title="Recent" boards={recent} activeId={activeId} onSelect={setActiveId} />
        {bySpace.map(([space, boards]) => (
          <Section
            key={space}
            title={space}
            boards={boards}
            activeId={activeId}
            onSelect={setActiveId}
            divider
          />
        ))}
      </div>
    </div>
  );
}
