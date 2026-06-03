'use client';

/**
 * Shared empty-body placeholder used by every stub card until its real body
 * lands in the next phase. Keeps the chrome (CardFrame) honest by filling the
 * body slot with a centered, muted hint that names the card type.
 */

import type { ReactNode } from 'react';
import { DASH } from '../tokens';

export function CardPlaceholder({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        textAlign: 'center',
        padding: 16,
        color: DASH.textMuted,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: DASH.textSecondary }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: 12 }}>{hint}</span>}
      {children}
    </div>
  );
}
