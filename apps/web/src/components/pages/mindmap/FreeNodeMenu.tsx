'use client';

/**
 * Cursor-anchored context menu for a Freeform node. Opens on right-click at the
 * pointer position; closes on outside-click / Escape. Offers Edit text, Convert
 * to task (only while the node is not yet a task), and Delete. Matches the dark
 * ClickUp menu surface tokens.
 */

import { useEffect, useRef } from 'react';

const MENU_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const MENU_BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,0.45))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(217,217,217))';
const TEXT_DANGER = 'var(--cu-status-red, rgb(226,90,90))';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.06))';

export interface FreeNodeMenuState {
  nodeId: string;
  x: number;
  y: number;
  isTask: boolean;
}

interface Props {
  state: FreeNodeMenuState;
  onClose: () => void;
  onEdit: (id: string) => void;
  onConvert: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FreeNodeMenu({
  state,
  onClose,
  onEdit,
  onConvert,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="freeform-node-menu"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 9999,
        minWidth: 184,
        padding: '6px 0',
        background: MENU_BG,
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 8,
        boxShadow: MENU_SHADOW,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Row label="Edit text" onClick={() => run(() => onEdit(state.nodeId))} />
      {!state.isTask && (
        <Row
          label="Convert to task"
          onClick={() => run(() => onConvert(state.nodeId))}
        />
      )}
      <Divider />
      <Row
        label="Delete"
        danger
        onClick={() => run(() => onDelete(state.nodeId))}
      />
    </div>
  );
}

function Row({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      style={{
        width: '100%',
        height: 32,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        fontFamily: 'inherit',
        color: danger ? TEXT_DANGER : TEXT_PRIMARY,
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `1px solid ${MENU_BORDER}`,
        margin: '4px 0',
      }}
    />
  );
}
