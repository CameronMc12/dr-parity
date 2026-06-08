'use client';

/**
 * Prepends a synthetic "Channel" view to a list scope's stored/templated views
 * when that list has an associated chat channel (channel.listId === listId).
 * Lists with no channel — and every space/folder scope — get the untouched view
 * set. The synthetic Channel view's instance id is the channel id so the route
 * /<ws>/chat/c/<channelId> and the tab share one identity.
 *
 * Stable-ref rule: the combined array is memoised on the stored-views reference
 * (already useShallow-stable) plus the channel id, so repeated reads return the
 * same reference and never spin a render loop.
 */

import { useMemo } from 'react';
import { useScopeViews } from '@/store/views/hooks';
import { useChannelByListId } from '@/store/workspace/hooks';
import { scopeKey, type ViewScope } from '@/lib/view-scope';
import { defaultViewName } from '@/store/views/template';
import type { View } from '@/store/views/types';

const CHANNEL_CODE = 'channel';

/** Build the synthetic Channel view bound to a channel + list scope. */
function channelView(channelId: string, listScopeKey: string): View {
  return {
    id: channelId,
    code: CHANNEL_CODE,
    name: defaultViewName(CHANNEL_CODE),
    scopeKey: listScopeKey,
    listId: listScopeKey,
  };
}

/**
 * The views a scope shows, with a leading Channel tab for list-backed channels.
 * Only list scopes can have a channel; space/folder scopes pass through.
 */
export function useScopeViewsWithChannel(scope: ViewScope): View[] {
  const key = scopeKey(scope);
  const views = useScopeViews(key);
  const listId = scope.kind === 'list' ? scope.listId : null;
  const channel = useChannelByListId(listId);
  const channelId = channel?.id ?? null;
  return useMemo(() => {
    if (!channelId || listId === null) return views;
    if (views.some((v) => v.code === CHANNEL_CODE)) return views;
    return [channelView(channelId, listId), ...views];
  }, [views, channelId, listId]);
}
