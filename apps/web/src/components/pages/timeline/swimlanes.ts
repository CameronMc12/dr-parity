/**
 * Swimlane construction for the Timeline view.
 *
 * Two pure passes:
 *   1. group()   — bucket tasks into lanes by the active field. `none` yields a
 *                  single flat track; status/assignee/priority yield one lane
 *                  per value.
 *   2. pack()    — within each lane, greedily place spans onto the fewest rows
 *                  such that no two bars on the same row overlap in time.
 *
 * The packing is what makes a Timeline lane denser than a Gantt row: a lane can
 * hold many tasks side by side as long as their date spans don't collide.
 *
 * Dates come from the shared `deriveSpan`; no dates are invented here.
 */

import { deriveSpan } from '@/lib/view-data';
import type { Member, Task, TaskSpan } from '@/lib/view-data';
import { TL, type TimelineGroupBy } from './tokens';

/** A task placed on a lane row with its resolved span. */
export interface PackedTask {
  task: Task;
  span: TaskSpan;
  /** Zero-based row index within the lane. */
  row: number;
}

export interface Swimlane {
  /** Stable key (`assignee:<id>` / `status:<label>`). */
  key: string;
  label: string;
  /** Lane accent colour (avatar tint / status dot). */
  color: string;
  /** Member behind an assignee lane, for the avatar. Null for status lanes. */
  member: Member | null;
  /** Tasks packed onto rows. */
  packed: PackedTask[];
  /** Row count (>=1) — drives lane height. */
  rowCount: number;
  /** Total tasks in the lane. */
  taskCount: number;
}

/** Greedily pack spans onto the fewest non-overlapping rows. */
function packLane(tasks: Task[]): { packed: PackedTask[]; rowCount: number } {
  const withSpan = tasks
    .map((task) => ({ task, span: deriveSpan(task) }))
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);

  const rowEnds: number[] = []; // last span end placed on each row
  const packed: PackedTask[] = [];

  for (const item of withSpan) {
    let placed = -1;
    for (let r = 0; r < rowEnds.length; r += 1) {
      const lastEnd = rowEnds[r] ?? Number.NEGATIVE_INFINITY;
      // A bar fits on a row if it starts strictly after that row's last bar ends.
      if (item.span.start > lastEnd) {
        placed = r;
        break;
      }
    }
    if (placed === -1) {
      placed = rowEnds.length;
      rowEnds.push(item.span.end);
    } else {
      rowEnds[placed] = item.span.end;
    }
    packed.push({ task: item.task, span: item.span, row: placed });
  }

  return { packed, rowCount: Math.max(1, rowEnds.length) };
}

interface RawLane {
  key: string;
  label: string;
  color: string;
  member: Member | null;
  tasks: Task[];
}

/** Rank for the synthetic Priority lanes so Urgent sorts above Low. */
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Bucket tasks into ordered lanes by the active field. */
function bucket(
  tasks: Task[],
  groupBy: TimelineGroupBy,
  members: Member[],
): RawLane[] {
  if (groupBy === 'none') {
    return tasks.length
      ? [{ key: 'all', label: 'All tasks', color: TL.laneFallback, member: null, tasks }]
      : [];
  }

  const map = new Map<string, RawLane>();

  for (const t of tasks) {
    if (groupBy === 'assignee') {
      const a = t.assignees[0];
      const key = a?.id ?? 'unassigned';
      const member = a ? (members.find((m) => m.id === a.id) ?? null) : null;
      const existing = map.get(key);
      if (existing) existing.tasks.push(t);
      else
        map.set(key, {
          key: `assignee:${key}`,
          label: a?.name ?? 'Unassigned',
          color: a?.color ?? TL.laneFallback,
          member,
          tasks: [t],
        });
    } else if (groupBy === 'priority') {
      const raw = (t.priority ?? '').trim();
      const dedupKey = raw.toLowerCase() || 'none';
      const existing = map.get(dedupKey);
      if (existing) existing.tasks.push(t);
      else
        map.set(dedupKey, {
          key: `priority:${dedupKey}`,
          label: raw ? raw[0]!.toUpperCase() + raw.slice(1) : 'No priority',
          color: t.priorityColor || TL.laneFallback,
          member: null,
          tasks: [t],
        });
    } else {
      // Normalise so casing/whitespace drift can't split one status into two
      // lanes, and an empty status still renders a readable lane.
      const raw = (t.status ?? '').trim();
      const dedupKey = raw.toLowerCase() || 'no-status';
      const existing = map.get(dedupKey);
      if (existing) existing.tasks.push(t);
      else
        map.set(dedupKey, {
          key: `status:${dedupKey}`,
          label: raw || 'No status',
          color: t.statusColor || TL.laneFallback,
          member: null,
          tasks: [t],
        });
    }
  }

  const lanes = [...map.values()];
  if (groupBy === 'priority') {
    return lanes.sort((a, b) => {
      const ra = PRIORITY_RANK[a.label.toLowerCase()] ?? 99;
      const rb = PRIORITY_RANK[b.label.toLowerCase()] ?? 99;
      return ra - rb || a.label.localeCompare(b.label);
    });
  }
  return lanes.sort((a, b) => a.label.localeCompare(b.label));
}

/** Build packed swimlanes for the active grouping field. Pure. */
export function buildSwimlanes(
  tasks: Task[],
  groupBy: TimelineGroupBy,
  members: Member[],
): Swimlane[] {
  return bucket(tasks, groupBy, members).map((b) => {
    const { packed, rowCount } = packLane(b.tasks);
    return {
      key: b.key,
      label: b.label,
      color: b.color,
      member: b.member,
      packed,
      rowCount,
      taskCount: b.tasks.length,
    };
  });
}

/** Pixel height of a lane given its row count. */
export function laneHeight(rowCount: number): number {
  const rows = Math.max(1, rowCount);
  const inner = rows * TL.barHeight + (rows - 1) * TL.rowGap;
  return Math.max(TL.laneMinHeight, inner + TL.lanePadY * 2);
}

/** Top px of a packed row within its lane. */
export function rowTop(row: number): number {
  return TL.lanePadY + row * (TL.barHeight + TL.rowGap);
}
