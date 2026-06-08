'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuDivider, MenuItem } from '@/components/ui/Menu';
import type { DocHubRow } from './docs-hub-data';

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const DANGER = 'rgb(226, 67, 41)';

const MENU_WIDTH = 220;
const EST_HEIGHT = 360;

export interface DocRowContextMenuPos {
  x: number;
  y: number;
}

function I({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

const OpenIcon = () => <I d="M5 5h6M5 5v6M5 5l7 7M19 13v6h-6M19 19l-7-7" />;
const RenameIcon = () => <I d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.2 7.3l3.5 3.5" />;
const CopyLinkIcon = () => <I d="M9.5 14.5l5-5M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2" />;
const DuplicateIcon = () => <I d="M8.5 8.5h9v9h-9zM6.5 15.5h-1v-9h9v1" />;
const FavoriteIcon = () => <I d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.4 7.4 18.8l.9-5.1L4.5 10l5.2-.8L12 4.5z" />;
const MoveIcon = () => <I d="M12 4v16M12 4l-3 3M12 4l3 3M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3M12 20l-3-3M12 20l3-3" />;
const ArchiveIcon = () => <I d="M4 5h16v4H4zM5.5 9v8a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4" />;
const DeleteIcon = () => <I d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7" />;

/**
 * Right-click context menu for a docs-hub table row. Mirrors the ClickUp doc
 * row menu (Open / Rename / Copy link / Duplicate / Favorite / Move / Archive /
 * Delete). Docs are not workspace-tree nodes so the mutating items run a local
 * no-op then close; Delete asks for confirmation before signalling the parent.
 * Positioned as a fixed surface at the cursor, matching TaskContextMenu.
 */
export function DocRowContextMenu({
  doc,
  pos,
  onClose,
  onOpen,
  onDelete,
}: {
  doc: DocHubRow;
  pos: DocRowContextMenuPos;
  onClose: () => void;
  onOpen: () => void;
  onDelete?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

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

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const copyLink = () =>
    act(() => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const url =
          typeof window !== 'undefined'
            ? `${location.origin}/90152566819/v/dc/${doc.id}`
            : `/90152566819/v/dc/${doc.id}`;
        void navigator.clipboard.writeText(url);
      }
    });

  const remove = () => {
    const ok =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete "${doc.name}"? This cannot be undone.`);
    if (ok) onDelete?.(doc.id);
    onClose();
  };

  const noop = () => act(() => undefined);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const flipUp = vh - pos.y < EST_HEIGHT;
  const left = Math.min(pos.x, vw - MENU_WIDTH - 8);

  return (
    <div
      ref={ref}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 9999,
        width: MENU_WIDTH,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        left,
        ...(flipUp ? { bottom: vh - pos.y + 4 } : { top: pos.y + 4 }),
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
      <MenuItem icon={<OpenIcon />} label="Open" onSelect={() => act(onOpen)} />
      <MenuItem icon={<RenameIcon />} label="Rename" onSelect={noop} />
      <MenuItem icon={<CopyLinkIcon />} label="Copy link" onSelect={copyLink} />
      <MenuItem icon={<DuplicateIcon />} label="Duplicate" onSelect={noop} />
      <MenuDivider />
      <MenuItem icon={<FavoriteIcon />} label="Add to Favorites" onSelect={noop} />
      <MenuItem icon={<MoveIcon />} label="Move" onSelect={noop} />
      <MenuDivider />
      <MenuItem icon={<ArchiveIcon />} label="Archive" onSelect={noop} />
      <MenuItem
        icon={<span style={{ color: DANGER }}><DeleteIcon /></span>}
        label={<span style={{ color: DANGER }}>Delete</span>}
        onSelect={remove}
      />
    </div>
  );
}

interface OpenState {
  doc: DocHubRow;
  pos: DocRowContextMenuPos;
}

/**
 * Wire any docs-hub row to the right-click menu. Spread `onContextMenu` onto
 * each row, render `menu` once. `onOpen` navigates to the doc; `onDelete` removes
 * the row from local state (the data set is static, so deletion is session-only).
 */
export function useDocRowContextMenu(
  onOpen: (doc: DocHubRow) => void,
  onDelete?: (id: string) => void,
) {
  const [state, setState] = useState<OpenState | null>(null);

  const onContextMenu = (e: React.MouseEvent, doc: DocHubRow) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ doc, pos: { x: e.clientX, y: e.clientY } });
  };

  const close = () => setState(null);

  const menu: ReactNode = state ? (
    <DocRowContextMenu
      doc={state.doc}
      pos={state.pos}
      onClose={close}
      onOpen={() => onOpen(state.doc)}
      onDelete={onDelete}
    />
  ) : null;

  return { onContextMenu, menu, close };
}
