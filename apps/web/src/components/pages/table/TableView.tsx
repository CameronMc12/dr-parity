'use client';

/**
 * Table view ("tbl"). A dense spreadsheet of tasks: status-grouped, sortable +
 * resizable column headers, visible gridlines, multi-select checkbox column, a
 * row-number column, inline cell editing (built-in cells reuse the List editors,
 * custom `cf:*` cells reuse the shared CustomFieldCell), hover row actions,
 * right-click context menu, per-group inline "+ Add Task", and an "Add a Column"
 * trailing "+" that opens the shared FieldsPanel.
 *
 * Shell chrome (breadcrumb + tab strip) is supplied by `ViewShell`; this file
 * fills the body and renders the shared `ViewToolbar` as its first row. All data
 * flows through the scope hooks in `@/lib/view-scope` — the SAME task objects the
 * List view uses. A `{ kind: 'list' }` scope is byte-identical to the old
 * single-list path; `space`/`folder` scopes aggregate every task across the
 * scope's lists.
 *
 * Route: /<wsId>/v/tbl/:viewId  ->  <TableView scope={{ kind: 'list', listId }} />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { FieldsPanel } from '@/components/fields';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useMembers } from '@/store/workspace/hooks';
import { columnIdForCustomField } from '@/store/workspace/view-config.types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import {
  scopeKey,
  useScopeConfig,
  useScopeCustomFields,
  useScopeDefaultListId,
  useScopeStatuses,
  useScopeTasks,
  type ViewScope,
} from '@/lib/view-scope';
import { buildGroups, type ListGroup } from '@/components/pages/listview/grouping';
import type { Task } from '@/store/workspace/types';
import { TableGroup } from './TableGroup';
import { TableHeaderRow } from './TableHeaderRow';
import { CreateRow } from './CreateRow';
import { ColumnHeaderMenu, type ColumnMenuPos } from './ColumnHeaderMenu';
import { buildTableGrid, type SortDir, type SortState } from './table-columns';
import { MIN_COL_WIDTH, MAX_COL_WIDTH, MAX_COL_WIDTH as FIT_MAX, TBL } from './tokens';

function matchesQuery(task: Task, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    task.name.toLowerCase().includes(needle) ||
    task.status.toLowerCase().includes(needle) ||
    task.assignees.some((a) => a.name.toLowerCase().includes(needle))
  );
}

/** Live column-resize drag. Returns the current widths + a starter callback. */
function useColumnResize(
  initialWidths: () => Record<string, number>,
  gridRef: React.RefObject<HTMLDivElement | null>,
) {
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths);
  const drag = useRef<{ col: TableColumnId; startX: number; startW: number } | null>(null);

  const measure = useCallback(
    (col: TableColumnId): number => {
      const el = gridRef.current?.querySelector<HTMLElement>(`[data-testid="tbl-header-${col}"]`);
      return el ? Math.round(el.getBoundingClientRect().width) : MIN_COL_WIDTH;
    },
    [gridRef],
  );

  const onResizeStart = useCallback(
    (col: TableColumnId, clientX: number) => {
      drag.current = { col, startX: clientX, startW: widths[col] ?? measure(col) };
      // Lock cursor + disable text selection for a clean drag.
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [widths, measure],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const next = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, d.startW + (e.clientX - d.startX)));
      setWidths((prev) => ({ ...prev, [d.col]: next }));
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Imperative width set (used by "Fit to content"), clamped to the drag bounds.
  const setColumnWidth = useCallback((col: TableColumnId, px: number) => {
    const next = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(px)));
    setWidths((prev) => ({ ...prev, [col]: next }));
  }, []);

  return { widths, onResizeStart, setColumnWidth };
}

function TableBody({ scope }: { scope: ViewScope }) {
  // Config + persistence key for this scope. For a single-list scope this is the
  // raw listId (byte-identical to the old path); a space/folder gets its own
  // namespaced key so its toolbar/columns/collapse/sort persist without
  // colliding with any list.
  const configKey = scopeKey(scope);
  // Concrete target list for actions that need a real list (createTask, new
  // custom field, custom-field header/delete). For a list scope this === listId.
  const targetListId = useScopeDefaultListId(scope);

  const tasks = useScopeTasks(scope);
  const config = useScopeConfig(scope);
  const statusDefs = useScopeStatuses(scope);
  const members = useMembers();
  const fields = useScopeCustomFields(scope);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const setGroupCollapsed = useWorkspaceStore((s) => s.setGroupCollapsed);
  const toggleColumn = useWorkspaceStore((s) => s.toggleColumn);
  const getCustomFieldValue = useWorkspaceStore((s) => s.getCustomFieldValue);

  // useShallow: selectedTaskIds is a fresh array on every (de)select. Without a
  // shallow compare, TableBody (and every TableGroup) re-renders on any
  // selection change even where nothing changed.
  const selectedIds = useUiStore(useShallow((s) => s.selectedTaskIds));
  const setTasksSelected = useUiStore((s) => s.setTasksSelected);

  const { onContextMenu, menu } = useTaskContextMenu();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [fieldsAnchor, setFieldsAnchor] = useState<{ x: number; y: number } | null>(null);

  // Local-only column state driven by the header menu (no backing store model):
  //  - pinned : columns forced to the front of the display order.
  //  - moved  : per-column ordering hint ('start' | 'end') applied after pins.
  //  - colMenu: the open column-header popover (cursor-anchored).
  const [pinned, setPinned] = useState<Set<TableColumnId>>(() => new Set());
  const [moved, setMoved] = useState<Record<string, 'start' | 'end'>>({});
  const [colMenu, setColMenu] = useState<{ col: TableColumnId; pos: ColumnMenuPos } | null>(null);

  const { widths, onResizeStart, setColumnWidth } = useColumnResize(() => ({}), scrollRef);

  // Built-in AND custom `cf:*` columns both render. ClickUp's Table presents
  // built-in columns in a canonical order (Assignee, Status, Due date, Priority)
  // regardless of the shared config's storage order, then any extra toggled-on
  // columns follow. We only reorder for display — we never mutate the store.
  const visibleColumns = useMemo<TableColumnId[]>(() => {
    // ClickUp's Table default has no inline Comments column (that's a List-view
    // default). Drop it from the Table presentation; everything else honours the
    // user's visibility toggles.
    const cfg: TableColumnId[] = (config.visibleColumns as TableColumnId[]).filter(
      (c) => c !== 'comments',
    );
    const lead: TableColumnId[] = ['assignee', 'status', 'dueDate', 'priority'];
    const ordered = lead.filter((c) => cfg.includes(c));
    const rest = cfg.filter((c) => !lead.includes(c));
    return [...ordered, ...rest];
  }, [config.visibleColumns]);

  // Apply the local pin + move overrides on top of the canonical order. Pinned
  // columns come first; then any 'start'-moved, the natural middle, and finally
  // 'end'-moved. Display-only — the store column order is never mutated.
  const displayColumns = useMemo<TableColumnId[]>(() => {
    const base = visibleColumns;
    const pin = base.filter((c) => pinned.has(c));
    const rest = base.filter((c) => !pinned.has(c));
    const starts = rest.filter((c) => moved[c] === 'start');
    const ends = rest.filter((c) => moved[c] === 'end');
    const mids = rest.filter((c) => moved[c] === undefined);
    return [...pin, ...starts, ...mids, ...ends];
  }, [visibleColumns, pinned, moved]);

  const gridTemplate = useMemo(
    () => buildTableGrid(displayColumns, widths),
    [displayColumns, widths],
  );

  const filteredTasks = useMemo(
    () => (query ? tasks.filter((t) => matchesQuery(t, query)) : tasks),
    [tasks, query],
  );

  const groups = useMemo(
    () => buildGroups(filteredTasks, config, members, statusDefs),
    [filteredTasks, config, members, statusDefs],
  );

  const collapsedSet = useMemo(() => new Set(config.collapsedGroups), [config.collapsedGroups]);

  // Ungrouped (`Group: None`) → a single flat grid with no per-group bands. The
  // band only appears for status / priority / assignee grouping.
  const grouped = config.groupBy !== 'none';

  // Select-all spans every visible task across all groups (the header checkbox
  // is shared by the whole grid, exactly like ClickUp's Table).
  const allIds = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks]);
  const selectedCount = useMemo(
    () => allIds.reduce((n, id) => (selectedIds.includes(id) ? n + 1 : n), 0),
    [allIds, selectedIds],
  );
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;

  const customValueFor = useCallback(
    (taskId: string, fieldId: string) => getCustomFieldValue(taskId, fieldId),
    [getCustomFieldValue],
  );

  // Click a header → cycle that column asc → desc → off.
  const onSort = useCallback((col: TableColumnId) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return null;
    });
  }, []);

  // Menu "Sort" submenu → set an explicit direction on that column. Also mirror
  // the view-config store's sortDir so other surfaces stay in sync.
  const setSortDir = useWorkspaceStore((s) => s.setSortDir);
  const onSortDir = useCallback(
    (col: TableColumnId, dir: SortDir) => {
      setSort({ col, dir });
      setSortDir(configKey, dir);
    },
    [configKey, setSortDir],
  );

  // "Fit to content" → size the column to its widest visible cell (header label
  // included), measured from the live grid via the `data-tbl-col` attribute.
  const onFitColumn = useCallback(
    (col: TableColumnId) => {
      const root = scrollRef.current;
      if (!root) return;
      let max = 0;
      const cells = root.querySelectorAll<HTMLElement>(`[data-tbl-col="${col}"]`);
      cells.forEach((el) => {
        const child = el.firstElementChild as HTMLElement | null;
        max = Math.max(max, (child ?? el).scrollWidth);
      });
      const header = root.querySelector<HTMLElement>(`[data-testid="tbl-header-${col}"]`);
      if (header) max = Math.max(max, header.scrollWidth);
      const padded = Math.min(FIT_MAX, max + 28);
      if (padded > 0) setColumnWidth(col, padded);
    },
    [setColumnWidth],
  );

  const onTogglePin = useCallback((col: TableColumnId) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const onMoveColumn = useCallback((col: TableColumnId, edge: 'start' | 'end') => {
    setMoved((prev) => ({ ...prev, [col]: edge }));
  }, []);

  // "Insert left/right" → open the FieldsPanel anchored at the header to add a
  // new custom column (the closest backing action — there is no column-position
  // model, so a created column lands per the canonical order).
  const onInsertColumn = useCallback(
    (_col: TableColumnId, _side: 'left' | 'right', anchor: ColumnMenuPos) => {
      setFieldsAnchor(anchor);
    },
    [],
  );

  const quickAdd = useCallback(
    (name: string, group: ListGroup) => {
      if (!targetListId) return;
      const sample = group.tasks[0];
      if (config.groupBy === 'priority') {
        const key = group.key.split(':')[1] ?? 'none';
        createTask({ name, listId: targetListId, priority: key === 'none' ? null : key });
      } else if (config.groupBy === 'status') {
        // Empty status bands keep their identity via the group itself.
        createTask({
          name,
          listId: targetListId,
          status: sample?.status ?? group.label,
          statusColor: sample?.statusColor ?? group.color,
          ...(sample?.statusType ?? group.statusType
            ? { statusType: sample?.statusType ?? group.statusType }
            : {}),
        });
      } else {
        createTask({ name, listId: targetListId });
      }
    },
    [targetListId, config.groupBy, createTask],
  );

  // Bottom create-row: a plain task on the scope's target list (no group
  // context). ClickUp's create row defaults to the list's first status, which
  // `createTask` already applies when status is omitted.
  const createBottom = useCallback(
    (name: string) => {
      if (targetListId) createTask({ name, listId: targetListId });
    },
    [targetListId, createTask],
  );

  const onColumnCreated = useCallback(
    (field: CustomFieldDef) => {
      const col = columnIdForCustomField(field.id);
      // createCustomField doesn't auto-add the column; flip it on so it appears.
      // The column-visibility toggle is config and is keyed by the scope.
      if (!visibleColumns.includes(col)) toggleColumn(configKey, col);
    },
    [configKey, visibleColumns, toggleColumn],
  );

  const controls = useMemo<Parameters<typeof ViewToolbar>[0]['controls']>(
    () => ['group', 'subtasks', 'columns', 'sort', 'filter', 'closed', 'assignee', 'search', 'customize', 'addTask'],
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: TBL.appBg }}>
      <ViewToolbar
        listId={configKey}
        controls={controls}
        searchValue={query}
        onSearchChange={setQuery}
      />

      <div ref={scrollRef} data-testid="tbl-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 48 }}>
        {/* Single sticky column header for the whole grid (not per group). */}
        <TableHeaderRow
          visibleColumns={displayColumns}
          fields={fields}
          listId={targetListId}
          gridTemplate={gridTemplate}
          sort={sort}
          onSort={onSort}
          onResizeStart={onResizeStart}
          allSelected={allSelected}
          someSelected={selectedCount > 0}
          onToggleAll={() => setTasksSelected(allIds, !allSelected)}
          onAddColumn={setFieldsAnchor}
          onHeaderMenu={(col, anchor) => setColMenu({ col, pos: anchor })}
        />

        <div style={{ borderLeft: `1px solid ${TBL.gridline}`, borderRight: `1px solid ${TBL.gridline}` }}>
          {groups.length === 0 ? (
            <div style={{ padding: '32px 24px', color: TBL.textMuted, fontSize: 13 }}>
              No tasks match the current filters.
            </div>
          ) : (
            (() => {
              let cursor = 1;
              return groups.map((group) => {
                const start = cursor;
                cursor += group.tasks.length;
                return (
                  <TableGroup
                    key={group.key}
                    group={group}
                    listTasks={tasks}
                    visibleColumns={displayColumns}
                    fields={fields}
                    gridTemplate={gridTemplate}
                    sort={sort}
                    customValueFor={customValueFor}
                    collapsed={collapsedSet.has(group.key)}
                    onToggleCollapse={() => setGroupCollapsed(configKey, group.key, !collapsedSet.has(group.key))}
                    onQuickAdd={quickAdd}
                    onContextMenu={onContextMenu}
                    showBand={grouped}
                    startNumber={start}
                  />
                );
              });
            })()
          )}

          {/* Bottom full-width create row (ClickUp's last grid row). */}
          <CreateRow onAdd={createBottom} />
        </div>
      </div>

      {fieldsAnchor && (
        <FieldsPanel
          listId={targetListId}
          anchor={fieldsAnchor}
          onCreated={onColumnCreated}
          onClose={() => setFieldsAnchor(null)}
        />
      )}

      {colMenu && (
        <ColumnHeaderMenu
          col={colMenu.col}
          listId={configKey}
          pos={colMenu.pos}
          activeDir={sort?.col === colMenu.col ? sort.dir : null}
          pinned={pinned.has(colMenu.col)}
          onClose={() => setColMenu(null)}
          onSort={onSortDir}
          onInsert={onInsertColumn}
          onFit={onFitColumn}
          onTogglePin={onTogglePin}
          onMove={onMoveColumn}
        />
      )}

      {menu}
    </div>
  );
}

export function TableView({ scope }: { scope: ViewScope }) {
  // ViewShell drives breadcrumb + tab strip from a list. For a list scope that's
  // the list itself; for a space/folder we anchor the shell on the scope's first
  // list so the tab strip + breadcrumb stay valid. The body derives everything
  // else from `scope`.
  const shellListId = useScopeDefaultListId(scope);
  return (
    <ViewShell code="tbl" viewId={shellListId} scope={scope}>
      <TableBody scope={scope} />
    </ViewShell>
  );
}
