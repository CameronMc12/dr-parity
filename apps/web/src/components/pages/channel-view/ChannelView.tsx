'use client';

/**
 * The "Channel" view body for list-backed channels. Renders inside the list's
 * ViewShell with the Channel location header and view-tabs bar above. The content
 * is a horizontal split: a conversation column (Bookmark tile + empty state OR
 * live thread, then the composer) and a right-edge icon rail. Send persists via
 * sendMessage(channelId).
 *
 * The channel is resolved from the scope's listId (a list-backed channel links to
 * its list via channel.listId). If no channel matches the list, nothing renders —
 * the route only mounts this body for list-backed channels.
 */

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useChannelByListId,
  useCurrentMemberId,
  useMembers,
  useMessagesByChannel,
} from '@/store/workspace/hooks';
import type { ViewScope } from '@/lib/view-scope';
import { ViewShell } from '@/components/views/ViewShell';
import { ChatMessageList } from '../chat/ChatMessageList';
import { ChannelComposer } from './ChannelComposer';
import { ChannelEmptyState } from './ChannelEmptyState';
import { ChannelRail } from './ChannelRail';
import { ChannelHeader } from './ChannelHeader';

const APP_BG = 'var(--cu-bg-app)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const HOVER_BG = 'var(--cu-bg-hover)';
const BORDER = 'var(--cu-border-divider)';

function BookmarkTile() {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="channel-bookmark-tile"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        margin: '14px 0 0 24px',
        padding: '6px 10px',
        background: hover ? HOVER_BG : 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 12,
        fontFamily: 'inherit',
        alignSelf: 'flex-start',
      }}
    >
      <span style={{ display: 'flex' }} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
      Bookmark tasks, add notes, and more
    </button>
  );
}

export function ChannelView({ scope, viewId }: { scope: ViewScope; viewId?: string }) {
  const listId = scope.kind === 'list' ? scope.listId : null;
  const channel = useChannelByListId(listId);
  const channelId = channel?.id ?? '';
  const name = channel?.name ?? 'channel';

  const members = useMembers();
  const currentMemberId = useCurrentMemberId();
  const messages = useMessagesByChannel(channelId);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);

  return (
    <ViewShell
      code="channel"
      viewId={viewId ?? (scope.kind === 'list' ? scope.listId : channelId)}
      scope={scope}
      showAddChannel={false}
      header={<ChannelHeader scope={scope} listId={listId ?? ''} />}
    >
      {!channel ? null : (
        <div style={{ display: 'flex', height: '100%', minHeight: 0, background: APP_BG }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <BookmarkTile />
            {messages.length === 0 ? (
              <ChannelEmptyState channelName={name} />
            ) : (
              <ChatMessageList
                testid="channel-view-messages"
                lines={messages}
                members={members}
                currentMemberId={currentMemberId}
                emptyLabel={null}
              />
            )}
            <ChannelComposer
              channelName={name}
              onSend={(text) => sendMessage(channelId, text)}
            />
          </div>
          <ChannelRail count={1} />
        </div>
      )}
    </ViewShell>
  );
}
