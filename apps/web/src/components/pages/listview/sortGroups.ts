/**
 * Local column sort for the List view. ClickUp lets you click a column header to
 * sort tasks within each group (asc → desc → off). This is a pure post-pass over
 * the grouped output; it never mutates the store, so manual DnD order is restored
 * the moment the sort is cleared.
 */

import { statusOrder } from '@/data/status-order';
import type { Task } from '@/store/workspace/types';
import type { ColumnId, SortDir as ConfigSortDir, SortField, ViewConfig } from '@/store/workspace/view-config.types';
import type { ListGroup } from './grouping';
import { PRIORITY_OPTIONS } from './statuses';

export type SortDir = 'asc' | 'desc';

export interface ColumnSort {
  col: ColumnId;
  dir: SortDir;
}

/**
 * Map a toolbar Sort field to the column comparator key. Fields without a backing
 * Task value (dateClosed / timeTracked) fall back to a stable comparable column so
 * the option still sorts something rather than being a dead no-op.
 */
const SORT_FIELD_TO_COL: Record<NonNullable<SortField>, ColumnId> = {
  status: 'status',
  name: 'name',
  assignee: 'assignee',
  priority: 'priority',
  dueDate: 'dueDate',
  startDate: 'startDate',
  dateCreated: 'dateCreated',
  dateUpdated: 'dateCreated',
  dateClosed: 'dateCreated',
  timeTracked: 'timeEstimate',
  timeEstimate: 'timeEstimate',
};

/** Build a ColumnSort from the persisted toolbar Sort field + direction. */
export function columnSortFromConfig(config: ViewConfig): ColumnSort | null {
  if (!config.sortField) return null;
  const col = SORT_FIELD_TO_COL[config.sortField];
  const dir: ConfigSortDir = config.sortDir;
  return { col, dir };
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function priorityRank(p: string | null): number {
  if (!p) return 99;
  return PRIORITY_RANK[p] ?? 50;
}

function compareBy(col: ColumnId, a: Task, b: Task): number {
  switch (col) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'assignee': {
      const an = a.assignees[0]?.name ?? '';
      const bn = b.assignees[0]?.name ?? '';
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return an.localeCompare(bn);
    }
    case 'dueDate':
    case 'startDate':
    case 'dateCreated': {
      const av = (col === 'dueDate' ? a.dueDate : col === 'startDate' ? a.startDate : a.dateCreated) ?? Infinity;
      const bv = (col === 'dueDate' ? b.dueDate : col === 'startDate' ? b.startDate : b.dateCreated) ?? Infinity;
      return av - bv;
    }
    case 'priority':
      return priorityRank(a.priority) - priorityRank(b.priority);
    case 'status':
      return statusOrder(b.status) - statusOrder(a.status) || a.status.localeCompare(b.status);
    case 'comments':
      return (a.comments?.length ?? 0) - (b.comments?.length ?? 0);
    case 'timeEstimate':
      return (a.timeEstimate ?? 0) - (b.timeEstimate ?? 0);
    default:
      return 0;
  }
}

void PRIORITY_OPTIONS;

/** Return a new groups array with each group's tasks re-sorted by the column. */
export function sortGroups(groups: ListGroup[], sort: ColumnSort | null): ListGroup[] {
  if (!sort) return groups;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return groups.map((g) => ({
    ...g,
    tasks: [...g.tasks].sort((a, b) => sign * compareBy(sort.col, a, b)),
  }));
}

/** Cycle a header click: unsorted → asc → desc → unsorted. */
export function nextColumnSort(current: ColumnSort | null, col: ColumnId): ColumnSort | null {
  if (!current || current.col !== col) return { col, dir: 'asc' };
  if (current.dir === 'asc') return { col, dir: 'desc' };
  return null;
}
