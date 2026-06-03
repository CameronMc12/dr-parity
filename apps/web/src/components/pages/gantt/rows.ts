/**
 * Flatten grouped tasks into the linear row sequence the Gantt renders. Group
 * headers, task rows, and trailing "+ Add Task" rows share one index space so
 * the left task table and the right timeline stay vertically aligned. Collapsed
 * groups hide their tasks (and the add row).
 */

import { deriveSpan, startOfDay, type ListGroup, type Task } from '@/lib/view-data';

export interface GroupHeaderRow {
  kind: 'group';
  key: string;
  label: string;
  color: string;
  dashed: boolean;
  count: number;
}

export interface TaskGanttRow {
  kind: 'task';
  key: string;
  task: Task;
  groupKey: string;
  /** Due-date-only task with no real span → render as a milestone diamond/dot. */
  milestone: boolean;
}

export interface AddTaskRow {
  kind: 'add';
  key: string;
  groupKey: string;
}

export type GanttRow = GroupHeaderRow | TaskGanttRow | AddTaskRow;

/** A task is a milestone when its resolved span collapses to a single day. */
function isMilestone(task: Task): boolean {
  const span = deriveSpan(task);
  return startOfDay(span.start) === startOfDay(span.end);
}

export function flattenRows(groups: ListGroup[], collapsed: Set<string>): GanttRow[] {
  const rows: GanttRow[] = [];
  for (const group of groups) {
    rows.push({
      kind: 'group',
      key: group.key,
      label: group.label,
      color: group.color,
      dashed: group.dashed,
      count: group.tasks.length,
    });
    if (collapsed.has(group.key)) continue;
    for (const task of group.tasks) {
      rows.push({
        kind: 'task',
        key: `t:${task.id}`,
        task,
        groupKey: group.key,
        milestone: isMilestone(task),
      });
    }
    rows.push({ kind: 'add', key: `add:${group.key}`, groupKey: group.key });
  }
  return rows;
}

/** Just the task rows, in render order (for the dependency-link geometry). */
export function taskRowsOnly(rows: GanttRow[]): TaskGanttRow[] {
  return rows.filter((r): r is TaskGanttRow => r.kind === 'task');
}
