/**
 * Deterministic seed messages for the Chat view. ClickUp Chat is a channel-style
 * thread attached to a List; activity references the list's own work. The seed is
 * derived purely from the view's REAL tasks (their names + statuses) and the
 * workspace member set — no lorem ipsum, no invented people. The same viewId
 * always yields the same transcript (FNV-1a hash over the id picks the cast and
 * timestamps), so renders are stable and the composer's appended messages slot in
 * after a fixed history.
 */

import { ANCHOR_NOW, DAY_MS } from '@/lib/view-data';
import type { Member, Task } from '@/store/workspace/types';

export interface ChatMessage {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
  /** Seeded reactions keyed by emoji -> count. Empty for fresh user messages. */
  reactions: Record<string, number>;
  /** True for the system/activity line style (italic, no bubble emphasis). */
  system: boolean;
}

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function hash(value: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], salt: string): T {
  const item = items[hash(salt) % items.length];
  if (item === undefined) throw new Error('pick called on empty list');
  return item;
}

/** Author for a synthetic line: prefer a real assignee, else the workspace owner. */
function authorFor(task: Task | undefined, members: Member[], salt: string): string {
  const assignee = task?.assignees?.[0]?.id;
  if (assignee) return assignee;
  if (members.length === 0) return 'me';
  return pick(members, salt).id;
}

type Template = (taskName: string, status: string) => { text: string; system: boolean };

const TEMPLATES: readonly Template[] = [
  (n, s) => ({ text: `moved ${n} to ${s}`, system: true }),
  (n) => ({ text: `Pushed the latest changes for ${n} — ready for a review when you get a sec.`, system: false }),
  (n) => ({ text: `Quick one: do we still need ${n} for this sprint, or can it roll over?`, system: false }),
  (n, s) => ({ text: `set the status of ${n} to ${s}`, system: true }),
  (n) => ({ text: `Wrapped up ${n}. Marking it done unless anyone objects.`, system: false }),
  (n) => ({ text: `Heads up, I added a couple of acceptance notes to ${n}.`, system: false }),
  (n) => ({ text: `left a comment on ${n}`, system: true }),
];

/**
 * Build the seeded transcript for a view. Picks up to six real tasks, threads one
 * templated line each, dated backwards from ANCHOR_NOW so the newest sits at the
 * bottom and a single day divider falls naturally between yesterday and today.
 */
export function buildSeedMessages(viewId: string, tasks: Task[], members: Member[]): ChatMessage[] {
  if (tasks.length === 0) return [];

  const cast = tasks.slice(0, 6);
  const out: ChatMessage[] = [];

  cast.forEach((task, i) => {
    const salt = `${viewId}:${task.id}:${i}`;
    const template = pick(TEMPLATES, salt);
    const built = template(task.name, task.status);
    // Newest message lands ~2h before the anchor; each older one steps back.
    const minutesBack = (cast.length - i) * 95 + (hash(salt) % 40);
    const createdAt = ANCHOR_NOW - minutesBack * 60_000;
    const reactionEmoji = pick(['👍', '🎉', '👀', '✅'] as const, `${salt}:r`);
    const reactions = hash(`${salt}:has`) % 3 === 0 ? { [reactionEmoji]: 1 + (hash(salt) % 3) } : {};
    out.push({
      id: `seed-${viewId}-${task.id}-${i}`,
      authorId: authorFor(task, members, salt),
      text: built.text,
      createdAt,
      reactions,
      system: built.system,
    });
  });

  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/** Local-day key (YYYY-MM-DD) used to break the stream into dated sections. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Deterministic, timezone-pinned formatters. Both server (UTC) and client must
 * render identical strings to avoid React hydration mismatches, so every label
 * is formatted against a fixed `en-US` locale and `UTC` time zone.
 */
const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

/** Friendly divider label: Today / Yesterday / weekday + date. */
export function dayLabel(ms: number): string {
  const todayKey = dayKey(ANCHOR_NOW);
  const yesterdayKey = dayKey(ANCHOR_NOW - DAY_MS);
  const key = dayKey(ms);
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  return dayFormatter.format(new Date(ms));
}

export function timeLabel(ms: number): string {
  return timeFormatter.format(new Date(ms));
}
