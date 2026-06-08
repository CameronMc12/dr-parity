'use client';

import { PillButton, FilterIcon, SearchIcon, CaretDown } from '../page-primitives';

const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';

function SortIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 5v14M7 5 4 8M7 5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 7h7M13 12h5M13 17h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Sub-toolbar between the templates row and the docs table. Oracle: a
 * Filters pill, a Sort pill, a "Tags: View all" inline control on the left, and
 * a Search affordance pinned to the right.
 */
export function DocsControlsBar({ onSearch }: { onSearch?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
      }}
    >
      <PillButton icon={<FilterIcon />}>Filters</PillButton>
      <PillButton icon={<SortIcon />}>Sort</PillButton>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
        <span style={{ color: MUTED, fontSize: 13, fontWeight: 500 }}>Tags:</span>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: SECONDARY,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          View all
          <CaretDown size={12} />
        </button>
      </div>

      <span style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: SECONDARY,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          padding: '4px 6px',
        }}
      >
        <SearchIcon />
        Search
      </button>
    </div>
  );
}
