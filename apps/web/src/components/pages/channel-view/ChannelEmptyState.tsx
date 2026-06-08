'use client';

/**
 * Rich empty state shown in the Channel view when a list-backed channel has no
 * messages yet. Centred column: heading + subtext, two full-width outline action
 * buttons (Add People / Import from Slack), a divider, then three suggestion
 * cards (Track Tasks / Add Doc / Start SyncUp), each with a tinted leading icon.
 * Mirrors the real ClickUp channel empty state (structure, not light-mode colour).
 */

import { useState } from 'react';
import {
  AddDocIcon,
  AddPeopleIcon,
  SlackIcon,
  SyncUpIcon,
  TrackTasksIcon,
} from './channel-empty-icons';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const BORDER = 'var(--cu-border-strong)';
const DIVIDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';

function OutlineButton({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        height: 40,
        background: hover ? HOVER_BG : 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        color: TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', color: TEXT_SECONDARY }}>{icon}</span>
      {children}
    </button>
  );
}

function SuggestionCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        background: hover ? HOVER_BG : 'transparent',
        border: `1px solid ${DIVIDER}`,
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 8,
          background: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export function ChannelEmptyState({ channelName }: { channelName: string }) {
  return (
    <div
      data-testid="channel-empty-state"
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 24px 8px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>
            Chat in #{channelName}
          </h2>
          <p style={{ fontSize: 13, lineHeight: '20px', color: TEXT_SECONDARY, margin: '8px 0 0' }}>
            Collaborate seamlessly across tasks and conversations. Start chatting with your team or
            connect tasks to stay on top of your work.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <OutlineButton icon={<AddPeopleIcon />}>Add People</OutlineButton>
          <OutlineButton icon={<SlackIcon />}>Import from Slack</OutlineButton>
        </div>

        <div style={{ height: 1, background: DIVIDER }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SuggestionCard
            icon={<TrackTasksIcon />}
            iconBg="rgba(186,130,236,0.16)"
            iconColor="rgb(186,130,236)"
            title="Track Tasks"
            subtitle="Manage tasks, bugs, people, and more"
          />
          <SuggestionCard
            icon={<AddDocIcon />}
            iconBg="rgba(120,170,255,0.16)"
            iconColor="rgb(120,170,255)"
            title="Add Doc"
            subtitle="Take notes or create detailed documents"
          />
          <SuggestionCard
            icon={<SyncUpIcon />}
            iconBg="rgba(76,191,110,0.16)"
            iconColor="rgb(76,191,110)"
            title="Start SyncUp"
            subtitle="Jump on a voice call or video call"
          />
        </div>
      </div>
    </div>
  );
}
