/**
 * Seed builders. Convert the captured/trimmed JSON exports into the in-memory
 * shapes the store holds. Pure functions — no side effects, no randomness.
 */

import treeJson from '@/data/workspace-tree.json';
import tasksJson from '@/data/tasks-seed.json';
import membersJson from '@/data/members-seed.json';
import { DOCS_TREE } from '@/data/docs-tree';
import { RECENTS } from '@/data/home-dashboard';
import type {
  Channel,
  DocNode,
  Member,
  RecentItem,
  Task,
  WorkspaceTree,
} from './types';

/** Seeded channel list — mirrors the hardcoded Home sidebar list. */
export const SEED_CHANNELS: Channel[] = [
  { id: 'ch-ab-content', name: 'AB Content Management' },
  { id: 'ch-demo', name: 'DEMO' },
  { id: 'ch-test', name: 'TEST' },
  { id: 'ch-general', name: 'General' },
  { id: 'ch-welcome', name: 'Welcome' },
];

export function seedTree(): WorkspaceTree {
  return structuredClone(treeJson as WorkspaceTree);
}

export function seedTasks(): Record<string, Task> {
  const list = tasksJson as Partial<Task>[];
  const byId: Record<string, Task> = {};
  // Deterministic per-sibling-group order index for seed tasks that predate the
  // `order` field, so manual reorder has a stable starting sequence.
  const cursor: Record<string, number> = {};
  for (const raw of list) {
    const key = `${raw.listId}::${raw.parent ?? ''}`;
    const order = raw.order ?? (cursor[key] = (cursor[key] ?? -1) + 1);
    const task = { ...raw, order, tags: raw.tags ?? [] } as Task;
    byId[task.id] = task;
  }
  return byId;
}

export function seedMembers(): Member[] {
  return structuredClone(membersJson as Member[]);
}

export function seedChannels(): Channel[] {
  return structuredClone(SEED_CHANNELS);
}

export function seedDocs(): DocNode[] {
  return structuredClone(DOCS_TREE as DocNode[]);
}

export function seedRecents(): RecentItem[] {
  return structuredClone(RECENTS as RecentItem[]);
}

/** The current member — the export only contains the workspace owner. */
export function seedCurrentMemberId(): string {
  const members = membersJson as Member[];
  return members[0]?.id ?? 'me';
}

/** Default expanded sidebar state: every space open, folders/lists closed. */
export function seedExpanded(): Record<string, boolean> {
  const tree = treeJson as WorkspaceTree;
  const expanded: Record<string, boolean> = {};
  for (const space of tree.spaces) expanded[space.id] = true;
  return expanded;
}
