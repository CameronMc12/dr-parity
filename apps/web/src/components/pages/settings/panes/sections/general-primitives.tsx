'use client';

import type { ReactNode } from 'react';

/**
 * Layout primitives specific to the Workspace Settings (General) pane. ClickUp's
 * workspace settings use a centered single-column of full-width cards. Each card
 * row is a left label/description, right control split with hairline dividers —
 * a different structure to the two-column My Settings pane, so these live here.
 */

export function SectionLabel({
  children,
  badge,
}: {
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-[19px] font-semibold text-white leading-none">
        {children}
      </h2>
      {badge}
    </div>
  );
}

export function EnterpriseBadge() {
  return (
    <span
      className="rounded-[4px] text-[11px] font-medium leading-none px-1.5 py-[3px]"
      style={{ background: 'rgba(88,66,200,0.18)', color: '#a89fff' }}
    >
      Enterprise
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] mb-8">
      {children}
    </div>
  );
}

/** A single card row: left label (+ optional description), right control. */
export function CardRow({
  label,
  description,
  children,
  align = 'center',
}: {
  label: string;
  description?: string;
  children: ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={`flex gap-6 px-6 py-5 border-b border-[#2a2a2a] last:border-b-0 ${
        align === 'center' ? 'items-center' : 'items-start'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-white leading-tight">{label}</p>
        {description && (
          <p className="text-[13px] leading-[18px] text-[#7b7b7b] mt-1 max-w-[440px]">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-end">{children}</div>
    </div>
  );
}
