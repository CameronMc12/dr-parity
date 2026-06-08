'use client';

/**
 * Home → Channel chat view (/chat/r/<channelId>). Renders the channel header,
 * the rich live transcript (avatars, grouping, day dividers, hover reactions via
 * RichThread), and the full ClickUp composer pinned to the bottom. Send calls
 * sendMessage(channelId, text); the new message appears immediately and persists
 * through the workspace store's localStorage layer.
 */

import { useWorkspaceStore } from '@/store/workspace';
import { useChannels, useMembers, useMessagesByChannel } from '@/store/workspace/hooks';
import { ChannelThreadHeader } from './chat/ChannelThreadHeader';
import { RichThread } from './chat/RichThread';
import { ChatThreadComposer } from './chat/ChatThreadComposer';
import { PageSurface } from './page-primitives';

export function ChannelPage({ channelId }: { channelId: string }) {
  const channels = useChannels();
  const members = useMembers();
  const messages = useMessagesByChannel(channelId);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);

  const channel = channels.find((c) => c.id === channelId);
  const name = channel?.name ?? 'Channel';

  return (
    <PageSurface>
      <ChannelThreadHeader name={name} memberCount={members.length} />

      <RichThread
        testid="channel-messages"
        lines={messages}
        members={members}
        emptyTitle={`This is the start of #${name}.`}
        emptySubtitle="Send the first message to get the conversation going."
      />

      <ChatThreadComposer
        placeholder={`Write to ${name}, press 'space' for AI, '/' for commands`}
        showMessagePill
        onSend={(text) => sendMessage(channelId, text)}
      />
    </PageSurface>
  );
}
