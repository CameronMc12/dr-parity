'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useChannels,
  useCurrentMemberId,
  useMessagesByChannel,
} from '@/store/workspace/hooks';
import type { Member } from '@/store/workspace/types';
import { PageSurface } from './page-primitives';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32, 32, 32))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(80, 80, 80))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130, 130, 130))';
const BORDER = 'var(--cu-border-divider, rgb(232, 232, 232))';
const ACCENT = 'rgb(123, 104, 238)';

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ member }: { member?: Member }) {
  const initials = member?.initials ?? '?';
  const color = member?.color ?? '#7b68ee';
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Home → Channel chat view. Renders the channel header, the live message list
 * (useMessagesByChannel), and a composer pinned to the bottom. Enter / Send
 * calls sendMessage(channelId, text); the new message appears immediately and
 * persists through the workspace store's localStorage layer.
 */
export function ChannelPage({ channelId }: { channelId: string }) {
  const channels = useChannels();
  const messages = useMessagesByChannel(channelId);
  const members = useWorkspaceStore((s) => s.members);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const currentMemberId = useCurrentMemberId();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const channel = channels.find((c) => c.id === channelId);
  const memberById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(channelId, text);
    setDraft('');
  };

  return (
    <PageSurface>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 24,
          paddingRight: 24,
          height: 52,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, color: TEXT_MUTED, fontWeight: 700 }}>#</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>
          {channel?.name ?? 'Channel'}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        data-testid="channel-messages"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
      >
        {messages.length === 0 ? (
          <div style={{ color: TEXT_MUTED, fontSize: 13, paddingTop: 8 }}>
            This is the start of the <strong>#{channel?.name ?? 'channel'}</strong> channel.
            Send the first message.
          </div>
        ) : (
          messages.map((m) => {
            const author = memberById[m.authorId];
            return (
              <div
                key={m.id}
                data-testid="channel-message"
                style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}
              >
                <Avatar member={author} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                      {author?.name ?? (m.authorId === currentMemberId ? 'You' : 'Member')}
                    </span>
                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>{timeLabel(m.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_SECONDARY, whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: '12px 24px 20px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: 8,
          }}
        >
          <textarea
            data-testid="channel-composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Message #${channel?.name ?? 'channel'}`}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              lineHeight: '20px',
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
              background: 'transparent',
              maxHeight: 160,
            }}
          />
          <button
            data-testid="channel-send"
            onClick={submit}
            disabled={!draft.trim()}
            style={{
              height: 30,
              paddingLeft: 14,
              paddingRight: 14,
              borderRadius: 6,
              border: 'none',
              background: draft.trim() ? ACCENT : 'var(--cu-bg-strong)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: draft.trim() ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </PageSurface>
  );
}
