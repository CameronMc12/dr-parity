'use client';

/**
 * Lists card: a full-width table with Name / Color / Progress / Start / End /
 * Priority columns over the captured rows, then a "+ New List" footer. Progress
 * is a thin track + accent fill with the "done/total" label; empty Start/End
 * show muted calendar placeholders. 1:1 with the ClickUp capture.
 */

import { useState } from 'react';
import { OverviewCard } from './OverviewCard';
import { OVERVIEW } from './overview-tokens';
import { LIST_COLUMNS, LIST_ROWS, type ListRow } from './overview-data';
import { ListIcon, CalendarIcon, FlagIcon } from './overview-icons';

const GRID_COLS = 'minmax(180px, 2.2fr) 80px minmax(120px, 1.4fr) 96px 96px 84px';

export function ListsCard() {
  return (
    <OverviewCard title="Lists" span={3} flush>
      <div style={{ padding: `0 ${OVERVIEW.cardPad}px ${OVERVIEW.cardPad}px` }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            alignItems: 'center',
            gap: 12,
            padding: '0 8px 8px',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: OVERVIEW.textFaint,
            borderBottom: `1px solid ${OVERVIEW.border}`,
          }}
        >
          {LIST_COLUMNS.map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>

        {LIST_ROWS.map((row) => (
          <ListsRow key={row.name} row={row} />
        ))}

        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            padding: '6px 8px',
            background: 'none',
            border: 'none',
            fontSize: 13,
            fontFamily: 'inherit',
            color: OVERVIEW.textFaint,
            cursor: 'pointer',
          }}
        >
          + New List
        </button>
      </div>
    </OverviewCard>
  );
}

function ListsRow({ row }: { row: ListRow }) {
  const [hover, setHover] = useState(false);
  const pct = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        alignItems: 'center',
        gap: 12,
        height: 40,
        padding: '0 8px',
        borderRadius: OVERVIEW.radiusRow,
        background: hover ? OVERVIEW.hoverBg : 'transparent',
        fontSize: 13,
        color: OVERVIEW.textBody,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ color: OVERVIEW.textFaint, display: 'inline-flex', flexShrink: 0 }}>
          <ListIcon />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </span>
      </span>

      <span style={{ color: OVERVIEW.textFaint }}>-</span>

      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: OVERVIEW.border,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${pct}%`,
              height: '100%',
              borderRadius: 2,
              background: OVERVIEW.accent,
            }}
          />
        </span>
        <span style={{ fontSize: 12, color: OVERVIEW.textFaint, flexShrink: 0 }}>
          {row.done}/{row.total}
        </span>
      </span>

      <span style={{ color: OVERVIEW.textFaint, display: 'inline-flex' }}>
        <CalendarIcon />
      </span>
      <span style={{ color: OVERVIEW.textFaint, display: 'inline-flex' }}>
        <CalendarIcon />
      </span>
      <span style={{ color: OVERVIEW.textFaint, display: 'inline-flex' }}>
        <FlagIcon />
      </span>
    </div>
  );
}
