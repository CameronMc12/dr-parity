/**
 * Derives the Activity feed from the real task corpus.
 *
 * ClickUp's Activity view is a reverse-chronological log of *logged* task
 * changes — not a synthesis of timestamps. A freshly-seeded task that has never
 * been touched produces NO activity rows, which is why the real view renders the
 * "Nothing to see here" empty state for the seed corpus. We mirror that exactly:
 * entries come only from genuinely-logged sources the task records, never from
 * bare `dateCreated` / `dateUpdated` timestamps.
 *
 *   - `moved`     one per real `task.activity` entry of kind 'status' (an actual
 *                 logged status change), at that entry's createdAt.
 *   - `commented` one per real `task.comments` entry, at that comment's
 *                 createdAt.
 *
 * Each entry resolves an actor — the activity/comment author by id where the
 * source record carries one, else the task's first assignee, else a workspace
 * fallback — and is bucketed under its local-midnight day. Buckets and entries
 * are both sorted newest-first. Pure and deterministic.
 */

import type { Member, Task } from '@/lib/view-data';
import { startOfDay } from '@/lib/view-data';
import type { FilterState } from '@/store/workspace/view-config.types';

export type ActivityAction = 'moved' | 'commented';

interface Actor {
  name: string;
  initials: string;
  color: string;
}

export interface FeedEntry {
  /** Stable key: `<taskId>:<action>` or `<taskId>:<action>:<sourceId>`. */
  id: string;
  action: ActivityAction;
  task: Task;
  /** Resolved actor for the avatar + bold name. */
  actorName: string;
  actorInitials: string;
  actorColor: string;
  /** Epoch ms the event occurred. */
  at: number;
}

export interface FeedDay {
  /** Local-midnight timestamp of the day bucket. */
  day: number;
  entries: FeedEntry[];
}

const FALLBACK_COLOR = '#595d66';

/** Avatar glyph shown when no actor can be resolved. */
const UNKNOWN_ACTOR_INITIAL = '?';

const UNKNOWN_ACTOR: Actor = {
  name: 'Someone',
  initials: UNKNOWN_ACTOR_INITIAL,
  color: FALLBACK_COLOR,
};

function memberToActor(m: Member): Actor {
  return { name: m.name, initials: m.initials, color: m.color };
}

/** Actor for task-level events: first assignee, else workspace fallback. */
function taskActor(task: Task, fallback: Member | undefined): Actor {
  const a = task.assignees[0];
  if (a) return { name: a.name, initials: a.initials, color: a.color };
  if (fallback) return memberToActor(fallback);
  return UNKNOWN_ACTOR;
}

/** Actor for an authored record (comment / logged change), resolved by id. */
function authorActor(
  authorId: string,
  byId: Map<string, Member>,
  task: Task,
  fallback: Member | undefined,
): Actor {
  const m = byId.get(authorId);
  if (m) return memberToActor(m);
  return taskActor(task, fallback);
}

function pushEntry(
  out: FeedEntry[],
  id: string,
  action: ActivityAction,
  task: Task,
  at: number,
  actor: Actor,
): void {
  out.push({
    id,
    action,
    task,
    actorName: actor.name,
    actorInitials: actor.initials,
    actorColor: actor.color,
    at,
  });
}

/** Flatten the corpus into individual feed entries (unsorted). */
export function deriveEntries(tasks: Task[], members: Member[]): FeedEntry[] {
  const fallback = members[0];
  const byId = new Map(members.map((m) => [m.id, m]));
  const out: FeedEntry[] = [];

  for (const task of tasks) {
    if (task.archived) continue;

    // Real logged status changes → "moved" events.
    for (const ev of task.activity ?? []) {
      if (ev.kind !== 'status') continue;
      pushEntry(
        out,
        `${task.id}:moved:${ev.id}`,
        'moved',
        task,
        ev.createdAt,
        authorActor(ev.authorId, byId, task, fallback),
      );
    }

    // Real comment threads → "commented" events.
    for (const c of task.comments ?? []) {
      pushEntry(
        out,
        `${task.id}:commented:${c.id}`,
        'commented',
        task,
        c.createdAt,
        authorActor(c.authorId, byId, task, fallback),
      );
    }
  }

  return out;
}

/**
 * Apply the stored view-config filters (status / priority / assignee) to a task,
 * mirroring the List view's `passesFilters`. An empty bucket means "no filter".
 */
function taskPassesConfigFilters(task: Task, filters: FilterState): boolean {
  if (filters.status.length && !filters.status.includes(task.status)) return false;
  if (
    filters.priority.length &&
    (!task.priority || !filters.priority.includes(task.priority))
  )
    return false;
  if (
    filters.assignee.length &&
    !task.assignees.some((a) => filters.assignee.includes(a.id))
  )
    return false;
  return true;
}

/**
 * Filter entries by the search query (task name, case-insensitive) AND the
 * stored view-config filters — so the toolbar's Filter / Assignee controls and
 * search all narrow the feed.
 *
 * An empty query and empty filter buckets each pass everything for their
 * dimension.
 */
export function filterEntries(
  entries: FeedEntry[],
  query: string,
  filters: FilterState,
): FeedEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (q && !e.task.name.toLowerCase().includes(q)) return false;
    return taskPassesConfigFilters(e.task, filters);
  });
}

/** Bucket entries into day groups, newest day + newest entry first. */
export function groupEntriesByDay(entries: FeedEntry[]): FeedDay[] {
  const buckets = new Map<number, FeedEntry[]>();
  for (const entry of entries) {
    const day = startOfDay(entry.at);
    const list = buckets.get(day);
    if (list) list.push(entry);
    else buckets.set(day, [entry]);
  }

  return [...buckets.entries()]
    .map(([day, list]) => ({
      day,
      entries: list.sort((a, b) => b.at - a.at),
    }))
    .sort((a, b) => b.day - a.day);
}

/** Full pipeline: derive → filter (query + view-config) → group. */
export function buildFeed(
  tasks: Task[],
  members: Member[],
  query: string,
  filters: FilterState,
): FeedDay[] {
  return groupEntriesByDay(
    filterEntries(deriveEntries(tasks, members), query, filters),
  );
}
