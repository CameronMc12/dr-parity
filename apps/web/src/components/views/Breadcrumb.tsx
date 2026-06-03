'use client';

/**
 * Shared view breadcrumb. Pixel-identical to the per-view Breadcrumb copies in
 * List / Board / Calendar / Gantt (height 40, paddingLeft 20, paddingRight 16,
 * gap 4, CrumbIcon + label + trailing CaretDown on the last crumb, `/` between),
 * resolved to bare `var(--cu-*)` tokens.
 */

import type { ReactNode } from 'react';
import { CaretDown } from '@/components/pages/list-view-icons';
import type { Crumb } from './useViewCrumbs';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;

function CrumbIcon({ glyph, color }: { glyph: string; color: string }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  );
}

export function Breadcrumb({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 40,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        const key = crumbs.slice(0, i + 1).map((c) => c.label).join('›');
        return (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CrumbIcon glyph={crumb.glyph} color={crumb.color} />
            <span
              style={{
                fontSize: 13,
                fontWeight: last ? 600 : 500,
                color: last ? TEXT_PRIMARY : TEXT_SECONDARY,
                whiteSpace: 'nowrap',
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {crumb.label}
            </span>
            {last && <CaretDown size={12} />}
            {!last && <span style={{ color: TEXT_MUTED, fontSize: 13, margin: '0 2px' }}>/</span>}
          </span>
        );
      })}
      <span style={{ flex: 1 }} />
      {actions}
    </div>
  );
}
