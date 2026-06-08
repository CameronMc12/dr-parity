/**
 * Seeds the full ClickUp view set onto the lists that back a chat channel, so a
 * list-backed Channel view shows the same rich tab strip the real app does
 * (Channel + Team/Whiteboard/Activity/Map pinned + List/Board/Calendar/Gantt/
 * Table/… unpinned + overflow + View). Pure list ids — the channel→list mapping
 * lives in the workspace seed. Idempotent: only seeds a list with no stored
 * override, so user edits and re-hydration never clobber real data.
 */

import { useViewsStore } from './index';
import { deriveViewId, defaultViewName } from './template';
import type { View } from './types';

/** List ids backing the seeded chat channels (mirrors SEED_CHANNELS.listId). */
export const CHANNEL_BACKED_LIST_IDS = [
  '901523542898', // Project 1
  '901523547043', // AB Content Management
  '901523546368', // DEMO
  '901523546362', // TEST
] as const;

/**
 * Full tab set for a list-backed channel, in ClickUp order. The Channel tab
 * itself is injected separately (synthetic, first) by useScopeViewsWithChannel;
 * this is everything that follows it. Pinned views render before unpinned.
 */
const CHANNEL_LIST_VIEW_CODES: readonly string[] = [
  // pinned
  'team',
  'wb',
  'act',
  'map',
  // unpinned
  'l',
  'b',
  'cal',
  'gtt',
  'tbl',
  'mm',
  'dc',
  'form',
  'dash',
  'tl',
  'wl',
  'embed',
];

/** Build the concrete View[] for a list scope from the channel code set. */
function buildChannelListViews(listId: string): View[] {
  const ordinals: Record<string, number> = {};
  return CHANNEL_LIST_VIEW_CODES.map((code) => {
    const n = (ordinals[code] = (ordinals[code] ?? 0) + 1);
    // First instance of a code keeps the bare listId id (matches the default
    // template contract so list URLs stay /<ws>/v/<code>/<listId>); extras get
    // a derived id.
    const id = n === 1 ? listId : deriveViewId(listId, code, n);
    return { id, code, name: defaultViewName(code), scopeKey: listId, listId };
  });
}

/** Seed the channel-backed lists' view sets once (idempotent, client-only). */
export function seedChannelListViews(): void {
  const store = useViewsStore.getState();
  const stored = store.views;
  const next: Record<string, View[]> = {};
  for (const listId of CHANNEL_BACKED_LIST_IDS) {
    if (stored[listId] && stored[listId].length > 0) continue;
    next[listId] = buildChannelListViews(listId);
  }
  if (Object.keys(next).length === 0) return;
  useViewsStore.setState((s) => ({ views: { ...s.views, ...next } }));
}
