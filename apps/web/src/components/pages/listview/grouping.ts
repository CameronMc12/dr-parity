/**
 * List-view grouping + filtering engine. Turns a flat task array into ordered,
 * filtered groups according to the active ViewConfig (groupBy field, sort
 * direction, status/priority/assignee filters, show-closed). Pure functions.
 */

import { statusOrder } from '@/data/status-order';
import { statusTypeForDefType, type StatusDef } from '@/data/status-set';
import type { Member, Task } from '@/store/workspace/types';
import type { FilterState, GroupByField, SortDir, ViewConfig } from '@/store/workspace/view-config.types';
import { priorityLabel, PRIORITY_OPTIONS } from './statuses';

const TERMINAL = new Set(['done', 'closed']);

export interface ListGroup {
  /** Stable key used for collapsed-group tracking. */
  key: string;
  label: string;
  /** Dot colour for the group badge. */
  color: string;
  /** Dashed badge ring (only "not started" status groups). */
  dashed: boolean;
  /**
   * The group's status type (`open`/`custom`/`done`/`closed`). Carried so an
   * EMPTY status group can stamp the right type onto a task added into it.
   * Only set for status grouping.
   */
  statusType?: string;
  tasks: Task[];
}

/**
 * Sort tasks by their manual `order` index. Manual DnD reorder + cross-group
 * moves both write `order`, so honouring it is what makes the sequence persist.
 * Falls back to creation time then id for stability.
 */
function naturalOrder(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order;
  const ca = a.dateCreated ?? 0;
  const cb = b.dateCreated ?? 0;
  if (ca !== cb) return ca - cb;
  return a.id.localeCompare(b.id);
}

function isClosed(t: Task): boolean {
  return TERMINAL.has(t.statusType);
}

/** Inclusive start-of-day for `now`, used by the relative due-date buckets. */
function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function passesDueDate(t: Task, bucket: NonNullable<FilterState['dueDate']>): boolean {
  if (bucket === 'none') return t.dueDate == null;
  if (t.dueDate == null) return false;
  const now = Date.now();
  const dayStart = startOfToday(now);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  if (bucket === 'overdue') return t.dueDate < now;
  if (bucket === 'today') return t.dueDate >= dayStart && t.dueDate < dayEnd;
  // 'week': due any time from start-of-today through the next 7 days.
  return t.dueDate >= dayStart && t.dueDate < dayStart + 7 * 24 * 60 * 60 * 1000;
}

function passesFilters(t: Task, f: FilterState): boolean {
  if (f.status.length && !f.status.includes(t.status)) return false;
  if (f.priority.length && (!t.priority || !f.priority.includes(t.priority))) return false;
  if (f.assignee.length && !t.assignees.some((a) => f.assignee.includes(a.id))) return false;
  if (f.tags.length && !(t.tags ?? []).some((tag) => f.tags.includes(tag.name))) return false;
  if (f.dueDate && !passesDueDate(t, f.dueDate)) return false;
  return true;
}

export function applyFilters(tasks: Task[], config: ViewConfig): Task[] {
  return tasks.filter((t) => {
    if (!config.showClosed && isClosed(t)) return false;
    return passesFilters(t, config.filters);
  });
}

// ── Grouping by field ────────────────────────────────────────────────────────

function dashedFor(label: string, statusType: string): boolean {
  return statusOrder(label) === 0 && !TERMINAL.has(statusType.toLowerCase());
}

/**
 * Group tasks by status. When `statusDefs` is supplied, ONE group is emitted per
 * defined status in its declared order — including empty ones (count 0) — so the
 * Board/List/Table show every column ClickUp would. Each task is bucketed into
 * its matching status group (matched case-insensitively by label); any status a
 * task carries that isn't in the defined set still gets its own trailing group
 * so nothing is dropped. Without `statusDefs` it falls back to the legacy
 * "groups from present statuses only" behaviour.
 */
function groupByStatus(tasks: Task[], dir: SortDir, statusDefs?: StatusDef[]): ListGroup[] {
  const map = new Map<string, ListGroup>();

  // Seed an (empty) group for every defined status, in declared order.
  if (statusDefs) {
    for (const def of statusDefs) {
      map.set(def.label, {
        key: `status:${def.label}`,
        label: def.label,
        color: def.color,
        dashed: def.type === 'not_started',
        statusType: statusTypeForDefType(def.type),
        tasks: [],
      });
    }
  }

  for (const t of tasks) {
    const key = t.status.toLowerCase();
    const g = map.get(key);
    if (g) g.tasks.push(t);
    else
      map.set(key, {
        key: `status:${t.status}`,
        label: t.status,
        color: t.statusColor || '#87909e',
        dashed: dashedFor(t.status, t.statusType),
        statusType: t.statusType,
        tasks: [t],
      });
  }

  const groups = [...map.values()];
  for (const g of groups) g.tasks.sort(naturalOrder);

  // When defs drive the order we keep their declared order (already done/closed-
  // pinned by orderStatusDefs); only flip for descending sort. Without defs we
  // fall back to the legacy ordering from each group's representative status.
  if (statusDefs) {
    if (dir === 'desc') groups.reverse();
    return groups;
  }

  groups.sort((a, b) => {
    const at = isTerminalGroup(a) ? 1 : 0;
    const bt = isTerminalGroup(b) ? 1 : 0;
    if (at !== bt) return at - bt;
    const cmp = statusOrder(b.label) - statusOrder(a.label) || a.label.localeCompare(b.label);
    return dir === 'asc' ? cmp : -cmp;
  });
  return groups;
}

function isTerminalGroup(g: ListGroup): boolean {
  if (g.statusType) return TERMINAL.has(g.statusType.toLowerCase());
  return g.tasks[0] ? isClosed(g.tasks[0]) : false;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function groupByPriority(tasks: Task[], dir: SortDir): ListGroup[] {
  const map = new Map<string, ListGroup>();
  for (const t of tasks) {
    const key = t.priority ?? 'none';
    const g = map.get(key);
    if (g) g.tasks.push(t);
    else {
      const opt = PRIORITY_OPTIONS.find((p) => p.key === t.priority);
      map.set(key, {
        key: `priority:${key}`,
        label: t.priority ? priorityLabel(t.priority) : 'No priority',
        color: opt?.color ?? '#7b7b7b',
        dashed: false,
        tasks: [t],
      });
    }
  }
  const groups = [...map.values()];
  for (const g of groups) g.tasks.sort(naturalOrder);
  groups.sort((a, b) => {
    const ar = PRIORITY_RANK[a.key.split(':')[1] ?? ''] ?? 99;
    const br = PRIORITY_RANK[b.key.split(':')[1] ?? ''] ?? 99;
    return dir === 'asc' ? ar - br : br - ar;
  });
  return groups;
}

function groupByAssignee(tasks: Task[], dir: SortDir, members: Member[]): ListGroup[] {
  const map = new Map<string, ListGroup>();
  for (const t of tasks) {
    const key = t.assignees[0]?.id ?? 'unassigned';
    const label = t.assignees[0]?.name ?? 'Unassigned';
    const color = t.assignees[0]?.color ?? '#7b7b7b';
    const g = map.get(key);
    if (g) g.tasks.push(t);
    else map.set(key, { key: `assignee:${key}`, label, color, dashed: false, tasks: [t] });
  }
  const groups = [...map.values()];
  for (const g of groups) g.tasks.sort(naturalOrder);
  groups.sort((a, b) => {
    const cmp = a.label.localeCompare(b.label);
    return dir === 'asc' ? cmp : -cmp;
  });
  void members;
  return groups;
}

/** Single ungrouped bucket used when groupBy = 'none'. */
function ungrouped(tasks: Task[]): ListGroup[] {
  const sorted = [...tasks].sort(naturalOrder);
  return sorted.length ? [{ key: 'all', label: 'All tasks', color: '#7b7b7b', dashed: false, tasks: sorted }] : [];
}

export function buildGroups(
  tasks: Task[],
  config: ViewConfig,
  members: Member[],
  statusDefs?: StatusDef[],
): ListGroup[] {
  const filtered = applyFilters(tasks, config);
  const field: GroupByField = config.groupBy;
  if (field === 'priority') return groupByPriority(filtered, config.sortDir);
  if (field === 'assignee') return groupByAssignee(filtered, config.sortDir, members);
  if (field === 'none') return ungrouped(filtered);
  const defs = config.showClosed
    ? statusDefs
    : statusDefs?.filter((d) => d.type !== 'closed' && d.type !== 'done');
  return groupByStatus(filtered, config.sortDir, defs);
}
