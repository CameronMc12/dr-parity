'use client';

import { useEffect, useRef, useState } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_MUTED } from '../page-primitives';
import { WhiteboardThumbnail } from './WhiteboardThumbnail';
import { KebabGlyph, RenameGlyph, DuplicateGlyph, TrashGlyph } from './whiteboard-icons';
import type { Whiteboard } from '@/data/whiteboards-seed';

const CARD_BG = 'rgb(255, 255, 255)';
const REST_SHADOW = '0 1px 2px rgba(20, 24, 40, 0.06)';
const HOVER_SHADOW = '0 8px 24px rgba(20, 24, 40, 0.14)';
const MENU_BG = 'rgb(255, 255, 255)';
const MENU_HOVER = 'rgb(244, 244, 246)';
const DANGER = 'rgb(220, 64, 64)';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, danger, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '7px 12px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        color: danger ? DANGER : TEXT_PRIMARY,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = MENU_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: danger ? DANGER : TEXT_MUTED, display: 'flex' }}>{icon}</span>
      {label}
    </button>
  );
}

interface WhiteboardCardProps {
  board: Whiteboard;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WhiteboardCard({ board, onRename, onDuplicate, onDelete }: WhiteboardCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== board.name) onRename(board.id, next);
    else setDraft(board.name);
    setRenaming(false);
  };

  const location = board.folder ? `${board.space} / ${board.folder}` : board.space;

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: 272,
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: hovered ? HOVER_SHADOW : REST_SHADOW,
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 140ms ease, transform 140ms ease',
      }}
    >
      <div style={{ position: 'relative', height: 150, borderBottom: `1px solid ${BORDER}` }}>
        <WhiteboardThumbnail preview={board.preview} />
        {(hovered || menuOpen) && (
          <button
            type="button"
            aria-label="Whiteboard options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.92)',
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              cursor: 'pointer',
              color: 'rgb(70, 70, 70)',
            }}
          >
            <KebabGlyph size={16} />
          </button>
        )}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: 8,
              width: 168,
              padding: '4px 0',
              background: MENU_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(20, 24, 40, 0.18)',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem
              icon={<RenameGlyph />}
              label="Rename"
              onClick={() => {
                setMenuOpen(false);
                setDraft(board.name);
                setRenaming(true);
              }}
            />
            <MenuItem
              icon={<DuplicateGlyph />}
              label="Duplicate"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate(board.id);
              }}
            />
            <div style={{ borderTop: `1px solid ${BORDER}`, margin: '4px 0' }} />
            <MenuItem
              icon={<TrashGlyph />}
              label="Delete"
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete(board.id);
              }}
            />
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(board.name);
                setRenaming(false);
              }
            }}
            style={{
              width: '100%',
              fontSize: 14,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              border: `1px solid ${board.author.color}`,
              borderRadius: 5,
              padding: '3px 6px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {board.name}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {location}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              background: board.author.color,
              color: 'white',
              fontSize: 9,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {board.author.initials}
          </span>
          <span
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {board.editedLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
