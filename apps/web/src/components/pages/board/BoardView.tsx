'use client';

/**
 * Board view (Kanban). One column per task status, grouped via the shared
 * status-grouping engine, plus any user-added empty status groups from the
 * board-local added-groups store. Cards are draggable between columns to change
 * status and reorderable within a column; clicking a card opens the shared
 * task-detail modal; right-clicking (or the hover kebab) opens the shared task
 * context menu.
 *
 * Header chrome (breadcrumb + view tabs) comes from the shared `<ViewShell>`;
 * the toolbar row is the shared `<ViewToolbar>` so every control is real. Only
 * the Kanban grid below is owned by this view.
 *
 * Route: /<wsId>/v/b/:viewId  ->  <BoardView scope=… />
 *
 * All task data flows through the shared `@/lib/view-scope` layer so the body
 * renders a single LIST (byte-identical to before) or an entire SPACE/FOLDER
 * (every status across every list in the scope, columns deduped by label). The
 * board-local stores (added groups, card size) are keyed by `scopeKey(scope)`
 * so a space/folder persists its own choices without colliding with any list —
 * for a single list `scopeKey` returns the raw listId, so the keys are unchanged.
 */

import { useMemo, useState } from 'react';
import type { StatusColumn } from '@/lib/view-data';
import {
  scopeKey,
  useScopeDefaultListId,
  useScopeStatusColumns,
  type ViewScope,
} from '@/lib/view-scope';
import { useWorkspaceStore } from '@/store/workspace';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar, type ViewToolbarControl } from '@/components/views/ViewToolbar';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { BoardColumn } from './BoardColumn';
import { BoardBulkBar } from './BoardBulkBar';
import { AddGroupColumn } from './AddGroupColumn';
import { CardSizeControl } from './CardSizeControl';
import { useBoardDnd } from './useBoardDnd';
import { useAddedGroups, type AddedGroup } from './added-groups';
import { useCardSize, useBoardCardSize } from './card-size';
import { BOARD } from './tokens';

const TOOLBAR_CONTROLS: ViewToolbarControl[] = [
  'group',
  'subtasks',
  'sort',
  'filter',
  'closed',
  'assignee',
  'search',
  'customize',
  'addTask',
];

/** Stable empty-array reference so the added-groups selector never returns fresh. */
const EMPTY_ADDED: AddedGroup[] = [];

/** Filter each column's cards by a case-insensitive name match. */
function filterColumns(columns: StatusColumn[], query: string): StatusColumn[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  return columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((t) => t.name.toLowerCase().includes(q)),
  }));
}

/**
 * Append user-added empty groups that don't yet collide with a real status
 * column (once a card lands on the status the derived column owns it).
 */
function mergeAddedGroups(columns: StatusColumn[], added: AddedGroup[]): StatusColumn[] {
  if (added.length === 0) return columns;
  const present = new Set(columns.map((c) => c.status.toLowerCase()));
  const extra = added
    .filter((g) => !present.has(g.status.toLowerCase()))
    .map<StatusColumn>((g) => ({
      key: g.key,
      status: g.status,
      color: g.color,
      statusType: g.statusType,
      dashed: false,
      tasks: [],
    }));
  return [...columns, ...extra];
}

/**
 * Resolve a column's status *type* (open / custom / done / closed) so the header
 * can draw the right status-indicator glyph. Derived status columns carry the
 * type from the scope's status SET; user-added empty groups carry it on the
 * added-group record; tasks supply it as a final fallback.
 */
function columnStatusType(col: StatusColumn, added: AddedGroup[]): string {
  return (
    col.statusType ||
    col.tasks[0]?.statusType ||
    added.find((g) => g.key === col.key)?.statusType ||
    ''
  );
}

export function BoardView({ scope }: { scope: ViewScope }) {
  const key = scopeKey(scope);
  const columns = useScopeStatusColumns(scope);
  const targetListId = useScopeDefaultListId(scope);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const added = useAddedGroups((s) => s.byList[key] ?? EMPTY_ADDED);
  const addGroup = useAddedGroups((s) => s.addGroup);
  const removeGroup = useAddedGroups((s) => s.removeGroup);
  const addedKeys = useMemo(() => new Set(added.map((g) => g.key)), [added]);

  const cardSize = useCardSize(key);
  const setCardSize = useBoardCardSize((s) => s.setCardSize);

  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allColumns = useMemo(() => mergeAddedGroups(columns, added), [columns, added]);
  const visibleColumns = useMemo(() => filterColumns(allColumns, q), [allColumns, q]);
  const dnd = useBoardDnd(visibleColumns);
  const { onContextMenu, menu } = useTaskContextMenu();

  const toggleCollapse = (col: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(visibleColumns.map((c) => c.key)));

  const addCard = (col: StatusColumn) => {
    if (!targetListId) return;
    const sample = col.tasks[0];
    const addedGroup = added.find((g) => g.key === col.key);
    createTask({
      name: 'New Task',
      listId: targetListId,
      status: col.status,
      statusColor: col.color,
      statusType: col.statusType || sample?.statusType || addedGroup?.statusType || 'custom',
    });
  };

  return (
    <ViewShell code="b" viewId={key} scope={scope}>
      <div
        data-testid="board-view"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: BOARD.bg,
          color: BOARD.textPrimary,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <ViewToolbar
          listId={key}
          viewId={key}
          controls={TOOLBAR_CONTROLS}
          searchValue={q}
          onSearchChange={setQ}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: `8px ${BOARD.columnPadX}px 0`,
            flexShrink: 0,
          }}
        >
          <CardSizeControl value={cardSize} onChange={(s) => setCardSize(key, s)} />
        </div>

        <div
          data-testid="board-lane"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'stretch',
            gap: BOARD.columnGap,
            padding: `12px ${BOARD.columnPadX}px 16px`,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          {visibleColumns.map((col) => (
            <BoardColumn
              key={col.key}
              column={col}
              statusType={columnStatusType(col, added)}
              cards={dnd.preview[col.key] ?? col.tasks}
              collapsed={collapsed.has(col.key)}
              cardSize={cardSize}
              dnd={dnd}
              onToggleCollapse={() => toggleCollapse(col.key)}
              onAddCard={() => addCard(col)}
              onCardContextMenu={onContextMenu}
              onCollapseAll={collapseAll}
              onDeleteGroup={addedKeys.has(col.key) ? () => removeGroup(key, col.key) : undefined}
            />
          ))}

          <AddGroupColumn onAdd={(name) => addGroup(key, name, '')} />
        </div>

        <BoardBulkBar columns={visibleColumns} />
      </div>
      {menu}
    </ViewShell>
  );
}
