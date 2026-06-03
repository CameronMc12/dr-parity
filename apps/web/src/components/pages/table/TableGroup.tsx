'use client';

/**
 * One group section of the Table body. The column header is rendered ONCE by
 * `TableView` (sticky at the top of the whole grid, exactly like ClickUp) — this
 * component renders only the group's rows. When the view is grouped (status /
 * priority / assignee) a thin group band sits above the rows with the status
 * badge, count, collapse chevron, and a hover "+" that adds a task into this
 * group. When the view is ungrouped (`Group: None`) the band is omitted and the
 * rows render flat under the shared header.
 */

import { useMemo, useState } from 'react';
import type { ListGroup } from '@/components/pages/listview/grouping';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import { Chevron, PlusCircle } from '@/components/pages/list-view-icons';
import { TableTaskRow } from './TableTaskRow';
import { sortTasks, type SortState } from './table-columns';
import { TBL } from './tokens';

function GroupBadge({ label, color, dashed }: { label: string; color: string; dashed: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingLeft: 8,
        paddingRight: 11,
        background: TBL.pillBg,
        borderRadius: 4,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: dashed ? 'transparent' : color,
          border: dashed ? `1.5px dashed ${color}` : 'none',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: TBL.textSecondary,
        }}
      >
        {label}
      </span>
    </span>
  );
}

export function TableGroup({
  group,
  listTasks,
  visibleColumns,
  fields,
  gridTemplate,
  sort,
  customValueFor,
  collapsed,
  onToggleCollapse,
  onQuickAdd,
  onContextMenu,
  showBand,
  startNumber,
}: {
  group: ListGroup;
  listTasks: Task[];
  visibleColumns: TableColumnId[];
  fields: CustomFieldDef[];
  gridTemplate: string;
  sort: SortState | null;
  customValueFor: (taskId: string, fieldId: string) => unknown;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQuickAdd: (name: string, group: ListGroup) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  /** When false (ungrouped `Group: None`) the group band is omitted. */
  showBand: boolean;
  /** Row index of this group's first row across the whole grid (1-based). */
  startNumber: number;
}) {
  const [bandHover, setBandHover] = useState(false);
  const open = !collapsed;

  const rows = useMemo(
    () => sortTasks(group.tasks, sort, customValueFor),
    [group.tasks, sort, customValueFor],
  );

  return (
    <section data-testid="tbl-status-group" data-status={group.label}>
      {showBand && (
        <div
          data-testid="tbl-group-header"
          onMouseEnter={() => setBandHover(true)}
          onMouseLeave={() => setBandHover(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, paddingLeft: 14, paddingRight: 16 }}
        >
          <button
            aria-label={open ? 'Collapse group' : 'Expand group'}
            data-testid="tbl-group-collapse"
            onClick={onToggleCollapse}
            style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: TBL.textMuted,
              padding: 0,
              flexShrink: 0,
            }}
          >
            <Chevron open={open} />
          </button>
          <GroupBadge label={group.label} color={group.color} dashed={group.dashed} />
          <span style={{ fontSize: 12, color: TBL.textMuted }}>{group.tasks.length}</span>
          <span style={{ flex: 1 }} />
          <button
            aria-label="Add task to group"
            data-testid="tbl-group-add"
            onClick={() => onQuickAdd('New Task', group)}
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: bandHover ? TBL.textPrimary : TBL.textSecondary,
              padding: 0,
              flexShrink: 0,
            }}
          >
            <PlusCircle size={18} />
          </button>
        </div>
      )}

      {open &&
        rows.map((task, i) => (
          <TableTaskRow
            key={task.id}
            task={task}
            listTasks={listTasks}
            visibleColumns={visibleColumns}
            fields={fields}
            gridTemplate={gridTemplate}
            depth={0}
            rowNumber={startNumber + i}
            zebra={(startNumber + i) % 2 === 0}
            onContextMenu={onContextMenu}
          />
        ))}
    </section>
  );
}
