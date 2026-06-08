'use client';

import { useState } from 'react';
import {
  BORDER,
  FilterIcon,
  GearIcon,
  PageSurface,
  PillButton,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TabStrip,
} from './page-primitives';

/**
 * Home → Inbox. Oracle: /inbox?tab=primary
 * Full-width tab strip (Primary / Other / Later / Cleared), a Filter +
 * settings/Clear-all sub-toolbar, then the "Inbox Zero 🎉" zero-state with a
 * Motivational Quote card beneath it.
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

      {/* Inbox Zero zero-state (oracle: /inbox?tab=primary cleared). The
          centred congratulations block fills the available space; a Motivational
          Quote card is pinned beneath it, divided by a hairline border. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <InboxZeroIllustration />
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: TEXT_PRIMARY }}>
          Inbox Zero
        </div>
        <div style={{ fontSize: 14, color: TEXT_MUTED, marginTop: 8 }}>
          Congratulations! You cleared your important notifications 🎉
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 16,
          paddingBottom: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 24,
            paddingLeft: 10,
            paddingRight: 10,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            color: TEXT_MUTED,
          }}
        >
          Motivational Quote
        </span>
        <div
          style={{
            marginTop: 28,
            fontSize: 22,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          Every great dream begins with a dreamer.
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: TEXT_MUTED }}>
          — Harriet Tubman
        </div>
      </div>
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

function InboxZeroIllustration() {
  // Light-purple inbox tray (oracle Inbox Zero glyph).
  return (
    <svg width="72" height="72" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M8 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14Z"
        fill="rgba(124, 77, 255, 0.10)"
        stroke="rgba(124, 77, 255, 0.55)"
        strokeWidth="2"
      />
      <path
        d="M8 28h8l3 4h10l3-4h8"
        fill="none"
        stroke="rgba(124, 77, 255, 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
