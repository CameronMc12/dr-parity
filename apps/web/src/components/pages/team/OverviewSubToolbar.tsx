'use client';

/**
 * Overview sub-toolbar: a "Filters" affordance on the left, and on the right a
 * refresh status, an "Auto refresh: On" pill, a "Customize" link, and an "Add
 * card" button. Static chrome captured 1:1 from the ClickUp Team Space Overview.
 */

import { OVERVIEW } from './overview-tokens';
import { OverviewButton } from './OverviewButton';
import { FilterIcon, RefreshIcon } from './overview-icons';

export function OverviewSubToolbar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 20px',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13,
          color: OVERVIEW.textFaint,
        }}
      >
        <FilterIcon />
        Filters
      </span>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12, color: OVERVIEW.textFaint }}>Refreshed: 29 mins ago</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 26,
            padding: '0 11px',
            borderRadius: 13,
            border: `1px solid ${OVERVIEW.border}`,
            fontSize: 12,
            color: OVERVIEW.textMuted,
          }}
        >
          <RefreshIcon />
          Auto refresh: On
        </span>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 13,
            fontFamily: 'inherit',
            color: OVERVIEW.textMuted,
            cursor: 'pointer',
          }}
        >
          Customize
        </button>
        <OverviewButton>Add card</OverviewButton>
      </div>
    </div>
  );
}
