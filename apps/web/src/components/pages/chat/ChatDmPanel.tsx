'use client';

/**
 * Chat-section direct-message thread. Header shows the other member's avatar +
 * online dot + derived title and a settings affordance; the rich transcript
 * (avatars, grouping, day dividers, hover reactions) reads dmMessages bucketed by
 * dm id; Send calls sendDirectMessage, which persists through the workspace store.
 * After you send, the other participant shows a short faked "typing…" indicator.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId, useDmMessages, useDms, useMembers } from '@/store/workspace/hooks';
import type { Member } from '@/store/workspace/types';
import { CHAT } from '../chatview/chat-tokens';
import { PageSurface } from '../page-primitives';
import { RichThread } from './RichThread';
import { ChatThreadComposer } from './ChatThreadComposer';
import { GearIcon } from './chat-tool-icons';
import { dmDisplay } from './dm-title';

const TYPING_MS = 1800;

function HeaderAvatar({ member }: { member?: Member }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: member?.color ?? '#7b68ee',
          color: 'white',
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {member?.initials ?? '?'}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: 'rgb(76, 191, 110)',
          border: '2px solid var(--cu-bg-app, #fff)',
        }}
      />
    </span>
  );
}

function SettingsButton() {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label="Conversation settings"
      title="Conversation settings"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 28,
        width: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? CHAT.hoverBg : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: CHAT.textMuted,
        flexShrink: 0,
      }}
    >
      <GearIcon size={16} />
    </button>
  );
}

export function ChatDmPanel({ dmId }: { dmId: string }) {
  const dms = useDms();
  const members = useMembers();
  const lines = useDmMessages(dmId);
  const currentMemberId = useCurrentMemberId();
  const sendDirectMessage = useWorkspaceStore((s) => s.sendDirectMessage);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const dm = dms.find((d) => d.id === dmId);
  const display = dm
    ? dmDisplay(dm, currentMemberId, memberById)
    : { title: 'Direct Message', other: undefined, isSelf: false };

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  const handleSend = (text: string) => {
    sendDirectMessage(dmId, text);
    if (display.other && !display.isSelf) {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_MS);
    }
  };

  return (
    <PageSurface>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px 0 24px',
          height: 52,
          borderBottom: `1px solid ${CHAT.border}`,
          flexShrink: 0,
        }}
      >
        <HeaderAvatar member={display.other} />
        <span style={{ fontSize: 15, fontWeight: 600, color: CHAT.textPrimary }}>
          {display.title}
        </span>
        <span style={{ flex: 1 }} />
        <SettingsButton />
      </div>

      <RichThread
        testid="dm-messages"
        lines={lines}
        members={members}
        emptyTitle={display.isSelf ? 'This is your personal space.' : `Say hi to ${display.title}.`}
        emptySubtitle={
          display.isSelf ? (
            'Jot notes, draft messages, or keep links handy.'
          ) : (
            <>This is the start of your conversation with <strong>{display.title}</strong>.</>
          )
        }
        typingMember={typing ? display.other : undefined}
      />

      <ChatThreadComposer
        placeholder={`Write to ${display.other?.name ?? display.title}, press 'space' for AI, '/' for commands`}
        showMessagePill
        onSend={handleSend}
      />
    </PageSurface>
  );
}
