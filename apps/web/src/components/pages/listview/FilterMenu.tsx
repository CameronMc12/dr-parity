'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { FilterState, ViewConfig } from '@/store/workspace/view-config.types';
import type { Task } from '@/store/workspace/types';
import { listStatusOptions, PRIORITY_OPTIONS } from './statuses';
import { CheckMark, Dot, MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { FlagIcon } from '../list-view-icons';
import { LV } from './tokens';

/** Full ClickUp "Select filter" field list (in capture order). */
const FIELD_LABELS = [
  'Status',
  'Tags',
  'Due date',
  'Priority',
  'Assignee',
  'Archived',
  'Assigned comment',
  'Created by',
  'Date closed',
  'Date created',
  'Date updated',
  'Date done',
  'Dependency',
  'Duration',
  'Location/List',
  'Recurring',
  'Start date',
  'Status is closed',
] as const;

type Field = keyof FilterState | null;

/** Field-glyph stand-in (uppercased monogram) for non-wired filter fields. */
function FieldGlyph({ label }: { label: string }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: LV.textMuted,
        flexShrink: 0,
      }}
    >
      {label[0]}
    </span>
  );
}

/**
 * Filter popover (the "Select filter ▾" dropdown of the Filters bar). The root
 * lists every filterable field with a search box (visual parity); Status /
 * Priority / Assignee drill into a functional checklist that filters the rendered
 * rows. A "Saved filters" affordance + trash/clear mirror the real bar.
 */
export function FilterMenu({
  listId,
  listTasks,
  config,
  initialField = null,
  trigger,
}: {
  listId: string;
  listTasks: Task[];
  config: ViewConfig;
  /** Opens the popover focused on a specific field (e.g. the Assignee button). */
  initialField?: Field;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const toggleFilterValue = useWorkspaceStore((s) => s.toggleFilterValue);
  const clearFilters = useWorkspaceStore((s) => s.clearFilters);
  const members = useWorkspaceStore((s) => s.members);
  const [field, setField] = useState<Field>(initialField);
  const [query, setQuery] = useState('');

  const statusOptions = useMemo(() => listStatusOptions(listTasks), [listTasks]);
  const q = query.trim().toLowerCase();
  const fields = useMemo(
    () => FIELD_LABELS.filter((l) => l.toLowerCase().includes(q)),
    [q],
  );

  const activeCount =
    config.filters.status.length + config.filters.priority.length + config.filters.assignee.length;

  return (
    <Menu width={260} align="left" trigger={trigger}>
      {field === null ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px 0',
            }}
          >
            <SectionLabel>Filters{activeCount > 0 ? ` · ${activeCount}` : ''}</SectionLabel>
            <button
              aria-label="Clear all filters"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters(listId);
              }}
              style={{ background: 'transparent', border: 'none', color: LV.textMuted, cursor: 'pointer', padding: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <MenuSearch value={query} onChange={setQuery} placeholder="Search..." />

          {fields.map((label) => {
            const isFunctional = label === 'Status' || label === 'Priority' || label === 'Assignee';
            return (
              <PickerRow
                key={label}
                onClick={() => {
                  if (label === 'Status') setField('status');
                  else if (label === 'Priority') setField('priority');
                  else if (label === 'Assignee') setField('assignee');
                }}
                trailing={isFunctional ? <span style={{ color: LV.textMuted, fontSize: 13 }}>›</span> : undefined}
              >
                <FieldGlyph label={label} />
                <span style={{ fontSize: 13, color: isFunctional ? LV.textPrimary : LV.textMuted }}>{label}</span>
              </PickerRow>
            );
          })}

          <MenuDivider />
          <PickerRow onClick={() => undefined}>
            <span style={{ fontSize: 13, color: LV.textSecondary }}>Saved filters</span>
            <span style={{ marginLeft: 'auto', color: LV.textMuted, fontSize: 13 }}>›</span>
          </PickerRow>
        </>
      ) : (
        <>
          <PickerRow onClick={() => setField(null)}>
            <span style={{ fontSize: 13, color: LV.textMuted }}>‹ Back</span>
          </PickerRow>
          <MenuDivider />
          <SectionLabel>{field}</SectionLabel>
          {field === 'status' &&
            statusOptions.map((o) => {
              const active = config.filters.status.includes(o.status);
              return (
                <PickerRow
                  key={o.status}
                  onClick={() => toggleFilterValue(listId, 'status', o.status)}
                  active={active}
                  trailing={active ? <CheckMark /> : undefined}
                >
                  <Dot color={o.statusColor} />
                  <span style={{ fontSize: 13, color: LV.textPrimary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}>
                    {o.status}
                  </span>
                </PickerRow>
              );
            })}
          {field === 'priority' &&
            PRIORITY_OPTIONS.map((p) => {
              const active = config.filters.priority.includes(p.key);
              return (
                <PickerRow
                  key={p.key}
                  onClick={() => toggleFilterValue(listId, 'priority', p.key)}
                  active={active}
                  trailing={active ? <CheckMark /> : undefined}
                >
                  <FlagIcon color={p.color} />
                  <span style={{ fontSize: 13, color: LV.textPrimary }}>{p.label}</span>
                </PickerRow>
              );
            })}
          {field === 'assignee' &&
            members.map((m) => {
              const active = config.filters.assignee.includes(m.id);
              return (
                <PickerRow
                  key={m.id}
                  onClick={() => toggleFilterValue(listId, 'assignee', m.id)}
                  active={active}
                  trailing={active ? <CheckMark /> : undefined}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: m.color,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {m.initials}
                  </span>
                  <span style={{ fontSize: 13, color: LV.textPrimary }}>{m.name}</span>
                </PickerRow>
              );
            })}
        </>
      )}
    </Menu>
  );
}
