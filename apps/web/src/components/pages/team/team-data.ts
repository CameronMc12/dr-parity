'use client';

/**
 * Team-view aggregations. Buckets a view's real tasks by assignee, then by
 * status within each assignee, so the per-member cards render the SAME Task
 * objects the List/Board views use — no parallel dataset.
 *
 * A task assigned to N members appears in N buckets (ClickUp shows the same
 * task under every assignee). Tasks with no assignees collect under a synthetic
 * "Unassigned" bucket. Completion uses `statusType` ('closed' | 'done' = done),
 * matching the rest of the app.
 *
 * All hooks return memoised, reference-stable structures so they are safe to
 * pass straight into render without tripping the re-render guard.
 */

import { useMemo } from 'react';
import { useMembers } from '@/store/workspace/hooks';
import { useViewTasks } from '@/lib/view-data';
import type { Member, Task } from '@/store/workspace/types';

const DONE = new Set(['closed', 'done']);

export function isTaskDone(task: Task): boolean {
  return DONE.has(task.statusType);
}

/** A status sub-group inside one assignee card (e.g. "TO DO (3)"). */
export interface TeamStatusGroup {
  status: string;
  color: string;
  statusType: string;
  tasks: Task[];
}

/** One assignee's slice of the board. `member` is null for the Unassigned card. */
export interface TeamBucket {
  /** Stable key: member id, or '__unassigned__'. */
  key: string;
  member: Member | null;
  name: string;
  initials: string;
  color: string;
  tasks: Task[];
  done: number;
  notDone: number;
  /** 0–100 completion ratio. */
  donePct: number;
  groups: TeamStatusGroup[];
}

const UNASSIGNED_KEY = '__unassigned__';

interface Draft {
  member: Member | null;
  tasks: Task[];
}

/**
 * First-seen status order, so groups render in the task arrival order.
 *
 * Pure: never mutates a `TeamStatusGroup` object once it has been placed in the
 * map. Appending a task replaces the entry with a fresh object + fresh array, so
 * earlier-returned references stay frozen.
 */
function buildStatusGroups(tasks: Task[]): TeamStatusGroup[] {
  const map = new Map<string, TeamStatusGroup>();
  for (const t of tasks) {
    const existing = map.get(t.status);
    if (existing) {
      map.set(t.status, { ...existing, tasks: [...existing.tasks, t] });
    } else {
      map.set(t.status, {
        status: t.status,
        color: t.statusColor || '#87909e',
        statusType: t.statusType,
        tasks: [t],
      });
    }
  }
  return [...map.values()];
}

function finalizeBucket(key: string, draft: Draft): TeamBucket {
  const { member, tasks } = draft;
  const done = tasks.reduce((n, t) => (isTaskDone(t) ? n + 1 : n), 0);
  const notDone = tasks.length - done;
  const donePct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
  return {
    key,
    member,
    name: member?.name ?? 'Unassigned',
    initials: member?.initials ?? '–',
    color: member?.color ?? '#7b8794',
    tasks,
    done,
    notDone,
    donePct,
    groups: buildStatusGroups(tasks),
  };
}

/**
 * Bucket tasks by assignee. Members with at least one task get a card; the
 * unassigned bucket is appended last when non-empty. Member cards are ordered
 * by the workspace member roster so the row is stable across renders.
 */
export function bucketByAssignee(tasks: Task[], members: Member[]): TeamBucket[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const drafts = new Map<string, Draft>();

  for (const t of tasks) {
    if (t.assignees.length === 0) {
      const u = drafts.get(UNASSIGNED_KEY) ?? { member: null, tasks: [] };
      u.tasks.push(t);
      drafts.set(UNASSIGNED_KEY, u);
      continue;
    }
    for (const a of t.assignees) {
      const member = byId.get(a.id) ?? null;
      const draft = drafts.get(a.id) ?? { member, tasks: [] };
      draft.tasks.push(t);
      drafts.set(a.id, draft);
    }
  }

  const ordered: TeamBucket[] = [];
  for (const m of members) {
    const draft = drafts.get(m.id);
    if (draft) ordered.push(finalizeBucket(m.id, draft));
  }
  const unassigned = drafts.get(UNASSIGNED_KEY);
  if (unassigned) ordered.push(finalizeBucket(UNASSIGNED_KEY, unassigned));
  return ordered;
}

/** Memoised assignee buckets for a view. Stable until tasks/members change. */
export function useTeamBuckets(viewId: string): TeamBucket[] {
  const tasks = useViewTasks(viewId);
  const members = useMembers();
  return useMemo(() => bucketByAssignee(tasks, members), [tasks, members]);
}

/** Peak per-assignee task count, for scaling the workload capacity bars. */
export function peakLoad(buckets: TeamBucket[]): number {
  return buckets.reduce((max, b) => Math.max(max, b.tasks.length), 0);
}

/**
 * All status groups across every bucket, merged — drives the combined view.
 *
 * Pure: appending tasks replaces the merged entry with a fresh object + array so
 * the input buckets' own group objects are never mutated. Safe to call more than
 * once on the same bucket array.
 */
export function combinedGroups(buckets: TeamBucket[]): TeamStatusGroup[] {
  const merged = new Map<string, TeamStatusGroup>();
  for (const b of buckets) {
    for (const g of b.groups) {
      const existing = merged.get(g.status);
      if (existing) {
        merged.set(g.status, { ...existing, tasks: [...existing.tasks, ...g.tasks] });
      } else {
        merged.set(g.status, {
          status: g.status,
          color: g.color,
          statusType: g.statusType,
          tasks: [...g.tasks],
        });
      }
    }
  }
  return [...merged.values()];
}

/**
 * Rebuild a bucket from a filtered subset of its tasks, recomputing the
 * done/notDone/donePct summary and status groups so the card header stays
 * truthful after the Filter popover toggles narrow the visible tasks. Pure.
 */
export function refilterBucket(
  bucket: TeamBucket,
  keep: (task: Task) => boolean,
): TeamBucket {
  const tasks = bucket.tasks.filter(keep);
  if (tasks.length === bucket.tasks.length) return bucket;
  return finalizeBucket(bucket.key, { member: bucket.member, tasks });
}
