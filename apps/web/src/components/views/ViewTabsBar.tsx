'use client';

/**
 * Shared view-tab strip. Reads the per-scope views store, renders one tab per
 * view in stored/templated order, navigates on click, and exposes the "+ View"
 * popover. Right-clicking a tab opens Rename / Duplicate / Delete.
 *
 * Channel grouping: when the scope's views include the synthetic Channel tab
 * (list-backed channel), the strip renders Channel → divider → pinned [Team,
 * Whiteboard, Activity, Map] → unpinned views → "N more…" overflow → "+ View".
 * Overflow is generic: any view past the available width collapses into the
 * "N more…" dropdown (measured from rendered tab widths). Lists/spaces/folders
 * with no Channel tab keep their flat order and only overflow when too wide.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { viewTypeByCode } from '@/lib/view-types';
import { scopeKey, type ViewScope } from '@/lib/view-scope';
import { useRenameView, useReorderViews } from '@/store/views/hooks';
import type { View } from '@/store/views/types';
import { AddViewMenu } from './AddViewMenu';
import { TabContextMenu, type TabContextMenuPos } from './TabContextMenu';
import { viewRoutePath } from './view-route';
import { useScopeViewsWithChannel } from './use-channel-views';
import { orderChannelTabs } from './order-channel-tabs';
import { MoreViewsDropdown } from './MoreViewsDropdown';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const BORDER = 'var(--cu-border-divider)';
const BORDER_STRONG = 'var(--cu-border-strong)';
const HOVER_BG = 'var(--cu-bg-hover)';
const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;
/** Reserve space for the trailing "N more…" + "+ View" controls when measuring. */
const TRAILING_RESERVE = 150;

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

function TabDivider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 18, background: BORDER_STRONG, margin: '0 6px', flexShrink: 0 }}
    />
  );
}

function ViewTabButton({
  view,
  active,
  renaming,
  innerRef,
  measureOnly,
  onSelect,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  view: View;
  active: boolean;
  renaming: boolean;
  innerRef?: (el: HTMLButtonElement | null) => void;
  measureOnly?: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
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
      ref={innerRef}
      data-testid={measureOnly ? undefined : `viewtab-${view.code}`}
      aria-hidden={measureOnly || undefined}
      tabIndex={measureOnly ? -1 : undefined}
      aria-current={active ? 'page' : undefined}
      draggable
      onClick={active ? undefined : onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
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
        flexShrink: 0,
      }}
    >
      {Glyph && <Glyph size={15} color={color} />}
      {view.name}
    </button>
  );
}

export function ViewTabsBar({
  scope,
  activeCode,
  showAddChannel = true,
}: {
  scope: ViewScope;
  activeCode: string;
  showAddChannel?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const key = scopeKey(scope);
  const views = useScopeViewsWithChannel(scope);
  const renameView = useRenameView();
  const reorderViews = useReorderViews();

  const wsId = pathname.split('/').filter(Boolean)[0] ?? '';

  const [ctx, setCtx] = useState<{ view: View; pos: TabContextMenuPos } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Overflow: how many of the `rest` tabs fit before collapsing into "N more…".
  const containerRef = useRef<HTMLDivElement>(null);
  const restRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const fixedRef = useRef<HTMLDivElement>(null);
  const [visibleRestCount, setVisibleRestCount] = useState<number>(Number.POSITIVE_INFINITY);

  const { channel, pinned, rest } = orderChannelTabs(views);

  const goToView = (view: View) => {
    if (!wsId) return;
    if (view.code === 'channel') {
      router.push(`/${wsId}/chat/c/${view.id}`);
      return;
    }
    router.push(viewRoutePath(wsId, scope, view.code, view.id));
  };

  const openContextMenu = (view: View, e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ view, pos: { x: e.clientX, y: e.clientY } });
  };

  const dropBefore = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const ids = views.map((v) => v.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId), 0, draggingId);
    reorderViews(key, ids);
    setDraggingId(null);
  };

  // Measure the rest tabs against the available width; collapse overflow.
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const avail =
        container.clientWidth - ROW_PAD_LEFT - ROW_PAD_RIGHT - (fixedRef.current?.offsetWidth ?? 0) - TRAILING_RESERVE;
      let used = 0;
      let count = 0;
      for (const view of rest) {
        const el = restRefs.current.get(view.id + view.code);
        const w = el?.offsetWidth ?? 0;
        if (used + w > avail) break;
        used += w;
        count += 1;
      }
      setVisibleRestCount(count);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // Re-measure when the rest set identity changes.
  }, [rest.map((v) => v.id + v.code).join('|'), rest]);

  const safeVisible = Number.isFinite(visibleRestCount)
    ? Math.max(0, Math.min(visibleRestCount, rest.length))
    : rest.length;
  const visibleRest = rest.slice(0, safeVisible);
  const overflowRest = rest.slice(safeVisible);

  const renderTab = (view: View, opts?: { measureRest?: boolean }) => (
    <ViewTabButton
      key={view.id + view.code}
      view={view}
      active={view.code === activeCode}
      renaming={renamingId === view.id}
      measureOnly={opts?.measureRest}
      innerRef={
        opts?.measureRest
          ? (el) => {
              if (el) restRefs.current.set(view.id + view.code, el);
              else restRefs.current.delete(view.id + view.code);
            }
          : undefined
      }
      onSelect={() => goToView(view)}
      onContextMenu={(e) => openContextMenu(view, e)}
      onRenameCommit={(name) => {
        renameView(key, view.id, name);
        setRenamingId(null);
      }}
      onRenameCancel={() => setRenamingId(null)}
      onDragStart={() => setDraggingId(view.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => dropBefore(view.id)}
    />
  );

  return (
    <div
      ref={containerRef}
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
        overflow: 'hidden',
      }}
    >
      <div ref={fixedRef} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {showAddChannel && (
          <>
            <AddChannelChip />
            <span style={{ width: 8 }} />
          </>
        )}

        {channel && renderTab(channel)}
        {channel && <TabDivider />}
        {pinned.map((view) => renderTab(view))}
      </div>

      {/* Hidden full-rest measurement row: every rest tab rendered for width. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', display: 'flex' }}
      >
        {rest.map((view) => renderTab(view, { measureRest: true }))}
      </div>

      {/* Visible rest tabs. */}
      {visibleRest.map((view) => renderTab(view))}

      <MoreViewsDropdown views={overflowRest} activeCode={activeCode} onSelect={goToView} />

      <AddViewMenu scope={scope} />

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
