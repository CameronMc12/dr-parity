'use client';

/**
 * Dashboards hub header. Mirrors the real ClickUp landing: a left-aligned
 * breadcrumb-style "All Dashboards" heading, and a dark "New Dashboard ▾" CTA on
 * the right.
 */

import { CaretDownIcon } from './dashboards-hub-icons';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32, 32, 32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(140, 140, 140))';
const BORDER = 'var(--cu-border-divider, rgb(234, 234, 235))';

function BreadcrumbGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="16" width="7" height="4" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function DashboardsHubToolbar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 48,
        paddingLeft: 24,
        paddingRight: 16,
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      <span style={{ display: 'inline-flex', color: TEXT_MUTED }}>
        <BreadcrumbGlyph size={16} />
      </span>
      <h1 style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>
        All Dashboards
      </h1>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 14,
          paddingRight: 10,
          background: 'var(--cu-text-primary, rgb(28, 28, 30))',
          border: 'none',
          borderRadius: 7,
          cursor: 'pointer',
          color: 'var(--cu-bg-app, #fff)',
          fontSize: 13,
          fontWeight: 600,
          transition: 'opacity 120ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        New Dashboard
        <CaretDownIcon size={12} />
      </button>
    </div>
  );
}
