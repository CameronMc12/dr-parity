'use client';

/**
 * Card shell for the Overview dashboard: a raised #191919 surface with a 1px
 * #2a2a2a hairline, 8px radius, and a title header. `span` controls how many
 * grid tracks the card occupies. Body padding is opt-out (`flush`) for cards
 * whose own content owns the edges (e.g. the Lists table).
 */

import type { ReactNode } from 'react';
import { OVERVIEW } from './overview-tokens';

interface OverviewCardProps {
  title: string;
  span?: number;
  flush?: boolean;
  /** Vertically centre the body (empty-state cards). */
  center?: boolean;
  minHeight?: number;
  children: ReactNode;
}

export function OverviewCard({
  title,
  span = 1,
  flush = false,
  center = false,
  minHeight,
  children,
}: OverviewCardProps) {
  return (
    <section
      style={{
        gridColumn: `span ${span}`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight,
        background: OVERVIEW.cardBg,
        border: `1px solid ${OVERVIEW.border}`,
        borderRadius: OVERVIEW.radiusCard,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: `${OVERVIEW.cardPad}px ${OVERVIEW.cardPad}px 12px`,
          fontSize: 14,
          fontWeight: 600,
          color: OVERVIEW.textTitle,
        }}
      >
        {title}
      </header>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: center ? 'center' : 'flex-start',
          alignItems: center ? 'center' : 'stretch',
          padding: flush ? 0 : `0 ${OVERVIEW.cardPad}px ${OVERVIEW.cardPad}px`,
        }}
      >
        {children}
      </div>
    </section>
  );
}
