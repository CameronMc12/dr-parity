/**
 * Tab ordering for a list-backed Channel view. When the view set contains a
 * synthetic Channel tab (code 'channel', injected first), ClickUp groups the
 * remaining views as: pinned [Team, Whiteboard, Activity, Map] then everything
 * else in stored order. Without a Channel tab the order is returned untouched so
 * normal list/space/folder tab strips are unaffected.
 */

import { PINNED_CHANNEL_CODES } from '@/lib/view-types';
import type { View } from '@/store/views/types';

export interface OrderedTabs {
  /** The Channel tab, when present (renders first, followed by a divider). */
  channel: View | null;
  /** Pinned views [Team, Whiteboard, Activity, Map] in that order. */
  pinned: View[];
  /** Remaining views in stored order. */
  rest: View[];
}

const PINNED_RANK = new Map(PINNED_CHANNEL_CODES.map((code, i) => [code, i]));

export function orderChannelTabs(views: View[]): OrderedTabs {
  const channel = views.find((v) => v.code === 'channel') ?? null;
  if (!channel) return { channel: null, pinned: [], rest: views };

  const pinned: View[] = [];
  const rest: View[] = [];
  for (const v of views) {
    if (v.code === 'channel') continue;
    if (PINNED_RANK.has(v.code)) pinned.push(v);
    else rest.push(v);
  }
  pinned.sort((a, b) => (PINNED_RANK.get(a.code)! - PINNED_RANK.get(b.code)!));
  return { channel, pinned, rest };
}
