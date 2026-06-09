'use client';

/**
 * Shared row for the Recent + Docs cards: a doc glyph, the item name (#ccc) and
 * a muted " · location" suffix. Hover raises a subtle row surface.
 */

import { useState } from 'react';
import { OVERVIEW } from './overview-tokens';
import { DocIcon } from './overview-icons';

interface OverviewItemRowProps {
  name: string;
  location: string;
}

export function OverviewItemRow({ name, location }: OverviewItemRowProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        height: 32,
        padding: '0 8px',
        margin: '0 -8px',
        borderRadius: OVERVIEW.radiusRow,
        background: hover ? OVERVIEW.hoverBg : 'transparent',
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <span style={{ color: OVERVIEW.textFaint, display: 'inline-flex', flexShrink: 0 }}>
        <DocIcon />
      </span>
      <span
        style={{
          fontSize: 13,
          color: OVERVIEW.textBody,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
        <span style={{ color: OVERVIEW.textFaint }}>{` · ${location}`}</span>
      </span>
    </div>
  );
}
