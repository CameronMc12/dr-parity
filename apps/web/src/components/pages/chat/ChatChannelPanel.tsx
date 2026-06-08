'use client';

/**
 * Chat-section channel thread. Channel header (# + name), the live message list
 * (useMessagesByChannel), and the upgraded composer. Send calls sendMessage,
 * which persists through the workspace store. Reuses ChannelPage's working store
 * wiring but with the full ClickUp composer toolbar.
 */

import { useWorkspaceStore } from '@/store/workspace';
import { useChannels, useCurrentMemberId, useMembers, useMessagesByChannel } from '@/store/workspace/hooks';
import { PageSurface } from '../page-primitives';
import { ChatMessageList } from './ChatMessageList';
import { ChatThreadComposer } from './ChatThreadComposer';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const BORDER = 'var(--cu-border-divider)';

export function ChatChannelPanel({ channelId }: { channelId: string }) {
  const channels = useChannels();
  const members = useMembers();
  const messages = useMessagesByChannel(channelId);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const currentMemberId = useCurrentMemberId();

  const channel = channels.find((c) => c.id === channelId);
  const name = channel?.name ?? 'channel';

  return (
    <PageSurface>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 24px',
          height: 52,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, color: TEXT_MUTED, fontWeight: 700 }}>#</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>{name}</span>
      </div>

      <ChatMessageList
        testid="channel-messages"
        lines={messages}
        members={members}
        currentMemberId={currentMemberId}
        emptyLabel={
          <>
            This is the start of the <strong>#{name}</strong> channel. Send the first message.
          </>
        }
      />

      <ChatThreadComposer
        placeholder={`Write to ${name}, press 'space' for AI, '/' for commands`}
        showMessagePill
        onSend={(text) => sendMessage(channelId, text)}
      />
    </PageSurface>
  );
}
