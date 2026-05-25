/**
 * Priority frontier for the crawler.
 *
 * Replaces the plain FIFO BFS queue. The frontier is ordered so that
 * UNEXPLORED work is dequeued first:
 *   - higher `priority` (never-visited routes / states) before lower
 *   - within equal priority, lower `depth` first (breadth-first-ish:
 *     completeness over depth)
 *   - within equal priority + depth, FIFO insertion order (stable)
 *
 * This is intentionally a simple ordered scan rather than a binary heap: the
 * frontier is small (bounded by budget caps) and a linear `dequeue` keeps the
 * ordering rules trivially correct and stable. Budget caps in the crawler are
 * unaffected — this only changes the ORDER items come out, not which items run.
 */

import type { QueueItem } from './types';

/** Priority tiers. Higher = explored sooner. */
export const PRIORITY_NEW_ROUTE = 100;
export const PRIORITY_DEFAULT = 0;
export const PRIORITY_REVISIT = -50;

export type PriorityQueue = {
  push(item: QueueItem): void;
  /** Remove and return the highest-priority, shallowest, oldest item. */
  dequeue(): QueueItem | null;
  get length(): number;
};

export function createPriorityQueue(initial: QueueItem[] = []): PriorityQueue {
  // Monotonic sequence to preserve FIFO order within an equal priority+depth.
  let seq = 0;
  const items: { item: QueueItem; seq: number }[] = [];

  const push = (item: QueueItem): void => {
    items.push({ item, seq: seq++ });
  };

  for (const it of initial) push(it);

  const score = (entry: { item: QueueItem }): number =>
    entry.item.priority ?? PRIORITY_DEFAULT;

  const dequeue = (): QueueItem | null => {
    if (items.length === 0) return null;
    let bestIdx = 0;
    for (let i = 1; i < items.length; i++) {
      const a = items[i];
      const b = items[bestIdx];
      const aScore = score(a);
      const bScore = score(b);
      if (aScore > bScore) {
        bestIdx = i;
        continue;
      }
      if (aScore < bScore) continue;
      // Equal priority: prefer shallower depth (breadth-first-ish).
      if (a.item.depth < b.item.depth) {
        bestIdx = i;
        continue;
      }
      if (a.item.depth > b.item.depth) continue;
      // Equal priority + depth: FIFO by insertion order.
      if (a.seq < b.seq) bestIdx = i;
    }
    const [picked] = items.splice(bestIdx, 1);
    return picked.item;
  };

  return {
    push,
    dequeue,
    get length(): number {
      return items.length;
    },
  };
}
