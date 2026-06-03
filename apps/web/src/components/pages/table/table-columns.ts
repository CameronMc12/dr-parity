/**
 * Table-view column registry + sort engine. The grid is a lead checkbox cell, a
 * row-number column, a fixed `name` column, then the view's `visibleColumns`
 * (built-in `ColumnId`s and `cf:<fieldId>` custom columns), bookended by a
 * trailing "+ add column" header.
 *
 * Sorting here is the Table view's own click-to-sort (a column header toggles
 * asc/desc/none for that field) and is layered ON TOP of the shared grouping
 * engine's natural order — it only reorders rows WITHIN a group, never across.
 */

import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { ColumnId, TableColumnId } from '@/store/workspace/view-config.types';
import { customFieldIdFromColumn } from '@/store/workspace/view-config.types';
import { COLUMN_DEFS, isBuiltinColumn } from '@/components/pages/listview/columns';
import { NUM_WIDTH, NAME_WIDTH, COL_WIDTH, ADD_COL_WIDTH } from './tokens';

/** Resolve a field def for a `cf:*` column from the list's fields. */
export function fieldForColumn(
  col: TableColumnId,
  fields: CustomFieldDef[],
): CustomFieldDef | null {
  const id = customFieldIdFromColumn(col);
  if (!id) return null;
  return fields.find((f) => f.id === id) ?? null;
}

/** Header label for a column id (Name renders as "Name" not "Task Name"). */
export function columnLabel(col: TableColumnId, fields: CustomFieldDef[]): string {
  if (col === 'name') return 'Name';
  if (isBuiltinColumn(col)) return COLUMN_DEFS[col].label;
  return fieldForColumn(col, fields)?.name ?? 'Field';
}

/**
 * Natural track width for a Table column before any user resize. ClickUp's Table
 * uses fixed px tracks (Name 214, every other built-in 200) — NOT the List
 * view's flexible tracks — so the spreadsheet gridlines stay aligned.
 */
function defaultTrack(col: TableColumnId): string {
  if (col === 'name') return `${NAME_WIDTH}px`;
  return `${COL_WIDTH}px`;
}

/**
 * CSS grid template: `#` | name | …visible | add-column. The lead `#` track is a
 * single 40px column (row-number + select checkbox share it). `widths` overrides
 * any column the user has dragged to a fixed px width (keyed by id; `name`
 * included).
 */
export function buildTableGrid(
  visible: TableColumnId[],
  widths: Record<string, number>,
): string {
  const tracks = (['name', ...visible] as TableColumnId[])
    .map((id) => {
      const w = widths[id];
      return w != null ? `${w}px` : defaultTrack(id);
    })
    .join(' ');
  return `${NUM_WIDTH}px ${tracks} ${ADD_COL_WIDTH}px`;
}

/** Sortable built-in rank for priority keys. */
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export type SortDir = 'asc' | 'desc';
export interface SortState {
  col: TableColumnId;
  dir: SortDir;
}

/** Comparable scalar for a custom-field value (lower sorts first asc). */
function customSortKey(value: unknown): string | number {
  if (value == null) return '￿';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 0 : 1;
  if (Array.isArray(value)) return value.length === 0 ? '￿' : value.join(',').toLowerCase();
  return String(value).toLowerCase();
}

/** Comparable scalar for a task on a given built-in column. */
function builtinSortKey(task: Task, col: ColumnId): string | number {
  switch (col) {
    case 'name':
      return task.name.toLowerCase();
    case 'assignee':
      return task.assignees[0]?.name.toLowerCase() ?? '￿';
    case 'dueDate':
      return task.dueDate ?? Number.POSITIVE_INFINITY;
    case 'startDate':
      return task.startDate ?? Number.POSITIVE_INFINITY;
    case 'priority':
      return task.priority ? PRIORITY_RANK[task.priority] ?? 98 : 99;
    case 'status':
      return task.status.toLowerCase();
    case 'dateCreated':
      return task.dateCreated ?? Number.POSITIVE_INFINITY;
    case 'timeEstimate':
      return task.timeEstimate ?? Number.POSITIVE_INFINITY;
    case 'taskId':
      return task.id.toLowerCase();
    default:
      return task.name.toLowerCase();
  }
}

/**
 * Stable sort of a group's tasks by the active column. Pure — returns a copy.
 * Custom-field columns resolve each task's value through `customValueFor`.
 */
export function sortTasks(
  tasks: Task[],
  sort: SortState | null,
  customValueFor?: (taskId: string, fieldId: string) => unknown,
): Task[] {
  if (!sort) return tasks;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const fieldId = customFieldIdFromColumn(sort.col);
  const keyFor = (task: Task): string | number =>
    fieldId
      ? customSortKey(customValueFor?.(task.id, fieldId))
      : builtinSortKey(task, sort.col as ColumnId);
  return [...tasks].sort((a, b) => {
    const ka = keyFor(a);
    const kb = keyFor(b);
    if (ka < kb) return -1 * dir;
    if (ka > kb) return 1 * dir;
    return 0;
  });
}

export { ADD_COL_WIDTH };
