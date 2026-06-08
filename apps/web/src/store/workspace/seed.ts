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
  DirectMessage,
  DmMessage,
  DocNode,
  Member,
  RecentItem,
  Task,
  WorkspaceTree,
} from './types';

/** Seeded channel list — mirrors the real ClickUp Chat sidebar order/labels. */
export const SEED_CHANNELS: Channel[] = [
  { id: 'ch-project-1', name: 'Project 1', listId: '901523542898' },
  { id: 'ch-ab-content', name: 'AB Content Management', listId: '901523547043' },
  { id: 'ch-demo', name: 'DEMO', listId: '901523546368' },
  { id: 'ch-test', name: 'TEST', listId: '901523546362' },
  { id: 'ch-general', name: "General - Cameron Mc's Workspace" },
  { id: 'ch-welcome', name: 'Welcome' },
];

/** Channel ids that render with a workspace badge (green "C") instead of a hash. */
export const WORKSPACE_BADGE_CHANNEL_IDS = new Set(['ch-general']);

/** Channel ids that render with the plain "#" glyph (no list rows). */
export const PLAIN_HASH_CHANNEL_IDS = new Set(['ch-welcome']);

/** The workspace owner id, used to derive the self-DM and DM participant sets. */
const OWNER_ID = (membersJson as Member[])[0]?.id ?? 'me';

/** Synthetic member backing the "Onboarding Assistant" DM in the reference. */
export const ONBOARDING_ASSISTANT: Member = {
  id: 'm-onboarding-assistant',
  name: 'Onboarding Assistant',
  initials: 'OA',
  color: '#7b68ee',
  email: 'assistant@clickup.com',
  roleKey: 'bot',
};

/** Seed DMs: one with the Onboarding Assistant, one self-DM (Cameron Mc — You). */
export const SEED_DMS: DirectMessage[] = [
  { id: 'dm-onboarding', memberIds: [OWNER_ID, ONBOARDING_ASSISTANT.id].sort() },
  { id: 'dm-self', memberIds: [OWNER_ID] },
];

/** Seeded DM messages so the threads aren't empty on first open. */
const SEED_DM_MESSAGES: Record<string, DmMessage[]> = {
  'dm-onboarding': [
    {
      id: 'dmsg-seed-1',
      dmId: 'dm-onboarding',
      authorId: ONBOARDING_ASSISTANT.id,
      text: "Welcome to ClickUp! I'm here to help you get set up. Ask me anything.",
      createdAt: 1_716_000_000_000,
    },
  ],
  'dm-self': [],
};

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
  return [...structuredClone(membersJson as Member[]), { ...ONBOARDING_ASSISTANT }];
}

export function seedDms(): DirectMessage[] {
  return structuredClone(SEED_DMS);
}

export function seedDmMessages(): Record<string, DmMessage[]> {
  return structuredClone(SEED_DM_MESSAGES);
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
