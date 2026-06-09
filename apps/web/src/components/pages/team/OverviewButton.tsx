'use client';

/**
 * Subtle bordered button used across the Overview dashboard (Add card, Add
 * Bookmark, Add Folder). 1px #2a2a2a hairline, transparent fill, faint label,
 * lifting to a hover surface. Matches the capture's secondary affordance.
 */

import { useState, type ReactNode } from 'react';
import { OVERVIEW } from './overview-tokens';

interface OverviewButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
}

export function OverviewButton({ children, icon, onClick }: OverviewButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 13px',
        borderRadius: 6,
        border: `1px solid ${OVERVIEW.border}`,
        background: hover ? OVERVIEW.hoverBg : 'transparent',
        color: OVERVIEW.textBody,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
