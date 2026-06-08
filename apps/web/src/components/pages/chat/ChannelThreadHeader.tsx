'use client';

/**
 * Slim header for a pure (non list-backed) Chat channel thread. Shows the hash
 * glyph + channel name, a muted member count, and a hover-reveal action cluster
 * (members / settings). Mirrors the compact channel header in ClickUp Chat.
 */

import { useState } from 'react';
import { CHAT } from '../chatview/chat-tokens';
import { GearIcon } from './chat-tool-icons';

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 28,
        minWidth: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '0 8px',
        background: hover ? CHAT.hoverBg : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: CHAT.textMuted,
        fontSize: 12,
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function MembersGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M19 19a5.5 5.5 0 0 0-3.5-5.1" />
    </svg>
  );
}

export function ChannelThreadHeader({
  name,
  memberCount,
}: {
  name: string;
  memberCount: number;
}) {
  return (
    <div
      data-testid="channel-thread-header"
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
      <span style={{ fontSize: 16, color: CHAT.textMuted, fontWeight: 700, lineHeight: 1 }}>#</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: CHAT.textPrimary }}>{name}</span>
      <span style={{ flex: 1 }} />
      <HeaderButton label="Channel members">
        <MembersGlyph />
        <span data-testid="channel-member-count">{memberCount}</span>
      </HeaderButton>
      <HeaderButton label="Channel settings">
        <GearIcon size={16} />
      </HeaderButton>
    </div>
  );
}
