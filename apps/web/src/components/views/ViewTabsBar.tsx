'use client';

/**
 * Shared view-tab strip. Replaces the four duplicated copies (List, Board,
 * Calendar, Gantt). Reads the per-list views store, renders one tab per view in
 * stored/templated order, navigates on click to /<wsId>/v/<code>/<segmentId>,
 * and exposes the "+ View" add-view popover. Right-clicking a tab opens a small
 * context menu (Rename / Duplicate / Delete view); choosing Rename swaps the tab
 * label for an inline input wired to the store.
 *
 * Markup, sizing, and active-state styling are byte-identical to the previous
 * per-view strips (container gap 2 / height 36 / padX 20/16 / 1px divider; tab
 * borderBottom 2px when active, fontWeight 600/500, glyph at size 15 in its own
 * colour). `showAddChannel` toggles the leading Add-Channel chip (present on
 * List/Board/Gantt, absent on Calendar).
 */

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { viewTypeByCode } from '@/lib/view-types';
import { useListViews, useRenameView } from '@/store/views/hooks';
import type { View } from '@/store/views/types';
import { AddViewMenu } from './AddViewMenu';
import { TabContextMenu, type TabContextMenuPos } from './TabContextMenu';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const BORDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';
const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;

function AddChannelChip() {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 26,
        padding: '0 9px',
        background: hover ? HOVER_BG : 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add Channel
    </button>
  );
}

function ViewTabButton({
  view,
  active,
  renaming,
  onSelect,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
}: {
  view: View;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
}) {
  const [hover, setHover] = useState(false);
  const type = viewTypeByCode(view.code);
  const Glyph = type?.Glyph;
  const color = type?.color ?? 'rgb(160,164,172)';

  if (renaming) {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 36,
          padding: '0 9px',
          borderBottom: `2px solid ${TEXT_PRIMARY}`,
        }}
      >
        {Glyph && <Glyph size={15} color={color} />}
        <input
          autoFocus
          defaultValue={view.name}
          onBlur={(e) => onRenameCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameCommit((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') onRenameCancel();
          }}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: TEXT_PRIMARY,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            width: Math.max(60, view.name.length * 8),
          }}
        />
      </span>
    );
  }

  return (
    <button
      data-testid={`viewtab-${view.code}`}
      aria-current={active ? 'page' : undefined}
      onClick={active ? undefined : onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 9px',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? TEXT_PRIMARY : 'transparent'}`,
        cursor: 'pointer',
        color: active ? TEXT_PRIMARY : hover ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {Glyph && <Glyph size={15} color={color} />}
      {view.name}
    </button>
  );
}

export function ViewTabsBar({
  listId,
  activeCode,
  showAddChannel = true,
}: {
  listId: string;
  activeCode: string;
  /** Leading Add-Channel chip (present on List/Board/Gantt, off for Calendar). */
  showAddChannel?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const views = useListViews(listId);
  const renameView = useRenameView();

  const wsId = pathname.split('/').filter(Boolean)[0] ?? '';

  const [ctx, setCtx] = useState<{ view: View; pos: TabContextMenuPos } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const goToView = (view: View) => {
    if (!wsId) return;
    router.push(`/${wsId}/v/${view.code}/${view.id}`);
  };

  const openContextMenu = (view: View, e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ view, pos: { x: e.clientX, y: e.clientY } });
  };

  return (
    <div
      data-testid="view-tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {showAddChannel && (
        <>
          <AddChannelChip />
          <span style={{ width: 8 }} />
        </>
      )}

      {views.map((view) => (
        <ViewTabButton
          key={view.id + view.code}
          view={view}
          active={view.code === activeCode}
          renaming={renamingId === view.id}
          onSelect={() => goToView(view)}
          onContextMenu={(e) => openContextMenu(view, e)}
          onRenameCommit={(name) => {
            renameView(listId, view.id, name);
            setRenamingId(null);
          }}
          onRenameCancel={() => setRenamingId(null)}
        />
      ))}

      <AddViewMenu listId={listId} />

      {ctx && (
        <TabContextMenu
          view={ctx.view}
          pos={ctx.pos}
          onClose={() => setCtx(null)}
          onRename={() => setRenamingId(ctx.view.id)}
        />
      )}
    </div>
  );
}
