/**
 * Pure helpers for the calendar right-hand task sidebar. Splits the view's
 * tasks into the two ClickUp sidebar buckets: Unscheduled (no dueDate) and
 * Overdue (dueDate before "today", still open). Sorting mirrors the visible
 * "Sort by <field>" control.
 */

import { ANCHOR_NOW, startOfDay, type Task } from '@/lib/view-data';

export type SidebarTab = 'unscheduled' | 'overdue';
export type SidebarSortField = 'name' | 'priority' | 'dueDate';
export type SortDir = 'asc' | 'desc';

const TODAY_START = startOfDay(ANCHOR_NOW);

function isOpen(task: Task): boolean {
  return task.statusType !== 'closed' && task.statusType !== 'done';
}

/** Tasks with no due date — the primary "drag onto a day" pool. */
export function unscheduledTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.dueDate == null && isOpen(t));
}

/** Open tasks whose due date is strictly before today. */
export function overdueTasks(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => t.dueDate != null && startOfDay(t.dueDate) < TODAY_START && isOpen(t),
  );
}

function priorityRank(task: Task): number {
  switch (task.priority) {
    case 'urgent':
      return 0;
    case 'high':
      return 1;
    case 'normal':
      return 2;
    case 'low':
      return 3;
    default:
      return 4;
  }
}

/** Stable sort by the active field/direction, falling back to task order. */
export function sortSidebarTasks(
  tasks: Task[],
  field: SidebarSortField,
  dir: SortDir,
): Task[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (field === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (field === 'priority') {
      cmp = priorityRank(a) - priorityRank(b);
    } else {
      cmp = (a.dueDate ?? Number.POSITIVE_INFINITY) - (b.dueDate ?? Number.POSITIVE_INFINITY);
    }
    if (cmp !== 0) return cmp * factor;
    return a.order - b.order;
  });
}

export const SORT_FIELD_LABELS: Record<SidebarSortField, string> = {
  name: 'name',
  priority: 'priority',
  dueDate: 'due date',
};
