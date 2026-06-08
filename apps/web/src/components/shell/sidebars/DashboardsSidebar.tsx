'use client';

/**
 * Dashboards sidebar. Faithful to the ClickUp global-sidebar chrome: a title
 * header, top nav rows (All / My / Shared / Private), then grouped lists of the
 * workspace's dashboards. Rows are interactive — clicking one opens that
 * dashboard in the hub via the local dashboards UI store, with an active
 * highlight kept in sync. A "+ New Dashboard" affordance sits in the header.
 */

import { useState } from 'react';
import { useShellStore } from '@/store/shell-store';
import { useDashboardsUi } from '@/components/pages/dashboards-hub/dashboards-ui-store';
import { DASHBOARDS } from '@/data/dashboards-seed';
import type { DashboardEntry } from '@/data/dashboards-seed';

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';
const DIVIDER = 'var(--cu-border-divider)';

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

function PersonGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

interface NavRowProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

function NavRow({ icon, label, count, active, onClick }: NavRowProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 32,
        padding: '0 10px',
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? TEXT : 'var(--cu-text-secondary, rgb(200,200,200))',
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
      {count != null && (
        <span style={{ fontSize: 12, color: 'var(--cu-text-disabled, rgb(140,140,140))', fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
      )}
    </button>
  );
}

function DashboardRow({
  dashboard,
  active,
  onClick,
}: {
  dashboard: DashboardEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 30,
        padding: '0 10px',
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? TEXT : 'var(--cu-text-secondary, rgb(200,200,200))',
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
      <span style={{ display: 'flex', color: active ? 'var(--cu-accent)' : MUTED, flexShrink: 0 }}>
        <GridGlyph size={15} />
      </span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {dashboard.name}
      </span>
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 12px 6px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: 'var(--cu-text-disabled, rgb(130,130,130))',
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
  const [hovered, setHovered] = useState(false);

  const goHub = () => {
    closeDashboard();
    setRouteShell('dashboards');
  };
  const open = (id: string) => {
    openDashboard(id);
    setRouteShell('dashboards');
  };

  const mine = DASHBOARDS.filter((d) => d.sharing === 'private');
  const shared = DASHBOARDS.filter((d) => d.sharing === 'shared');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
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
          aria-label="New dashboard"
          onClick={goHub}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            background: 'var(--cu-bg-strong, rgb(38,38,38))',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            color: '#fff',
            opacity: hovered ? 1 : 0.85,
            transition: 'opacity 120ms ease',
            flexShrink: 0,
          }}
        >
          <PlusGlyph size={14} />
        </button>
      </div>

      <div style={{ padding: '0 6px', flexShrink: 0 }}>
        <NavRow icon={<GridGlyph />} label="All Dashboards" active={!openId} onClick={goHub} />
        <NavRow icon={<PersonGlyph />} label="My Dashboards" count={mine.length} onClick={goHub} />
        <NavRow icon={<ShareGlyph />} label="Shared with me" count={shared.length} onClick={goHub} />
        <NavRow icon={<LockGlyph />} label="Private" count={mine.length} onClick={goHub} />
      </div>

      <div
        style={{
          marginTop: 6,
          paddingTop: 2,
          borderTop: `1px solid ${DIVIDER}`,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        <GroupLabel>My Dashboards</GroupLabel>
        <div style={{ padding: '0 6px' }}>
          {mine.map((d) => (
            <DashboardRow key={d.id} dashboard={d} active={openId === d.id} onClick={() => open(d.id)} />
          ))}
        </div>

        <GroupLabel>Shared</GroupLabel>
        <div style={{ padding: '0 6px' }}>
          {shared.map((d) => (
            <DashboardRow key={d.id} dashboard={d} active={openId === d.id} onClick={() => open(d.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
