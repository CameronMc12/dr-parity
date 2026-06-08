'use client';

/**
 * Chat-section channel route resolver. A list-backed channel (channel.listId set)
 * opens the list's full view-tabs Channel view via ScopeViewRoute; a pure channel
 * opens the plain chat thread. Mounted at /<ws>/chat/c/<channelId>; the Chat
 * sidebar stays active either way.
 */

import { useChannelById } from '@/store/workspace/hooks';
import { ScopeViewRoute } from '@/components/views/ScopeViewRoute';
import { ChatChannelPanel } from '../chat/ChatChannelPanel';

export function ChatChannelRoute({ channelId }: { channelId: string }) {
  const channel = useChannelById(channelId);

  if (channel?.listId) {
    return (
      <ScopeViewRoute
        scope={{ kind: 'list', listId: channel.listId }}
        code="channel"
        viewId={channelId}
      />
    );
  }

  return <ChatChannelPanel channelId={channelId} />;
}
