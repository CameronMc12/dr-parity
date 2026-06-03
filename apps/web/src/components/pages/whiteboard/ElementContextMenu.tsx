'use client';

/**
 * Generic right-click menu for any board element (sticky / rect / ellipse /
 * text / connector). Renders a small floating ClickUp-style popover anchored at
 * the cursor with a Delete action that removes the element from the *board*
 * (board.remove) — never the underlying task record. Seeded task stickies get
 * their store-level task menu separately; this one only owns the canvas node.
 *
 * Closes on outside-click, scroll, or Escape. Positioned with a portal so the
 * fixed coordinates are not affected by the canvas pan/zoom transform.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-card, rgba(0,0,0,0.1))';
const DANGER = 'var(--cu-status-red, #e5484d)';
const HOVER_BG = 'var(--cu-bg-hover, rgba(0,0,0,0.05))';

export interface ElementMenuState {
  id: string;
  x: number;
  y: number;
}

function TrashIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function ElementContextMenu({
  state,
  onClose,
  onDelete,
}: {
  state: ElementMenuState | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [state, onClose]);

  if (!state || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Board element actions"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        minWidth: 160,
        padding: 4,
        borderRadius: 8,
        background: MENU_BG,
        border: `1px solid ${MENU_BORDER}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDelete(state.id);
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          border: 'none',
          background: 'transparent',
          color: DANGER,
          fontSize: 13,
          fontWeight: 500,
          textAlign: 'left',
          cursor: 'pointer',
          borderRadius: 6,
          transition: 'background 120ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <TrashIcon />
        <span>Delete</span>
      </button>
    </div>,
    document.body,
  );
}
