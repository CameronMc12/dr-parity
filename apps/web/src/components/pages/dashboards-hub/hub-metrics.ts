'use client';

/**
 * Live metrics for the Dashboards hub, derived from the real workspace tasks
 * store. Pure functions take an already-filtered task list so the same numbers
 * drive both the gallery previews and the per-dashboard widget grid. "Now" is
 * anchored to ANCHOR_NOW (the frozen clock the rest of the clone uses) so
 * overdue / due-soon windows are deterministic.
 */

import { useMemo } from 'react';
import { useAllTasksFlat, useMembers } from '@/store/workspace/hooks';
import type { Member, Task } from '@/store/workspace/types';
import { ANCHOR_NOW, DAY_MS } from '@/lib/view-dates';
import {
  countByStatus,
  isComplete,
  tasksByAssignee,
  type StatusSlice,
  type AssigneeSlice,
} from '../dashboard/dashboard-data';

const DUE_SOON_WINDOW = 7 * DAY_MS;

export interface PrioritySlice {
  label: string;
  color: string;
  count: number;
}

export interface DueSoonItem {
  task: Task;
  /** Days from ANCHOR_NOW; negative = overdue. */
  daysOut: number;
}

export interface HubMetrics {
  total: number;
  completed: number;
  overdue: number;
  status: StatusSlice[];
  priority: PrioritySlice[];
  assignees: AssigneeSlice[];
  dueSoon: DueSoonItem[];
  recent: Task[];
}

const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low'] as const;
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
const PRIORITY_FALLBACK: Record<string, string> = {
  urgent: '#e85d75',
  high: '#f6a609',
  normal: '#3b82f6',
  low: '#9aa3ad',
};

function isOverdue(task: Task): boolean {
  return task.dueDate != null && task.dueDate < ANCHOR_NOW && !isComplete(task);
}

function priorityBreakdown(tasks: Task[]): PrioritySlice[] {
  const counts = new Map<string, { count: number; color: string }>();
  let none = 0;
  for (const t of tasks) {
    const key = t.priority?.toLowerCase() ?? null;
    if (!key) {
      none += 1;
      continue;
    }
    const prev = counts.get(key);
    counts.set(key, {
      count: (prev?.count ?? 0) + 1,
      color: t.priorityColor ?? prev?.color ?? PRIORITY_FALLBACK[key] ?? '#9aa3ad',
    });
  }
  const ordered: PrioritySlice[] = [];
  for (const key of PRIORITY_ORDER) {
    const entry = counts.get(key);
    if (entry) {
      ordered.push({ label: PRIORITY_LABEL[key] ?? key, color: entry.color, count: entry.count });
      counts.delete(key);
    }
  }
  for (const [key, entry] of counts) {
    ordered.push({ label: PRIORITY_LABEL[key] ?? key, color: entry.color, count: entry.count });
  }
  if (none > 0) ordered.push({ label: 'No priority', color: '#c9ced6', count: none });
  return ordered;
}

function dueSoon(tasks: Task[]): DueSoonItem[] {
  const horizon = ANCHOR_NOW + DUE_SOON_WINDOW;
  return tasks
    .filter((t) => t.dueDate != null && !isComplete(t) && t.dueDate <= horizon)
    .map((t) => ({
      task: t,
      daysOut: Math.round(((t.dueDate as number) - ANCHOR_NOW) / DAY_MS),
    }))
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 8);
}

function recentlyUpdated(tasks: Task[]): Task[] {
  return [...tasks]
    .filter((t) => t.dateUpdated != null)
    .sort((a, b) => (b.dateUpdated ?? 0) - (a.dateUpdated ?? 0))
    .slice(0, 8);
}

/** Compute the full metric set from an already-filtered task list. */
export function computeHubMetrics(tasks: Task[], members: Member[]): HubMetrics {
  return {
    total: tasks.length,
    completed: tasks.filter(isComplete).length,
    overdue: tasks.filter(isOverdue).length,
    status: countByStatus(tasks),
    priority: priorityBreakdown(tasks),
    assignees: tasksByAssignee(tasks, members),
    dueSoon: dueSoon(tasks),
    recent: recentlyUpdated(tasks),
  };
}

export interface HubFilterState {
  /** Selected status labels; empty = all. */
  statuses: string[];
  /** Selected assignee ids; empty = all. `__none__` matches unassigned. */
  assignees: string[];
}

export const EMPTY_HUB_FILTER: HubFilterState = { statuses: [], assignees: [] };

function applyFilter(tasks: Task[], filter: HubFilterState): Task[] {
  const { statuses, assignees } = filter;
  if (statuses.length === 0 && assignees.length === 0) return tasks;
  return tasks.filter((t) => {
    if (statuses.length > 0 && !statuses.includes(t.status)) return false;
    if (assignees.length > 0) {
      if (t.assignees.length === 0) return assignees.includes('__none__');
      return t.assignees.some((a) => assignees.includes(a.id));
    }
    return true;
  });
}

/** Workspace-wide metrics, recomputed whenever the filter or store changes. */
export function useHubMetrics(filter: HubFilterState = EMPTY_HUB_FILTER): {
  metrics: HubMetrics;
  members: Member[];
  /** All status labels present pre-filter, for the filter control. */
  allStatuses: StatusSlice[];
} {
  const tasks = useAllTasksFlat();
  const members = useMembers();
  return useMemo(() => {
    const allStatuses = countByStatus(tasks);
    const filtered = applyFilter(tasks, filter);
    return { metrics: computeHubMetrics(filtered, members), members, allStatuses };
  }, [tasks, members, filter]);
}
