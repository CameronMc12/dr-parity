'use client';

/**
 * Shared scrolling message list for channel + DM threads. Auto-scrolls to the
 * newest message. Renders an avatar, author, timestamp, and the message body.
 * Accepts a normalised `ChatLine` shape so both Message and DmMessage can feed it.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { Member } from '@/store/workspace/types';

export interface ChatLine {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ member }: { member?: Member }) {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: member?.color ?? '#7b68ee',
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {member?.initials ?? '?'}
    </span>
  );
}

export function ChatMessageList({
  lines,
  members,
  currentMemberId,
  emptyLabel,
  testid,
}: {
  lines: ChatLine[];
  members: Member[];
  currentMemberId: string;
  emptyLabel: React.ReactNode;
  testid: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const memberById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={scrollRef}
      data-testid={testid}
      style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
    >
      {lines.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 13, paddingTop: 8 }}>{emptyLabel}</div>
      ) : (
        lines.map((line) => {
          const author = memberById[line.authorId];
          return (
            <div
              key={line.id}
              data-testid="chat-message"
              style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}
            >
              <Avatar member={author} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                    {author?.name ?? (line.authorId === currentMemberId ? 'You' : 'Member')}
                  </span>
                  <span style={{ fontSize: 11, color: TEXT_MUTED }}>{timeLabel(line.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: TEXT_SECONDARY, whiteSpace: 'pre-wrap' }}>
                  {line.text}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
