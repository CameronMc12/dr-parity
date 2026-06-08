'use client';

/**
 * Shared rich thread renderer for Chat-section channel + DM threads. Brings the
 * polished ChatView treatment to store-backed threads: author avatars + names +
 * timestamps, consecutive-message grouping, day dividers, an on-hover quick
 * reaction bar, toggleable reaction chips, a friendly empty state, and a faked
 * typing indicator. Reactions are held in local component state (keyed by message
 * id) so the read-only store Message/DmMessage shapes stay untouched.
 *
 * Auto-scrolls to the newest line on append. Used by ChatChannelPanel,
 * ChatDmPanel and ChannelPage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Member } from '@/store/workspace/types';
import { CHAT } from '../chatview/chat-tokens';
import { ChatMessageRow } from '../chatview/ChatMessageRow';
import type { ChatMessage } from '../chatview/chat-messages';
import { dayKey, dayLabel } from '../chatview/chat-messages';

const GROUP_WINDOW_MS = 5 * 60_000;

/** Minimal line shape both Message and DmMessage satisfy. */
export interface ThreadLine {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

function DayDivider({ ms }: { ms: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 16px 8px',
        userSelect: 'none',
      }}
    >
      <span style={{ flex: 1, height: 1, background: CHAT.border }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: CHAT.textMuted,
          padding: '2px 10px',
          borderRadius: 10,
          border: `1px solid ${CHAT.border}`,
          background: CHAT.inputBg,
          whiteSpace: 'nowrap',
        }}
      >
        {dayLabel(ms)}
      </span>
      <span style={{ flex: 1, height: 1, background: CHAT.border }} />
    </div>
  );
}

function TypingIndicator({ name, color }: { name: string; color: string }) {
  return (
    <div
      data-testid="chat-typing-indicator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 16px 10px',
        color: CHAT.textMuted,
      }}
    >
      <span
        style={{
          width: CHAT.avatarSize,
          height: CHAT.avatarSize,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: CHAT.textMuted,
              animation: 'cu-chat-typing 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
      <span style={{ fontSize: 12 }}>{name} is typing…</span>
    </div>
  );
}

export interface RichThreadProps {
  lines: ThreadLine[];
  members: Member[];
  /** Friendly heading shown when there are no messages yet. */
  emptyTitle: string;
  /** Supporting line shown beneath the empty-state heading. */
  emptySubtitle: React.ReactNode;
  /** When set, a faked typing indicator renders beneath the transcript. */
  typingMember?: Member;
  testid: string;
}

export function RichThread({
  lines,
  members,
  emptyTitle,
  emptySubtitle,
  typingMember,
  testid,
}: RichThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const messages = useMemo<ChatMessage[]>(
    () =>
      [...lines]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((line) => ({
          id: line.id,
          authorId: line.authorId,
          text: line.text,
          createdAt: line.createdAt,
          reactions: reactions[line.id] ?? {},
          system: false,
        })),
    [lines, reactions],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingMember]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    setReactions((prev) => {
      const current = { ...(prev[messageId] ?? {}) };
      if (current[emoji]) {
        current[emoji] -= 1;
        if (current[emoji] <= 0) delete current[emoji];
      } else {
        current[emoji] = 1;
      }
      return { ...prev, [messageId]: current };
    });
  }, []);

  let prevDay = '';
  let prevAuthor = '';
  let prevTime = 0;

  return (
    <div
      ref={scrollRef}
      data-testid={testid}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 0' }}
    >
      <style>{'@keyframes cu-chat-typing{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}'}</style>
      {messages.length === 0 ? (
        <div
          data-testid="chat-empty-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '40px 24px',
            color: CHAT.textMuted,
            fontSize: 13,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: CHAT.textSecondary }}>
            {emptyTitle}
          </span>
          <span>{emptySubtitle}</span>
        </div>
      ) : (
        messages.map((m) => {
          const key = dayKey(m.createdAt);
          const showDivider = key !== prevDay;
          const grouped =
            !showDivider &&
            m.authorId === prevAuthor &&
            m.createdAt - prevTime < GROUP_WINDOW_MS;
          prevDay = key;
          prevAuthor = m.authorId;
          prevTime = m.createdAt;
          return (
            <div key={m.id}>
              {showDivider && <DayDivider ms={m.createdAt} />}
              <ChatMessageRow
                message={m}
                author={memberById.get(m.authorId)}
                grouped={grouped}
                onReact={handleReact}
              />
            </div>
          );
        })
      )}
      {typingMember && (
        <TypingIndicator name={typingMember.name} color={typingMember.color} />
      )}
    </div>
  );
}
