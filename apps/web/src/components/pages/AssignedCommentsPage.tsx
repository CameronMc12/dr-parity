'use client';

import { useState } from 'react';
import {
  BORDER,
  CalendarIcon,
  CheckIcon,
  EmptyState,
  FilterIcon,
  PageSurface,
  PageTitle,
  PillButton,
  SearchIcon,
  TabStrip,
  TEXT_MUTED,
} from './page-primitives';

/**
 * Home → Assigned Comments. Oracle: /chat/r/assigned
 * "Assigned Comments" title, Assigned-to-me / Delegated-by-me text tabs,
 * a filter toolbar (Filter, Resolved, Last 90 Days pill, right-aligned Search),
 * then the "No results found" zero-state with a "Clear filters" button.
 */

const TABS = [
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'delegated', label: 'Delegated by me' },
];

export function AssignedCommentsPage() {
  const [active, setActive] = useState('assigned');

  return (
    <PageSurface>
      <PageTitle>Assigned Comments</PageTitle>
      <TabStrip tabs={TABS} activeId={active} onSelect={setActive} variant="text" />

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
        <PillButton icon={<CheckIcon />}>Resolved</PillButton>
        <PillButton
          active
          caret
          icon={<span style={{ color: 'rgb(124, 77, 255)', display: 'inline-flex' }}><CalendarIcon /></span>}
        >
          Last 90 Days
        </PillButton>
        <span style={{ flex: 1 }} />
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            paddingLeft: 10,
            paddingRight: 10,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_MUTED,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <SearchIcon />
          Search
        </button>
      </div>

      <EmptyState
        illustration={<AssignedIllustration />}
        title="No results found"
        action={
          <button
            style={{
              height: 32,
              paddingLeft: 14,
              paddingRight: 14,
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: 'var(--cu-text-secondary)',
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
            Clear filters
          </button>
        }
      />
    </PageSurface>
  );
}

function AssignedIllustration() {
  return (
    <span
      style={{
        width: 60,
        height: 60,
        borderRadius: 12,
        border: '1px solid var(--cu-border-divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgb(176, 176, 176)',
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 5h14v10a2 2 0 0 1-2 2H10l-4 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M9 11h6M9 8h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}
