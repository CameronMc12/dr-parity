'use client';

/**
 * DashboardToolbar — the bar above the card grid. Left: a Filters popover.
 * Right: a live "Refreshed: …" label (re-derives the relative time on demand),
 * an Auto-refresh toggle (persisted), a Schedule report popover (visual), a
 * Customize button that toggles edit/drag mode, and an Add card button.
 *
 * Every control is wired: edit mode + add-card open are lifted to the parent
 * (DashboardView) so the grid and modal react to them.
 */

import { useCallback, useState } from 'react';
import { Menu } from '@/components/ui/Menu';
import {
  useAutoRefresh,
  useDashboardActions,
  useDashboardCards,
} from '@/store/dashboard/hooks';
import { DashboardFilters } from './DashboardFilters';
import { ScheduleReportModal } from './ScheduleReportModal';
import { DASH } from './tokens';

interface DashboardToolbarProps {
  viewId: string;
  listId: string;
  editing: boolean;
  onToggleEditing: () => void;
  onAddCard: () => void;
}

export function DashboardToolbar({
  viewId,
  listId,
  editing,
  onToggleEditing,
  onAddCard,
}: DashboardToolbarProps) {
  const actions = useDashboardActions();
  const autoRefresh = useAutoRefresh(viewId);
  const [refreshedTick, setRefreshedTick] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const refresh = useCallback(() => {
    setRefreshedTick((n) => n + 1);
    actions.refreshAll(viewId);
  }, [actions, viewId]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px',
        borderBottom: `1px solid ${DASH.border}`,
        background: DASH.toolbarBg,
        flexShrink: 0,
      }}
    >
      <FiltersMenu viewId={viewId} listId={listId} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <RefreshedLabel tick={refreshedTick} onRefresh={refresh} />

        <ToolbarButton
          label={`Auto refresh: ${autoRefresh ? 'On' : 'Off'}`}
          active={autoRefresh}
          onClick={() => actions.setAutoRefresh(viewId, !autoRefresh)}
        />

        <ToolbarButton
          label="Schedule report"
          active={scheduleOpen}
          onClick={() => setScheduleOpen(true)}
        />

        <ToolbarButton
          label="Customize"
          active={editing}
          onClick={onToggleEditing}
          icon="✎"
        />

        <ToolbarButton label="Add card" primary onClick={onAddCard} icon="＋" />
      </div>

      <ScheduleReportModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </div>
  );
}

// ── Refreshed label ─────────────────────────────────────────────────────────

function RefreshedLabel({
  tick,
  onRefresh,
}: {
  tick: number;
  onRefresh: () => void;
}) {
  // `tick` increments on each manual refresh; the label re-derives ("just now").
  const label = tick === 0 ? 'just now' : `${tick} refresh${tick === 1 ? '' : 'es'} ago`;
  return (
    <ToolbarButton label={`Refreshed: ${label}`} onClick={onRefresh} muted />
  );
}

// ── Filters menu ────────────────────────────────────────────────────────────

function FiltersMenu({ viewId, listId }: { viewId: string; listId: string }) {
  const cards = useDashboardCards(viewId);

  // Active count = union of pinned assignee + status filters across cards (the
  // board filter is fanned out onto every card). Drives the "N Filters" label.
  const active = new Set<string>();
  for (const c of cards) {
    for (const a of c.filters?.assignee ?? []) active.add(`a:${a}`);
    for (const s of c.filters?.status ?? []) active.add(`s:${s}`);
  }
  const count = active.size;

  return (
    <Menu
      width={364}
      align="left"
      trigger={({ ref, onClick, open }) => (
        <ToolbarButton
          ref={ref}
          label={count > 0 ? `${count} Filter${count === 1 ? '' : 's'}` : 'Filters'}
          active={open || count > 0}
          onClick={onClick}
          icon="⛛"
        />
      )}
      surfaceStyle={{ padding: 0 }}
    >
      <DashboardFilters viewId={viewId} listId={listId} onClose={dismissMenu} />
    </Menu>
  );
}

/**
 * The Menu primitive closes on Escape (and outside-click) but exposes no close
 * handle to its children. The panel's "Done" button dispatches a synthetic
 * Escape so the popover dismisses without us reaching into Menu internals.
 */
function dismissMenu() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

// ── Toolbar button ──────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  icon?: string;
  active?: boolean;
  primary?: boolean;
  muted?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function ToolbarButton({
  ref,
  label,
  icon,
  active,
  primary,
  muted,
  onClick,
}: ToolbarButtonProps) {
  const [hover, setHover] = useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    transition: 'background 120ms ease, border-color 120ms ease',
  };

  if (primary) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...base,
          border: 'none',
          color: '#fff',
          background: hover
            ? 'color-mix(in srgb, var(--cu-accent) 85%, black)'
            : DASH.accent,
        }}
      >
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </button>
    );
  }

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...base,
        border: `1px solid ${active ? DASH.accent : DASH.border}`,
        color: muted ? DASH.textMuted : active ? DASH.textPrimary : DASH.textSecondary,
        background: hover || active ? DASH.cardHoverBg : 'transparent',
      }}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}
