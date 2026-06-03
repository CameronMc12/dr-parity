'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { SortDir, SortField } from '@/store/workspace/view-config.types';
import { CheckMark, MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';

/** Sort By field list — mirrors ClickUp's board/list Sort popover order. */
const SORT_FIELDS: { key: NonNullable<SortField>; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'name', label: 'Task Name' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dateCreated', label: 'Date created' },
  { key: 'dateUpdated', label: 'Date updated' },
  { key: 'dateClosed', label: 'Date closed' },
  { key: 'timeTracked', label: 'Time tracked' },
  { key: 'timeEstimate', label: 'Time estimate' },
];

const DIR_LABEL: Record<SortDir, string> = { asc: 'Ascending', desc: 'Descending' };

/**
 * "Sort By" popover. Picking a field sets the active sort field; the chosen field
 * shows a direction toggle (Asc/Desc). "None" clears sorting. Wires setSortField
 * + setSortDir; the List view re-orders every group's rows from the persisted
 * field via columnSortFromConfig.
 */
export function SortMenu({
  listId,
  sortField,
  sortDir,
  trigger,
}: {
  listId: string;
  sortField: SortField;
  sortDir: SortDir;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const setSortField = useWorkspaceStore((s) => s.setSortField);
  const setSortDir = useWorkspaceStore((s) => s.setSortDir);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => SORT_FIELDS.filter((f) => f.label.toLowerCase().includes(q)),
    [q],
  );

  return (
    <Menu width={250} align="right" trigger={trigger}>
      <SectionLabel>Sort By</SectionLabel>
      <MenuSearch value={query} onChange={setQuery} placeholder="Search..." />

      {matches.map((f) => {
        const active = sortField === f.key;
        return (
          <PickerRow
            key={f.key}
            onClick={() => setSortField(listId, active ? null : f.key)}
            active={active}
            trailing={
              active ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortDir(listId, sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: LV.accent,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  {DIR_LABEL[sortDir]}
                </button>
              ) : undefined
            }
          >
            <span style={{ fontSize: 13, color: LV.textPrimary }}>{f.label}</span>
            {active && (
              <span style={{ marginLeft: 4, display: 'inline-flex' }}>
                <CheckMark />
              </span>
            )}
          </PickerRow>
        );
      })}

      {sortField !== null && (
        <>
          <MenuDivider />
          <PickerRow onClick={() => setSortField(listId, null)}>
            <span style={{ fontSize: 13, color: LV.textSecondary }}>Clear sort</span>
          </PickerRow>
        </>
      )}
    </Menu>
  );
}
