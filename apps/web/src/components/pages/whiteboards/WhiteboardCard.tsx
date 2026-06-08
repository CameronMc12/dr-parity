'use client';

import { useState } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_MUTED } from '../page-primitives';
import { WhiteboardThumbnail } from './WhiteboardThumbnail';
import type { Whiteboard } from '@/data/whiteboards-seed';

const CARD_BG = 'var(--cu-bg-menu)';
const REST_SHADOW = 'none';
const HOVER_SHADOW = '0 6px 18px rgba(0, 0, 0, 0.30)';

export function WhiteboardCard({ board }: { board: Whiteboard }) {
  const [hovered, setHovered] = useState(false);
  const subtitle = board.legacy ? `Legacy · ${board.editedLabel}` : board.editedLabel;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: `1px solid ${hovered ? 'var(--cu-border-strong)' : BORDER}`,
        background: CARD_BG,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: hovered ? HOVER_SHADOW : REST_SHADOW,
        transition: 'box-shadow 140ms ease, border-color 140ms ease',
      }}
    >
      {/* Thumbnail panel */}
      <div style={{ position: 'relative', height: 158 }}>
        <WhiteboardThumbnail />
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 14px',
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {board.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TEXT_MUTED,
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </div>
        </div>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            background: board.author.color,
            color: 'white',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            letterSpacing: 0.2,
          }}
        >
          {board.author.initials}
        </span>
      </div>
    </div>
  );
}
