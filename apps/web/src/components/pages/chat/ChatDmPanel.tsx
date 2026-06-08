'use client';

/**
 * Chat-section direct-message thread. Header shows the other member's avatar +
 * derived title; the live message list reads dmMessages bucketed by dm id; Send
 * calls sendDirectMessage, which persists through the workspace store.
 */

import { useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId, useDmMessages, useDms, useMembers } from '@/store/workspace/hooks';
import type { Member } from '@/store/workspace/types';
import { PageSurface } from '../page-primitives';
import { ChatMessageList } from './ChatMessageList';
import { ChatThreadComposer } from './ChatThreadComposer';
import { dmDisplay } from './dm-title';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const BORDER = 'var(--cu-border-divider)';

function HeaderAvatar({ member }: { member?: Member }) {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: member?.color ?? '#7b68ee',
        color: 'white',
        fontSize: 10,
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

export function ChatDmPanel({ dmId }: { dmId: string }) {
  const dms = useDms();
  const members = useMembers();
  const lines = useDmMessages(dmId);
  const currentMemberId = useCurrentMemberId();
  const sendDirectMessage = useWorkspaceStore((s) => s.sendDirectMessage);

  const memberById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const dm = dms.find((d) => d.id === dmId);
  const display = dm
    ? dmDisplay(dm, currentMemberId, memberById)
    : { title: 'Direct Message', other: undefined, isSelf: false };

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
        <HeaderAvatar member={display.other} />
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>{display.title}</span>
      </div>

      <ChatMessageList
        testid="dm-messages"
        lines={lines}
        members={members}
        currentMemberId={currentMemberId}
        emptyLabel={
          <>
            This is the start of your conversation with <strong>{display.title}</strong>.
          </>
        }
      />

      <ChatThreadComposer
        placeholder={`Write to ${display.other?.name ?? display.title}, press 'space' for AI, '/' for commands`}
        showMessagePill
        onSend={(text) => sendDirectMessage(dmId, text)}
      />
    </PageSurface>
  );
}
