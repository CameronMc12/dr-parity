import { fixture } from '../../seed/fixture.js';
import {
  PRIORITY_VALUE,
  type DueAnchor,
  type SeedSubtask,
  type SeedTask,
} from '../../seed/types.js';

/**
 * Maps fixture entity `key`s to the REAL ClickUp ids from the seed manifest,
 * so fixture fallback values can be slotted into the correct real-id slot.
 */
export interface SeedManifest {
  marker: string;
  teamId: string;
  spaceId: string;
  ids: Record<string, string>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolve a DueAnchor to an epoch-ms string relative to a fixed base date. */
export function anchorToDate(anchor: DueAnchor | undefined, baseMs: number): string | null {
  if (!anchor || typeof anchor.offsetDays !== 'number') return null;
  return String(baseMs + anchor.offsetDays * DAY_MS);
}

export function priorityValue(p: SeedTask['priority']): number | null {
  if (p == null) return null;
  return PRIORITY_VALUE[p] ?? null;
}

/** Flatten every fixture task (top-level only) keyed by fixture key. */
export function fixtureTasksByKey(): Map<string, { task: SeedTask; listKey: string }> {
  const out = new Map<string, { task: SeedTask; listKey: string }>();
  const space = fixture.space;
  const addList = (listKey: string, tasks: SeedTask[]) => {
    for (const t of tasks) out.set(t.key, { task: t, listKey });
  };
  for (const folder of space.folders) {
    for (const list of folder.lists) addList(list.key, list.tasks);
  }
  for (const list of space.folderlessLists) addList(list.key, list.tasks);
  return out;
}

/** Every fixture subtask keyed by its fixture key, with its parent's key. */
export function fixtureSubtasksByKey(): Map<
  string,
  { subtask: SeedSubtask; parentKey: string; listKey: string }
> {
  const out = new Map<string, { subtask: SeedSubtask; parentKey: string; listKey: string }>();
  for (const [parentKey, { task, listKey }] of fixtureTasksByKey()) {
    for (const sub of task.subtasks ?? []) {
      out.set(sub.key, { subtask: sub, parentKey, listKey });
    }
  }
  return out;
}

export { fixture };
