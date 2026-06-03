'use client';

/**
 * Dashboard aggregations. Pure reducers over a list's real tasks plus thin
 * memoised hooks that bind them to the workspace store. Every metric reads the
 * SAME Task objects the List/Board views render — no parallel dataset.
 *
 * Completion is derived from `statusType` ('closed' | 'done' = complete,
 * 'custom' = in progress, 'open' = not started), matching the rest of the app.
 * "This week" is measured against ANCHOR_NOW (the fixed clock), never the live
 * JS clock, so renders stay deterministic across reloads and SSR.
 */

import { useMemo } from 'react';
import { ANCHOR_NOW, DAY_MS } from '@/lib/view-dates';
import { useMembers, useTasksByList } from '@/store/workspace/hooks';
import type { Member, Task } from '@/store/workspace/types';

export const COMPLETE = new Set(['closed', 'done']);
const WEEK_MS = 7 * DAY_MS;

export function isComplete(task: Task): boolean {
  return COMPLETE.has(task.statusType);
}

/** The fixed "now" the "this week" window is measured against (frozen clock). */
export const COMPLETED_WINDOW_ANCHOR = ANCHOR_NOW;

function isInProgress(task: Task): boolean {
  return task.statusType === 'custom';
}

// ── Counts ────────────────────────────────────────────────────────────────

/** Tasks with no assignees. */
export function countUnassigned(tasks: Task[]): number {
  return tasks.reduce((n, t) => (t.assignees.length === 0 ? n + 1 : n), 0);
}

/** Count tasks by completion bucket. */
export function countByStatusType(tasks: Task[]): {
  notStarted: number;
  active: number;
  done: number;
} {
  let notStarted = 0;
  let active = 0;
  let done = 0;
  for (const t of tasks) {
    if (isComplete(t)) done += 1;
    else if (isInProgress(t)) active += 1;
    else notStarted += 1;
  }
  return { notStarted, active, done };
}

export function totalTasks(tasks: Task[]): number {
  return tasks.length;
}

/** Tasks closed within 7 days of ANCHOR_NOW (uses dateUpdated as the close ts). */
export function completedThisWeek(tasks: Task[]): Task[] {
  const since = ANCHOR_NOW - WEEK_MS;
  return tasks.filter((t) => {
    if (!isComplete(t)) return false;
    const closedAt = t.dateUpdated ?? t.dateCreated ?? 0;
    return closedAt >= since && closedAt <= ANCHOR_NOW;
  });
}

// ── Grouped bars / slices ───────────────────────────────────────────────────

export interface StatusSlice {
  status: string;
  color: string;
  count: number;
}

/** Tasks grouped by their status label, with the status colour. */
export function countByStatus(tasks: Task[]): StatusSlice[] {
  const map = new Map<string, StatusSlice>();
  for (const t of tasks) {
    const existing = map.get(t.status);
    if (existing) existing.count += 1;
    else map.set(t.status, { status: t.status, color: t.statusColor, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface AssigneeSlice {
  member: Member | null;
  count: number;
}

/** Build a member lookup once, then bucket tasks by each assignee. */
function bucketByAssignee(
  tasks: Task[],
  members: Member[],
  predicate: (t: Task) => boolean,
): AssigneeSlice[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const counts = new Map<string, number>();
  let unassigned = 0;

  for (const t of tasks) {
    if (!predicate(t)) continue;
    if (t.assignees.length === 0) {
      unassigned += 1;
      continue;
    }
    for (const a of t.assignees) {
      counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
    }
  }

  const slices: AssigneeSlice[] = [...counts.entries()].map(([id, count]) => ({
    member: byId.get(id) ?? null,
    count,
  }));
  if (unassigned > 0) slices.push({ member: null, count: unassigned });
  return slices.sort((a, b) => b.count - a.count);
}

/** Every task grouped by assignee (unassigned bucketed under `member: null`). */
export function tasksByAssignee(
  tasks: Task[],
  members: Member[],
): AssigneeSlice[] {
  return bucketByAssignee(tasks, members, () => true);
}

/** Open (non-complete) tasks grouped by assignee. */
export function openTasksByAssignee(
  tasks: Task[],
  members: Member[],
): AssigneeSlice[] {
  return bucketByAssignee(tasks, members, (t) => !isComplete(t));
}

// ── Executive summary ───────────────────────────────────────────────────────

function formatDate(ms: number | null): string {
  if (!ms) return 'an unknown date';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Deterministic, human-readable rollup of the list. Mentions total, the
 * dominant status, the open/done split, the unassigned count, and when the
 * earliest task was created. No randomness — same input yields same text.
 */
export function executiveSummary(
  tasks: Task[],
  _members: Member[],
  listName: string,
): string {
  const total = tasks.length;
  if (total === 0) {
    return `${listName} has no tasks yet. Add a card or create work to see a summary here.`;
  }

  const { notStarted, active, done } = countByStatusType(tasks);
  const slices = countByStatus(tasks);
  const dominant = slices[0];
  const unassigned = countUnassigned(tasks);

  const earliest = tasks.reduce<number | null>((min, t) => {
    if (t.dateCreated == null) return min;
    return min == null ? t.dateCreated : Math.min(min, t.dateCreated);
  }, null);

  const parts: string[] = [];
  parts.push(`${listName} is tracking ${total} task${total === 1 ? '' : 's'}.`);

  if (dominant && dominant.count === total) {
    parts.push(`All of them sit in "${dominant.status}".`);
  } else if (dominant) {
    const pct = Math.round((dominant.count / total) * 100);
    parts.push(
      `The dominant status is "${dominant.status}" with ${dominant.count} task${dominant.count === 1 ? '' : 's'} (${pct}%).`,
    );
  }

  parts.push(
    `${done} complete, ${active} in progress, and ${notStarted} not started.`,
  );

  if (unassigned > 0) {
    parts.push(
      `${unassigned} task${unassigned === 1 ? ' is' : 's are'} still unassigned.`,
    );
  }

  parts.push(`The earliest task was created on ${formatDate(earliest)}.`);

  return parts.join(' ');
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/** Everything a dashboard card needs, memoised, for one list. */
export interface DashboardMetrics {
  tasks: Task[];
  members: Member[];
  total: number;
  unassigned: number;
  byStatusType: { notStarted: number; active: number; done: number };
  statusSlices: StatusSlice[];
  byAssignee: AssigneeSlice[];
  openByAssignee: AssigneeSlice[];
  completedThisWeek: Task[];
}

/**
 * Single memoised metrics bundle for a list. Cards pull the slice they need off
 * the returned object instead of recomputing per card. Stable across renders
 * unless the underlying tasks/members change.
 */
export function useDashboardMetrics(listId: string): DashboardMetrics {
  const tasks = useTasksByList(listId);
  const members = useMembers();
  return useMemo<DashboardMetrics>(
    () => ({
      tasks,
      members,
      total: totalTasks(tasks),
      unassigned: countUnassigned(tasks),
      byStatusType: countByStatusType(tasks),
      statusSlices: countByStatus(tasks),
      byAssignee: tasksByAssignee(tasks, members),
      openByAssignee: openTasksByAssignee(tasks, members),
      completedThisWeek: completedThisWeek(tasks),
    }),
    [tasks, members],
  );
}

/** Memoised executive-summary string for a list. */
export function useExecutiveSummary(listId: string, listName: string): string {
  const tasks = useTasksByList(listId);
  const members = useMembers();
  return useMemo(
    () => executiveSummary(tasks, members, listName),
    [tasks, members, listName],
  );
}
