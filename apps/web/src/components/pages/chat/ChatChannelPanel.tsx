'use client';

/**
 * Chat-section channel thread. A slim channel header (# + name + member count +
 * settings icon), the rich live transcript (avatars, grouping, day dividers,
 * hover reactions) reading useMessagesByChannel, and the full ClickUp composer.
 * Send calls sendMessage, which persists through the workspace store.
 */

import { useWorkspaceStore } from '@/store/workspace';
import {
  useChannels,
  useMembers,
  useMessagesByChannel,
} from '@/store/workspace/hooks';
import { PageSurface } from '../page-primitives';
import { ChannelThreadHeader } from './ChannelThreadHeader';
import { RichThread } from './RichThread';
import { ChatThreadComposer } from './ChatThreadComposer';

export function ChatChannelPanel({ channelId }: { channelId: string }) {
  const channels = useChannels();
  const members = useMembers();
  const messages = useMessagesByChannel(channelId);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);

  const channel = channels.find((c) => c.id === channelId);
  const name = channel?.name ?? 'channel';

  return (
    <PageSurface>
      <ChannelThreadHeader name={name} memberCount={members.length} />

      <RichThread
        testid="channel-messages"
        lines={messages}
        members={members}
        emptyTitle={`This is the start of #${name}.`}
        emptySubtitle="Send the first message to kick off the channel."
      />

      <ChatThreadComposer
        placeholder={`Write to ${name}, press 'space' for AI, '/' for commands`}
        showMessagePill
        onSend={(text) => sendMessage(channelId, text)}
      />
    </PageSurface>
  );
}
