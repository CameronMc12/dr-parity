'use client';

/**
 * Default Chat-section panel ("New Direct Message"). A header, a full-width
 * people search that live-filters workspace members by name or email, a results
 * dropdown (name-only rows + a "Keep typing an email to invite" hint), and a
 * bottom launchpad composer. Clicking a result opens/creates that member's DM.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId, useMembers } from '@/store/workspace/hooks';
import type { Member } from '@/store/workspace/types';
import { PageSurface } from '../page-primitives';
import { ChatThreadComposer } from './ChatThreadComposer';
import { SearchGlyph } from '@/components/shell/sidebars/SidebarHeaderIcons';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const BORDER = 'var(--cu-border-divider)';
const BORDER_STRONG = 'var(--cu-border-strong)';
const HOVER_BG = 'var(--cu-bg-hover)';
const INPUT_BG = 'var(--cu-bg-input)';
const MENU_BG = 'var(--cu-bg-menu)';

const LAUNCHPAD_PLACEHOLDER = 'Mention @Brain to create, find, ask anything';

function MemberRow({ member, isSelf, onClick }: { member: Member; isSelf: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="dm-people-result"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: member.color,
          color: 'white',
          fontSize: 9,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {member.initials}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>
        {member.name}
        {isSelf && <span style={{ color: TEXT_MUTED, fontWeight: 400 }}> — You</span>}
      </span>
    </button>
  );
}

function InviteHintRow() {
  return (
    <div
      data-testid="dm-invite-hint"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        color: TEXT_MUTED,
        fontSize: 13,
      }}
    >
      <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6" />
        </svg>
      </span>
      Keep typing an email to invite
    </div>
  );
}

export function NewDirectMessagePanel({ wsId }: { wsId: string }) {
  const router = useRouter();
  const members = useMembers();
  const currentMemberId = useCurrentMemberId();
  const openOrCreateDM = useWorkspaceStore((s) => s.openOrCreateDM);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

  const openDm = (memberId: string) => {
    const dmId = openOrCreateDM(memberId);
    router.push(`/${wsId}/chat/dm/${dmId}`);
  };

  return (
    <PageSurface>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          height: 52,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>New Direct Message</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 12px',
            background: INPUT_BG,
            border: `1px solid ${BORDER_STRONG}`,
            borderRadius: 8,
            boxSizing: 'border-box',
          }}
        >
          <span style={{ display: 'flex', color: TEXT_MUTED, flexShrink: 0 }}>
            <SearchGlyph size={15} />
          </span>
          <input
            data-testid="dm-people-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or enter an email to invite them"
            aria-label="Search people or enter an email to invite them"
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              fontFamily: 'inherit',
              color: TEXT_PRIMARY,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 8,
            padding: 4,
            background: MENU_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {filtered.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === currentMemberId}
              onClick={() => openDm(member.id)}
            />
          ))}
          <InviteHintRow />
        </div>
      </div>

      <ChatThreadComposer placeholder={LAUNCHPAD_PLACEHOLDER} onSend={() => {}} />
    </PageSurface>
  );
}
