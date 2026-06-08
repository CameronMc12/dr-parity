'use client';

/**
 * Dashboards sidebar. 1:1 with the real ClickUp Dashboards sidebar:
 *  - Header "Dashboards" + a "+" affordance.
 *  - Top nav: All Dashboards (active) / My Dashboards / Shared with me / Private.
 *  - A "Favorites" section with the "Star a Dashboard to see it here" empty hint.
 *  - A "Recents" section listing several dashboard rows (purple glyph) plus a
 *    "More" expander.
 *
 * Clicking a row routes to the Dashboards hub via the local dashboards UI store.
 */

import { useState } from 'react';
import { useShellStore } from '@/store/shell-store';
import { useDashboardsUi } from '@/components/pages/dashboards-hub/dashboards-ui-store';
import { DASHBOARDS } from '@/data/dashboards-seed';
import type { DashboardEntry } from '@/data/dashboards-seed';

const TEXT = 'var(--cu-text-primary, rgb(40,40,42))';
const SECONDARY = 'var(--cu-text-secondary, rgb(90,90,94))';
const MUTED = 'var(--cu-text-muted, rgb(140,140,144))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,245))';
const ACTIVE = 'var(--cu-bg-active, rgb(237,237,239))';
const DIVIDER = 'var(--cu-border-divider, rgb(234,234,235))';
const ACCENT = '#7b68ee';

const RECENTS_PREVIEW = 5;

function PlusGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GridGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="4" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="14" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="17" width="7" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ShareGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function LockGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function StarGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}

/** Small circular initial avatar for "My Dashboards". */
function InitialAvatar({ size = 17 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: 9,
        fontWeight: 600,
      }}
      aria-hidden="true"
    >
      C
    </span>
  );
}

/** Purple dashboard glyph in a rounded square — used by the Recents rows. */
function PurpleDashGlyph({ size = 17 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 4,
        background: ACCENT,
        color: '#fff',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M6 19V11M12 19V5M18 19v-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

interface NavRowProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavRow({ icon, label, active, onClick }: NavRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 30,
        padding: '0 8px',
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? TEXT : SECONDARY,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', color: active ? TEXT : MUTED, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </button>
  );
}

function RecentRow({ dashboard, onClick }: { dashboard: DashboardEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 30,
        padding: '0 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <PurpleDashGlyph size={17} />
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {dashboard.name}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 10px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

export function DashboardsSidebar() {
  const openId = useDashboardsUi((s) => s.openDashboardId);
  const openDashboard = useDashboardsUi((s) => s.openDashboard);
  const closeDashboard = useDashboardsUi((s) => s.closeDashboard);
  const setRouteShell = useShellStore((s) => s.setRouteShell);
  const [headerHover, setHeaderHover] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const goHub = () => {
    closeDashboard();
    setRouteShell('dashboards');
  };
  const open = (id: string) => {
    openDashboard(id);
    setRouteShell('dashboards');
  };

  const recents = expanded ? DASHBOARDS : DASHBOARDS.slice(0, RECENTS_PREVIEW);
  const hasMore = DASHBOARDS.length > RECENTS_PREVIEW;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 40,
          padding: '0 8px 0 12px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, flex: 1 }}>Dashboards</span>
        <button
          type="button"
          aria-label="New dashboard"
          onClick={goHub}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: MUTED,
            opacity: headerHover ? 1 : 0.7,
            transition: 'opacity 120ms ease, background 120ms ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <PlusGlyph size={15} />
        </button>
      </div>

      <div style={{ padding: '0 6px', flexShrink: 0 }}>
        <NavRow icon={<GridGlyph />} label="All Dashboards" active={!openId} onClick={goHub} />
        <NavRow icon={<InitialAvatar />} label="My Dashboards" onClick={goHub} />
        <NavRow icon={<ShareGlyph />} label="Shared with me" onClick={goHub} />
        <NavRow icon={<LockGlyph />} label="Private" onClick={goHub} />
      </div>

      <div
        style={{
          marginTop: 8,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          borderTop: `1px solid ${DIVIDER}`,
        }}
      >
        <SectionLabel>Favorites</SectionLabel>
        <div style={{ padding: '0 8px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '14px 12px',
              border: `1px dashed ${DIVIDER}`,
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <span style={{ color: '#f6b73c', display: 'inline-flex' }}>
              <StarGlyph size={20} />
            </span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
              Star a Dashboard to see it here
            </span>
          </div>
        </div>

        <SectionLabel>Recents</SectionLabel>
        <div style={{ padding: '0 6px 8px' }}>
          {recents.map((d) => (
            <RecentRow key={d.id} dashboard={d} onClick={() => open(d.id)} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 28,
                padding: '0 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: MUTED,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ display: 'inline-flex', justifyContent: 'center', width: 17 }}>···</span>
              <span>{expanded ? 'Less' : 'More'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
