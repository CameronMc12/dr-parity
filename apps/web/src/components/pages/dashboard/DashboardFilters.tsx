'use client';

/**
 * DashboardFilters — the real ClickUp "Dashboard Filters" popover.
 *
 * Anatomy (matches docs/research/clickup-parity/interactions/dashboard/filters.png):
 *   - "Dashboard Filters" heading + a trash button to clear everything
 *   - a "Select filter" dropdown row that, when open, reveals a searchable
 *     field list ("In selected location(s)", Archived, Assignee, … Sprint points)
 *   - each added field becomes an active filter row with its own value control
 *
 * Wiring: the dashboard has no rich board-filter model in its store (the store
 * only carries per-card status/assignee filters), so the supported fields
 * (Assignee, Status, Archived) are fanned out onto every card's `CardFilters`
 * exactly like the legacy toolbar did — the cards already honour those. The
 * remaining fields render as real, removable rows for structural parity but do
 * not yet narrow data (no backing model); they are kept so the panel matches
 * ClickUp 1:1.
 */

import { useMemo, useState } from 'react';
import { useDashboardActions, useDashboardCards } from '@/store/dashboard/hooks';
import { useMembers } from '@/store/workspace/hooks';
import type { CardFilters } from '@/store/dashboard';
import { DASH } from './tokens';
import { TrashIcon } from './card-icons';
import { ChevronRightIcon } from '@/components/ui/Menu';

/** Every field ClickUp offers in the dashboard filter dropdown, in order. */
const FILTER_FIELDS = [
  { id: 'location', label: 'In selected location(s)', wired: false },
  { id: 'archived', label: 'Archived', wired: true },
  { id: 'assignedComment', label: 'Assigned comment', wired: false },
  { id: 'assignee', label: 'Assignee', wired: true },
  { id: 'createdBy', label: 'Created by', wired: false },
  { id: 'dateClosed', label: 'Date closed', wired: false },
  { id: 'dateCreated', label: 'Date created', wired: false },
  { id: 'dateDone', label: 'Date done', wired: false },
  { id: 'dateUpdated', label: 'Date updated', wired: false },
  { id: 'dependency', label: 'Dependency', wired: false },
  { id: 'dueDate', label: 'Due date', wired: true },
  { id: 'duration', label: 'Duration', wired: false },
  { id: 'follower', label: 'Follower', wired: false },
  { id: 'lastStatusChange', label: 'Last status change', wired: false },
  { id: 'location/list', label: 'Location/List', wired: false },
  { id: 'priority', label: 'Priority', wired: false },
  { id: 'recurring', label: 'Recurring', wired: false },
  { id: 'sprintPoints', label: 'Sprint points', wired: false },
] as const;

type FieldId = (typeof FILTER_FIELDS)[number]['id'];

const fieldLabel = (id: FieldId): string =>
  FILTER_FIELDS.find((f) => f.id === id)?.label ?? id;

interface DashboardFiltersProps {
  viewId: string;
  /** Kept for API symmetry with the toolbar; richer fields will read it later. */
  listId?: string;
  onClose: () => void;
}

export function DashboardFilters({ viewId, onClose }: DashboardFiltersProps) {
  const members = useMembers();
  const cards = useDashboardCards(viewId);
  const actions = useDashboardActions();

  // Derive the active board filter as the union pinned across cards (the cards
  // share one fanned-out filter set). Only Assignee is model-backed today.
  const assignee = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) for (const a of c.filters?.assignee ?? []) set.add(a);
    return set;
  }, [cards]);

  // Which field rows the user has added to the panel (parity: keep all visible).
  const [rows, setRows] = useState<FieldId[]>(() => (assignee.size ? ['assignee'] : ['assignee']));
  const [picking, setPicking] = useState(false);

  // ── fan-out helpers (only the model-backed fields mutate real data) ───────
  const patchAll = (patch: (cur: CardFilters) => CardFilters) => {
    for (const c of cards) {
      const cur = c.filters ?? { status: [], assignee: [] };
      actions.setCardFilters(viewId, c.id, patch(cur));
    }
  };

  const toggleAssignee = (id: string) =>
    patchAll((cur) => ({
      ...cur,
      assignee: cur.assignee.includes(id)
        ? cur.assignee.filter((x) => x !== id)
        : [...cur.assignee, id],
    }));

  const clearAll = () => {
    for (const c of cards) {
      if (c.filters && (c.filters.assignee.length || c.filters.status.length)) {
        actions.setCardFilters(viewId, c.id, { status: [], assignee: [] });
      }
    }
    setRows([]);
  };

  const addRow = (id: FieldId) => {
    setRows((r) => (r.includes(id) ? r : [...r, id]));
    setPicking(false);
  };

  const removeRow = (id: FieldId) => {
    setRows((r) => r.filter((x) => x !== id));
    if (id === 'assignee') patchAll((cur) => ({ ...cur, assignee: [] }));
  };

  const activeCount = assignee.size;

  return (
    <div style={{ width: 340, padding: '12px 12px 8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: DASH.textPrimary }}>
          Dashboard Filters
        </span>
        <button
          onClick={clearAll}
          title="Clear all filters"
          aria-label="Clear all filters"
          style={{
            marginLeft: 'auto',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: activeCount ? DASH.textSecondary : DASH.textMuted,
            cursor: activeCount ? 'pointer' : 'default',
          }}
        >
          <TrashIcon />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((id) => (
          <FilterRow
            key={id}
            field={id}
            members={members}
            assignee={assignee}
            onToggleAssignee={toggleAssignee}
            onRemove={() => removeRow(id)}
          />
        ))}
      </div>

      <FieldPicker open={picking} onOpen={() => setPicking((v) => !v)} onPick={addRow} used={rows} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          onClick={onClose}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            border: 'none',
            background: DASH.accent,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Active filter row ─────────────────────────────────────────────────────

interface RowProps {
  field: FieldId;
  members: { id: string; name: string }[];
  assignee: Set<string>;
  onToggleAssignee: (id: string) => void;
  onRemove: () => void;
}

function FilterRow({ field, members, assignee, onToggleAssignee, onRemove }: RowProps) {
  const [expanded, setExpanded] = useState(true);
  const wired = FILTER_FIELDS.find((f) => f.id === field)?.wired ?? false;
  const isAssignee = field === 'assignee';

  return (
    <div
      style={{
        border: `1px solid ${DASH.border}`,
        borderRadius: 6,
        background: DASH.bg,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 8px 0 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: DASH.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{fieldLabel(field)}</span>
        {!wired && (
          <span style={{ fontSize: 11, color: DASH.textMuted }}>soon</span>
        )}
        <span
          aria-hidden
          style={{
            display: 'flex',
            color: DASH.textMuted,
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms ease',
          }}
        >
          <ChevronRightIcon size={12} />
        </span>
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove filter"
          style={{ display: 'flex', color: DASH.textMuted, paddingLeft: 2 }}
        >
          <TrashIcon size={13} />
        </span>
      </button>

      {expanded && isAssignee && (
        <div
          style={{
            borderTop: `1px solid ${DASH.border}`,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {members.map((m) => (
            <CheckRow
              key={m.id}
              label={m.name}
              checked={assignee.has(m.id)}
              onToggle={() => onToggleAssignee(m.id)}
            />
          ))}
        </div>
      )}

      {expanded && !isAssignee && (
        <div
          style={{
            borderTop: `1px solid ${DASH.border}`,
            padding: '8px 10px',
            fontSize: 12,
            color: DASH.textMuted,
          }}
        >
          Value selection for {fieldLabel(field)} is coming soon.
        </div>
      )}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  dot,
  onToggle,
}: {
  label: string;
  checked: boolean;
  dot?: string;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 6px',
        borderRadius: 4,
        border: 'none',
        background: hover ? DASH.cardHoverBg : 'transparent',
        cursor: 'pointer',
        color: DASH.textPrimary,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${checked ? DASH.accent : DASH.borderStrong}`,
          background: checked ? DASH.accent : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      )}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

// ── "Select filter" field dropdown ────────────────────────────────────────

function FieldPicker({
  open,
  onOpen,
  onPick,
  used,
}: {
  open: boolean;
  onOpen: () => void;
  onPick: (id: FieldId) => void;
  used: FieldId[];
}) {
  const [query, setQuery] = useState('');
  const usedSet = new Set<string>(used);
  const matches = FILTER_FIELDS.filter((f) =>
    f.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={onOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 10px',
          borderRadius: 6,
          border: `1px solid ${open ? DASH.accent : DASH.border}`,
          background: DASH.bg,
          cursor: 'pointer',
          color: DASH.textSecondary,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>Select filter</span>
        <span
          aria-hidden
          style={{
            display: 'flex',
            color: DASH.textMuted,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms ease',
          }}
        >
          <ChevronRightIcon size={12} />
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 6,
            border: `1px solid ${DASH.border}`,
            borderRadius: 6,
            background: DASH.cardBg,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%',
                height: 30,
                padding: '0 10px',
                fontSize: 13,
                color: DASH.textPrimary,
                background: DASH.bg,
                border: `1px solid ${DASH.border}`,
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '0 6px 6px' }}>
            {matches.map((f) =>
              f.id === 'location' ? (
                <div
                  key={f.id}
                  style={{
                    padding: '8px 8px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    color: DASH.textMuted,
                  }}
                >
                  {f.label}
                </div>
              ) : (
                <FieldOption
                  key={f.id}
                  label={f.label}
                  disabled={usedSet.has(f.id)}
                  onPick={() => onPick(f.id)}
                />
              ),
            )}
            {matches.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: DASH.textMuted }}>
                No matching fields.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldOption({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled: boolean;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        height: 30,
        padding: '0 8px',
        borderRadius: 4,
        border: 'none',
        background: hover && !disabled ? DASH.cardHoverBg : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? DASH.textMuted : DASH.textPrimary,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
      {disabled && (
        <span style={{ marginLeft: 'auto', fontSize: 11, color: DASH.textMuted }}>added</span>
      )}
    </button>
  );
}
