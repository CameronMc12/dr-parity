'use client';

/**
 * CardFrame — the chrome wrapped around every dashboard card, matching ClickUp's
 * card-header action anatomy.
 *
 * Header: an inline-editable title plus a hover toolbar of icon actions —
 * Filter, Refresh, Fullscreen, an Options "…" menu, and (in edit mode) a drag
 * handle. The Options menu mirrors ClickUp's real set: Customize (metric /
 * grouping), Refresh, Fullscreen, Show history, AI-only Regenerate AI content +
 * Edit AI card settings, Duplicate, Delete.
 *
 * Body: the card renderer, keyed by the card's `refreshTick` so a manual Refresh
 * re-runs the derivation. Footer: a bottom-right resize handle (edit mode).
 *
 * Drag + resize are driven by the parent grid via the `onDragStart` /
 * `onResizeStart` pointer callbacks. Fullscreen is lifted to the grid via
 * `onFullscreen` so a single modal renders above the whole board.
 */

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  Menu,
  MenuDivider,
  MenuHeading,
  MenuItem,
  MenuToggle,
} from '@/components/ui/Menu';
import { useDashboardActions } from '@/store/dashboard/hooks';
import { useMembers } from '@/store/workspace/hooks';
import type {
  CardFilters,
  CardGrouping,
  CardMetric,
  DashboardCard,
} from '@/store/dashboard';
import { DASH } from './tokens';
import { cardTypeMeta } from './cards/registry';
import {
  DragIcon,
  DuplicateIcon,
  EditIcon,
  EllipsisIcon,
  FilterIcon,
  FullscreenIcon,
  HistoryIcon,
  MoveIcon,
  RefreshIcon,
  SettingsIcon,
  SparkleIcon,
  TrashIcon,
} from './card-icons';
import { CardHistoryPopover } from './CardHistoryPopover';

const METRIC_OPTIONS: { value: CardMetric; label: string }[] = [
  { value: 'total', label: 'Total tasks' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'inProgress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'completedThisWeek', label: 'Completed this week' },
];

const GROUPING_OPTIONS: { value: CardGrouping; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
];

const CHART_TYPES = new Set(['bar', 'pie']);
const STAT_TYPES = new Set(['stat']);
const AI_TYPES = new Set(['aiSummary']);

type Actions = ReturnType<typeof useDashboardActions>;

interface CardFrameProps {
  viewId: string;
  card: DashboardCard;
  editing: boolean;
  children: ReactNode;
  onDragStart: (e: ReactPointerEvent) => void;
  onResizeStart: (e: ReactPointerEvent) => void;
  onFullscreen: () => void;
  /** "Move" in the options menu asks the board to enter drag/edit mode. */
  onRequestMove: () => void;
}

export function CardFrame({
  viewId,
  card,
  editing,
  children,
  onDragStart,
  onResizeStart,
  onFullscreen,
  onRequestMove,
}: CardFrameProps) {
  const actions = useDashboardActions();
  const [hover, setHover] = useState(false);
  // Bumped by the options-menu "Edit" item to start the inline title editor.
  const [editTitleSignal, setEditTitleSignal] = useState(0);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: DASH.cardBg,
        border: `1px solid ${DASH.border}`,
        borderRadius: DASH.radius,
        boxShadow: hover ? DASH.shadowHover : DASH.shadow,
        transition: 'box-shadow 160ms ease',
        overflow: 'hidden',
      }}
    >
      <CardHeader
        viewId={viewId}
        card={card}
        toolbarVisible={hover || editing}
        editing={editing}
        actions={actions}
        onDragStart={onDragStart}
        onFullscreen={onFullscreen}
        onRequestMove={onRequestMove}
        editTitleSignal={editTitleSignal}
        onRequestEdit={() => setEditTitleSignal((n) => n + 1)}
      />

      {/* Re-key on refreshTick so a manual Refresh re-runs the card body. */}
      <div key={card.refreshTick ?? 0} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>

      {editing && <ResizeHandle onPointerDown={onResizeStart} />}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  viewId: string;
  card: DashboardCard;
  toolbarVisible: boolean;
  editing: boolean;
  actions: Actions;
  onDragStart: (e: ReactPointerEvent) => void;
  onFullscreen: () => void;
  onRequestMove: () => void;
  onRequestEdit: () => void;
  editTitleSignal: number;
}

function CardHeader({
  viewId,
  card,
  toolbarVisible,
  editing,
  actions,
  onDragStart,
  onFullscreen,
  onRequestMove,
  onRequestEdit,
  editTitleSignal,
}: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 6px 0 12px',
        borderBottom: `1px solid ${DASH.border}`,
        flexShrink: 0,
      }}
    >
      <EditableTitle
        title={card.title}
        editSignal={editTitleSignal}
        onCommit={(next) => actions.renameCard(viewId, card.id, next)}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          marginLeft: 'auto',
          opacity: toolbarVisible ? 1 : 0,
          transition: 'opacity 120ms ease',
          pointerEvents: toolbarVisible ? 'auto' : 'none',
        }}
      >
        <FilterMenu viewId={viewId} card={card} actions={actions} />
        <HeaderIconButton
          title="Refresh"
          onClick={() => actions.refreshCard(viewId, card.id)}
        >
          <RefreshIcon />
        </HeaderIconButton>
        <HeaderIconButton title="Fullscreen" onClick={onFullscreen}>
          <FullscreenIcon />
        </HeaderIconButton>
        <OptionsMenu
          viewId={viewId}
          card={card}
          actions={actions}
          onFullscreen={onFullscreen}
          onRequestMove={onRequestMove}
          onRequestEdit={onRequestEdit}
        />
        {editing && <DragHandle onPointerDown={onDragStart} />}
      </div>
    </div>
  );
}

function EditableTitle({
  title,
  editSignal,
  onCommit,
}: {
  title: string;
  editSignal: number;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  useEffect(() => {
    setValue(title);
  }, [title]);

  // The options-menu "Edit" item bumps editSignal to open the inline editor.
  useEffect(() => {
    if (editSignal > 0) setEditing(true);
  }, [editSignal]);

  const commit = () => {
    const next = value.trim();
    if (next && next !== title) onCommit(next);
    else setValue(title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(title);
            setEditing(false);
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          height: 24,
          padding: '0 4px',
          fontSize: 13,
          fontWeight: 600,
          color: DASH.textPrimary,
          background: DASH.cardHoverBg,
          border: `1px solid ${DASH.accent}`,
          borderRadius: 4,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      style={{
        flex: 1,
        minWidth: 0,
        height: 24,
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        cursor: 'text',
        padding: 0,
        fontSize: 13,
        fontWeight: 600,
        color: DASH.textPrimary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {title}
    </button>
  );
}

// ── Header buttons ────────────────────────────────────────────────────────

function HeaderIconButton({
  ref,
  onClick,
  active,
  title,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={ref}
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        background: hover || active ? DASH.cardHoverBg : 'transparent',
        color: active ? DASH.accent : DASH.textMuted,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Filter popover ──────────────────────────────────────────────────────────

function FilterMenu({
  viewId,
  card,
  actions,
}: {
  viewId: string;
  card: DashboardCard;
  actions: Actions;
}) {
  const members = useMembers();
  const filters: CardFilters = card.filters ?? { status: [], assignee: [] };
  const active = filters.status.length > 0 || filters.assignee.length > 0;

  const toggleAssignee = (id: string) => {
    const next = filters.assignee.includes(id)
      ? filters.assignee.filter((x) => x !== id)
      : [...filters.assignee, id];
    actions.setCardFilters(viewId, card.id, { ...filters, assignee: next });
  };

  return (
    <Menu
      width={220}
      align="right"
      trigger={({ ref, onClick }) => (
        <HeaderIconButton ref={ref} onClick={onClick} active={active} title="Filter">
          <FilterIcon />
        </HeaderIconButton>
      )}
    >
      <MenuHeading>Filter by assignee</MenuHeading>
      {members.map((m) => (
        <MenuToggle
          key={m.id}
          label={m.name}
          checked={filters.assignee.includes(m.id)}
          onChange={() => toggleAssignee(m.id)}
        />
      ))}
      {active && (
        <>
          <MenuDivider />
          <MenuItem
            label="Clear filters"
            onSelect={() =>
              actions.setCardFilters(viewId, card.id, { status: [], assignee: [] })
            }
          />
        </>
      )}
    </Menu>
  );
}

// ── Options menu (the "…") ──────────────────────────────────────────────────

function OptionsMenu({
  viewId,
  card,
  actions,
  onFullscreen,
  onRequestMove,
  onRequestEdit,
}: {
  viewId: string;
  card: DashboardCard;
  actions: Actions;
  onFullscreen: () => void;
  onRequestMove: () => void;
  onRequestEdit: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const isChart = CHART_TYPES.has(card.type);
  const isStat = STAT_TYPES.has(card.type);
  const isAi = AI_TYPES.has(card.type);
  const meta = cardTypeMeta(card.type);

  return (
    <>
      <Menu
        width={210}
        align="right"
        trigger={({ ref, onClick }) => (
          <HeaderIconButton ref={ref} onClick={onClick} title="Options">
            <EllipsisIcon />
          </HeaderIconButton>
        )}
      >
        {meta && <MenuHeading>{meta.label}</MenuHeading>}

        <MenuItem icon={<EditIcon />} label="Edit" onSelect={onRequestEdit} />

        {(isStat || isChart) && (
          <MenuItem
            icon={<SettingsIcon />}
            label="Customize"
            submenu={
              <CustomizeSubmenu
                viewId={viewId}
                card={card}
                actions={actions}
                isStat={isStat}
                isChart={isChart}
              />
            }
          />
        )}

        <MenuItem
          icon={<FilterIcon />}
          label="Filter"
          submenu={<CardFilterSubmenu viewId={viewId} card={card} actions={actions} />}
        />

        {isAi && (
          <>
            <MenuItem
              icon={<SparkleIcon />}
              label="Regenerate AI content"
              onSelect={() => actions.refreshCard(viewId, card.id)}
            />
            <MenuItem
              icon={<SettingsIcon />}
              label="Edit AI card settings"
              onSelect={() => actions.refreshCard(viewId, card.id)}
            />
            <MenuDivider />
          </>
        )}

        <MenuItem
          icon={<RefreshIcon />}
          label="Refresh"
          onSelect={() => actions.refreshCard(viewId, card.id)}
        />
        <MenuItem icon={<MoveIcon />} label="Move" onSelect={onRequestMove} />
        <MenuItem
          icon={<FullscreenIcon />}
          label="Fullscreen"
          onSelect={onFullscreen}
        />
        <MenuItem
          icon={<HistoryIcon />}
          label="Show history"
          onSelect={() => setHistoryOpen(true)}
        />
        <MenuDivider />
        <MenuItem
          icon={<DuplicateIcon />}
          label="Duplicate"
          onSelect={() => actions.duplicateCard(viewId, card.id)}
        />
        <MenuItem
          icon={<TrashIcon />}
          label="Delete"
          onSelect={() => actions.removeCard(viewId, card.id)}
        />
      </Menu>

      <CardHistoryPopover
        card={card}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

/** The per-card assignee filter, surfaced as a submenu off the "…" Filter item. */
function CardFilterSubmenu({
  viewId,
  card,
  actions,
}: {
  viewId: string;
  card: DashboardCard;
  actions: Actions;
}) {
  const members = useMembers();
  const filters: CardFilters = card.filters ?? { status: [], assignee: [] };
  const active = filters.assignee.length > 0;

  const toggle = (id: string) => {
    const next = filters.assignee.includes(id)
      ? filters.assignee.filter((x) => x !== id)
      : [...filters.assignee, id];
    actions.setCardFilters(viewId, card.id, { ...filters, assignee: next });
  };

  return (
    <>
      <MenuHeading>Filter by assignee</MenuHeading>
      {members.map((m) => (
        <MenuToggle
          key={m.id}
          label={m.name}
          checked={filters.assignee.includes(m.id)}
          onChange={() => toggle(m.id)}
        />
      ))}
      {active && (
        <>
          <MenuDivider />
          <MenuItem
            label="Clear filters"
            onSelect={() =>
              actions.setCardFilters(viewId, card.id, { status: [], assignee: [] })
            }
          />
        </>
      )}
    </>
  );
}

function CustomizeSubmenu({
  viewId,
  card,
  actions,
  isStat,
  isChart,
}: {
  viewId: string;
  card: DashboardCard;
  actions: Actions;
  isStat: boolean;
  isChart: boolean;
}) {
  return (
    <>
      {isStat && (
        <>
          <MenuHeading>Metric</MenuHeading>
          {METRIC_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.value}
              label={opt.label}
              active={card.config?.metric === opt.value}
              onSelect={() =>
                actions.updateCardConfig(viewId, card.id, { metric: opt.value })
              }
            />
          ))}
        </>
      )}

      {isChart && (
        <>
          <MenuHeading>Group by</MenuHeading>
          {GROUPING_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.value}
              label={opt.label}
              active={card.config?.grouping === opt.value}
              onSelect={() =>
                actions.updateCardConfig(viewId, card.id, { grouping: opt.value })
              }
            />
          ))}
          <MenuDivider />
          <MenuToggle
            label="Open tasks only"
            checked={card.config?.openOnly ?? false}
            onChange={(next) =>
              actions.updateCardConfig(viewId, card.id, { openOnly: next })
            }
          />
        </>
      )}
    </>
  );
}

// ── Drag + resize handles ─────────────────────────────────────────────────

function DragHandle({
  onPointerDown,
}: {
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  return (
    <button
      onPointerDown={onPointerDown}
      title="Drag to move"
      aria-label="Drag to move"
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: 'none',
        cursor: 'grab',
        background: 'transparent',
        color: DASH.textMuted,
        touchAction: 'none',
      }}
    >
      <DragIcon />
    </button>
  );
}

function ResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to resize"
      style={{
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 16,
        height: 16,
        cursor: 'nwse-resize',
        color: DASH.textMuted,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        touchAction: 'none',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M11 4 4 11M11 8 8 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
