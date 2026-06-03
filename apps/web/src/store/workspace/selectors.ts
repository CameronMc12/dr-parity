/**
 * Pure selectors over WorkspaceState. Kept outside the store so they can be
 * memoised by callers and unit-tested in isolation. Each takes the state and
 * returns derived data without mutating.
 */

import type {
  Channel,
  FolderNode,
  ListNode,
  Message,
  SpaceNode,
  Task,
  WorkspaceState,
} from './types';
import {
  deriveStatusDefs,
  orderStatusDefs,
  SEEDED_STATUS_SETS,
  type StatusDef,
} from '@/data/status-set';

const RECENTS_LIMIT = 15;

function isDone(task: Task): boolean {
  return task.statusType === 'closed' || task.statusType === 'done';
}

export function allTasks(state: WorkspaceState): Task[] {
  return Object.values(state.tasks);
}

export function taskById(state: WorkspaceState, taskId: string): Task | null {
  return state.tasks[taskId] ?? null;
}

/** Top-level tasks for a list (subtasks are nested under their parent). */
export function tasksByList(state: WorkspaceState, listId: string): Task[] {
  return allTasks(state).filter(
    (t) => t.listId === listId && !t.archived && !t.parent,
  );
}

/** Every task in a list (top-level AND subtasks) — used to derive status sets. */
export function listTasksFlat(state: WorkspaceState, listId: string): Task[] {
  return allTasks(state).filter((t) => t.listId === listId && !t.archived);
}

/** All non-archived tasks, flat. Used by the relationship picker. */
export function allActiveTasks(state: WorkspaceState): Task[] {
  return allTasks(state).filter((t) => !t.archived);
}

/** Direct subtasks of a parent task, ordered by manual `order` then creation. */
export function subtasksOf(state: WorkspaceState, parentId: string): Task[] {
  return allTasks(state)
    .filter((t) => t.parent === parentId && !t.archived)
    .sort((a, b) => a.order - b.order || (a.dateCreated ?? 0) - (b.dateCreated ?? 0));
}

export function myTasks(state: WorkspaceState, memberId?: string): Task[] {
  const id = memberId ?? state.currentMemberId;
  return allTasks(state).filter(
    (t) => !t.archived && t.assignees.some((a) => a.id === id),
  );
}

export function assignedToMe(state: WorkspaceState): Task[] {
  return myTasks(state, state.currentMemberId);
}

export function openMyTasks(state: WorkspaceState, memberId?: string): Task[] {
  return myTasks(state, memberId).filter((t) => !isDone(t));
}

export function recents(state: WorkspaceState, limit = RECENTS_LIMIT): Task[] {
  return allTasks(state)
    .filter((t) => !t.archived)
    .sort((a, b) => (b.dateUpdated ?? 0) - (a.dateUpdated ?? 0))
    .slice(0, limit);
}

export function taskCountForList(state: WorkspaceState, listId: string): number {
  return tasksByList(state, listId).length;
}

// --- status set selector ------------------------------------------------

/**
 * Memo cache for derived status sets. `useStatusColumns`/`buildGroups` call
 * `listStatusDefs` on every render; without a stable reference the downstream
 * `useShallow`/`useMemo` would see a fresh array each time and loop ("Maximum
 * update depth"). We cache by listId and invalidate only when the SET of
 * statuses present on the list actually changes (its fingerprint), so adding a
 * task with an existing status returns the SAME array reference.
 */
interface StatusDefsCacheEntry {
  fingerprint: string;
  defs: StatusDef[];
}
const statusDefsCache = new Map<string, StatusDefsCacheEntry>();
/** Sentinel fingerprint for seeded sets — they never change at runtime. */
const SEEDED_FINGERPRINT = '__seeded__';

/**
 * The ordered status definitions a list shows as columns/groups, including
 * statuses with zero tasks. Seeded lists (e.g. Project 1) return their exact
 * transcribed set; every other list derives its set from the statuses present
 * on its tasks plus the standard ClickUp defaults.
 *
 * The returned array reference is stable across calls until the underlying
 * status set changes — safe to feed straight into a selector/`useMemo` dep.
 */
export function listStatusDefs(state: WorkspaceState, listId: string): StatusDef[] {
  const seeded = SEEDED_STATUS_SETS[listId];
  if (seeded) {
    const cached = statusDefsCache.get(listId);
    if (cached && cached.fingerprint === SEEDED_FINGERPRINT) return cached.defs;
    const defs = orderStatusDefs(seeded);
    statusDefsCache.set(listId, { fingerprint: SEEDED_FINGERPRINT, defs });
    return defs;
  }

  // Distinct (label, color, type) tuples observed on the list's tasks.
  const observed = new Map<string, { label: string; color: string; statusType: string }>();
  for (const t of allTasks(state)) {
    if (t.listId !== listId || t.archived) continue;
    const label = t.status.toLowerCase();
    if (observed.has(label)) continue;
    observed.set(label, {
      label,
      color: t.statusColor || '#87909e',
      statusType: t.statusType || 'open',
    });
  }

  const fingerprint = [...observed.values()]
    .map((o) => `${o.label}|${o.color}|${o.statusType}`)
    .sort()
    .join(';');

  const cached = statusDefsCache.get(listId);
  if (cached && cached.fingerprint === fingerprint) return cached.defs;

  const defs = deriveStatusDefs(listId, [...observed.values()]);
  statusDefsCache.set(listId, { fingerprint, defs });
  return defs;
}

// --- tree selectors -----------------------------------------------------

export function spaces(state: WorkspaceState): SpaceNode[] {
  return state.tree.spaces;
}

export interface ResolvedNode {
  space: SpaceNode;
  folder?: FolderNode;
  list?: ListNode;
}

export function findList(
  state: WorkspaceState,
  listId: string,
): ResolvedNode | null {
  for (const space of state.tree.spaces) {
    const fl = space.folderlessLists.find((l) => l.id === listId);
    if (fl) return { space, list: fl };
    for (const folder of space.folders) {
      const list = folder.lists.find((l) => l.id === listId);
      if (list) return { space, folder, list };
    }
  }
  return null;
}

export function isExpanded(state: WorkspaceState, nodeId: string): boolean {
  return Boolean(state.expanded[nodeId]);
}

// --- chat selectors -----------------------------------------------------

export function channels(state: WorkspaceState): Channel[] {
  return state.channels;
}

export function messagesByChannel(
  state: WorkspaceState,
  channelId: string,
): Message[] {
  return state.messages[channelId] ?? [];
}

// --- favorites ----------------------------------------------------------

export function favorites(state: WorkspaceState): string[] {
  return state.favorites;
}

export function isFavorite(state: WorkspaceState, nodeId: string): boolean {
  return state.favorites.includes(nodeId);
}
