'use client';

/**
 * Right-edge vertical icon rail for the Channel view: Followers (avatar + count
 * badge) · divider · Search · Replies · Assigned · Settings. Visual +
 * non-crashing — each button toggles a tiny tooltip popover and is keyboard
 * focusable. Mirrors the rail in the real ClickUp channel view.
 */

import { useState } from 'react';

const TEXT_MUTED = 'var(--cu-text-muted)';
const TEXT_PRIMARY = 'var(--cu-text-primary)';
const HOVER_BG = 'var(--cu-bg-hover)';
const BORDER = 'var(--cu-border-divider)';
const MENU_BG = 'var(--cu-bg-menu)';

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
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
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        color: active ? TEXT_PRIMARY : TEXT_MUTED,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ChannelRail({ count = 1 }: { count?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen((p) => (p === k ? null : k));

  return (
    <div
      data-testid="channel-rail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: 48,
        paddingTop: 14,
        borderLeft: `1px solid ${BORDER}`,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <button
        type="button"
        data-testid="channel-rail-followers"
        aria-label="Followers"
        title="Followers"
        onClick={() => toggle('followers')}
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: 'none',
          background: 'rgb(38,38,38)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        C
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            minWidth: 14,
            height: 14,
            padding: '0 3px',
            borderRadius: 7,
            background: 'rgb(120,170,255)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      </button>

      <span aria-hidden="true" style={{ width: 22, height: 1, background: BORDER, margin: '2px 0' }} />

      <RailButton label="Search in channel" active={open === 'search'} onClick={() => toggle('search')}>
        <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </RailButton>

      <RailButton label="Replies" active={open === 'replies'} onClick={() => toggle('replies')}>
        <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
          <path d="M9 7 4 11l5 4" />
          <path d="M4 11h9a6 6 0 0 1 6 6v2" />
        </svg>
      </RailButton>

      <RailButton label="Assigned to me" active={open === 'assigned'} onClick={() => toggle('assigned')}>
        <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
          <path d="M4 5h16v10H9l-5 4V5Z" />
          <path d="M9.5 9.5l1.6 1.6 3-3.2" />
        </svg>
      </RailButton>

      <RailButton label="Channel settings" active={open === 'settings'} onClick={() => toggle('settings')}>
        <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l1.9-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L12 2H8l-.5 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 1.9 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-1.9 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L12 22h0l.5-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-1.9-1.5c.1-.4.1-.8.1-1.2Z" />
        </svg>
      </RailButton>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 14,
            right: 52,
            whiteSpace: 'nowrap',
            padding: '6px 10px',
            background: MENU_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            fontSize: 12,
            color: TEXT_PRIMARY,
            boxShadow: 'var(--cu-shadow-sm)',
            zIndex: 30,
          }}
        >
          {open === 'followers' && 'Followers'}
          {open === 'search' && 'Search in this channel'}
          {open === 'replies' && 'Replies'}
          {open === 'assigned' && 'Assigned to me'}
          {open === 'settings' && 'Channel settings'}
        </div>
      )}
    </div>
  );
}
