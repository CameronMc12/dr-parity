'use client';

/**
 * Right-click context menu for a view tab (Rename / Duplicate / Delete view).
 * The shared `Menu` primitive only anchors to a trigger rect, so this renders a
 * `position: fixed` surface at the cursor `(x, y)` with the same surface styling,
 * below/above flip, and outside-close (pointerdown + Escape) behaviour, then
 * dispatches the per-list views-store actions.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { RenameIcon, DeleteIcon } from '@/components/pages/list-view-icons';
import { useAddView, useRemoveView, useRenameView } from '@/store/views/hooks';
import type { View } from '@/store/views/types';

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';

const MENU_WIDTH = 200;

export interface TabContextMenuPos {
  x: number;
  y: number;
}

function DuplicateIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Row({
  icon,
  label,
  danger,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        minHeight: 32,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: danger ? 'var(--cu-danger, rgb(225,95,95))' : TEXT_PRIMARY,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: danger ? 'inherit' : TEXT_MUTED,
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export function TabContextMenu({
  view,
  pos,
  onClose,
  onRename,
}: {
  view: View;
  pos: TabContextMenuPos;
  onClose: () => void;
  /** Hand control to the tab strip's inline-rename flow. */
  onRename: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const addView = useAddView();
  const removeView = useRemoveView();
  // renameView is consumed by the inline-rename flow in the tab strip; kept here
  // so the action surface stays colocated with the menu.
  useRenameView();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  // Flip up when there's no room below for the (3-row) menu.
  const estHeight = 120;
  const flipUp =
    typeof window !== 'undefined' && window.innerHeight - pos.y < estHeight;
  const left =
    typeof window !== 'undefined'
      ? Math.min(pos.x, window.innerWidth - MENU_WIDTH - 8)
      : pos.x;

  const duplicate = () => {
    addView(view.listId, view.code, `${view.name} copy`);
    onClose();
  };

  const remove = () => {
    removeView(view.listId, view.id);
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 9999,
        width: MENU_WIDTH,
        left,
        ...(flipUp
          ? { bottom: window.innerHeight - pos.y + 4 }
          : { top: pos.y + 4 }),
        background: MENU_BG,
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 8,
        boxShadow: MENU_SHADOW,
        padding: '6px 0',
        boxSizing: 'border-box',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
        animation: 'cuMenuIn 110ms ease',
      }}
    >
      <Row
        icon={<RenameIcon />}
        label="Rename"
        onSelect={() => {
          onRename();
          onClose();
        }}
      />
      <Row icon={<DuplicateIcon />} label="Duplicate" onSelect={duplicate} />
      <Row icon={<DeleteIcon />} label="Delete view" danger onSelect={remove} />
    </div>
  );
}
