'use client';

import { useState } from 'react';
import { EmptyState, PageSurface, PageTitle, TabStrip, TEXT_SECONDARY } from './page-primitives';

/**
 * Home → Replies. Oracle: /chat/r/threads
 * "Replies" title, Unread / Read text tabs, then the "You're all caught up!"
 * zero-state with a "Read old replies" outline button.
 */

const TABS = [
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

export function RepliesPage() {
  const [active, setActive] = useState('unread');

  return (
    <PageSurface>
      <PageTitle>Replies</PageTitle>
      <TabStrip tabs={TABS} activeId={active} onSelect={setActive} variant="text" />

      <EmptyState
        illustration={<RepliesIllustration />}
        title="You're all caught up!"
        subtitle="Looks like you don't have any unread replies"
        action={
          <button
            style={{
              height: 32,
              paddingLeft: 14,
              paddingRight: 14,
              background: 'transparent',
              border: '1px solid var(--cu-border-divider)',
              borderRadius: 6,
              color: TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Read old replies
          </button>
        }
      />
    </PageSurface>
  );
}

function RepliesIllustration() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', color: 'rgb(200, 200, 200)' }}>
      <svg width="96" height="78" viewBox="0 0 96 78" fill="none" aria-hidden="true">
        <rect x="20" y="6" width="44" height="30" rx="6" transform="rotate(-8 20 6)" stroke="currentColor" strokeWidth="2.2" />
        <rect x="30" y="22" width="48" height="32" rx="6" stroke="currentColor" strokeWidth="2.2" fill="var(--cu-bg-app)" />
        <path d="M40 33h28M40 41h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="36" cy="30" r="3.4" stroke="currentColor" strokeWidth="2.2" />
      </svg>
      <span
        style={{
          position: 'absolute',
          right: 6,
          bottom: 4,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgb(170, 170, 170)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}
