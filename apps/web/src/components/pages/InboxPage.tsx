'use client';

import { useState } from 'react';
import {
  BORDER,
  EmptyState,
  FilterIcon,
  GearIcon,
  PageSurface,
  PillButton,
  TEXT_MUTED,
  TabStrip,
} from './page-primitives';

/**
 * Home → Inbox. Oracle: /inbox?tab=primary
 * Full-width tab strip (Primary / Other / Later / Cleared), a Filter +
 * settings/Clear-all sub-toolbar, then the "Looking to collaborate?" zero-state.
 */

const TABS = [
  { id: 'primary', label: 'Primary', icon: <PrimaryIcon /> },
  { id: 'other', label: 'Other', icon: <OtherIcon /> },
  { id: 'later', label: 'Later', icon: <LaterIcon /> },
  { id: 'cleared', label: 'Cleared', icon: <ClearedIcon /> },
];

export function InboxPage() {
  const [active, setActive] = useState('primary');

  return (
    <PageSurface>
      <TabStrip tabs={TABS} activeId={active} onSelect={setActive} variant="full" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <PillButton icon={<FilterIcon />}>Filter</PillButton>
        <span style={{ flex: 1 }} />
        <button
          aria-label="Inbox settings"
          style={{
            width: 30,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_MUTED,
          }}
        >
          <GearIcon />
        </button>
        <button
          disabled
          style={{
            height: 28,
            paddingLeft: 12,
            paddingRight: 12,
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            color: 'var(--cu-text-disabled)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'default',
          }}
        >
          Clear all
        </button>
      </div>

      <EmptyState
        illustration={<CollaborateIllustration />}
        title="Looking to collaborate?"
        subtitle="Collaboration is one invite away."
        action={
          <button
            style={{
              height: 36,
              paddingLeft: 20,
              paddingRight: 20,
              background: 'var(--cu-text-primary)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--cu-bg-app)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Invite people
          </button>
        }
      />
    </PageSurface>
  );
}

/* ---- tab icons ---- */

function PrimaryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4 7 8 5 8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OtherIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14l4-5 4 4 4-7 4 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LaterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClearedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 12 4 4 5-6M12 16l3 3 5-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollaborateIllustration() {
  return (
    <span
      style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgb(124,77,255) 0%, rgb(90,67,214) 100%)',
        color: 'white',
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M3.5 18c0-2.5 2.4-4.2 5.5-4.2s5.5 1.7 5.5 4.2M14.5 17.5c.2-1.9 1.9-3 4-3 1.2 0 2.3.4 3 1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
