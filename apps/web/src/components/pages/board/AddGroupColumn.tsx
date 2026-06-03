'use client';

/**
 * Trailing "+ Add group" rail at the right edge of the board. Clicking flips it
 * into an inline name input; submitting creates a new EMPTY status column via the
 * board-local added-groups store, so cards can be dragged into it and it survives
 * re-render. Escape or an empty blur cancels.
 */

import { useEffect, useRef, useState } from 'react';
import { BOARD } from './tokens';

export function AddGroupColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setName('');
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        data-testid="board-add-group-input"
        style={{
          width: BOARD.columnWidth,
          flexShrink: 0,
          paddingTop: 0,
        }}
      >
        <input
          ref={inputRef}
          value={name}
          placeholder="New status name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setName('');
              setEditing(false);
            }
          }}
          style={{
            width: '100%',
            height: 34,
            padding: '0 10px',
            background: BOARD.cardBg,
            border: `1px solid ${BOARD.borderStrong}`,
            borderRadius: BOARD.cardRadius,
            color: BOARD.textPrimary,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <button
      data-testid="board-add-group"
      aria-label="Add group"
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 160,
        flexShrink: 0,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        background: hover ? BOARD.cardHoverBg : 'transparent',
        border: `1px dashed ${BOARD.border}`,
        borderRadius: BOARD.cardRadius,
        cursor: 'pointer',
        color: hover ? BOARD.textSecondary : BOARD.textMuted,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'background 90ms, color 90ms',
        alignSelf: 'flex-start',
      }}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Add group
    </button>
  );
}
