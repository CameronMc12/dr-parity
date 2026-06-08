'use client';

/**
 * The "All Dashboards" table list — the real ClickUp landing. A Sort control on
 * the left and a Search affordance on the right, then a bordered table:
 * Name · Location · Date viewed · Date updated · Owner · Sharing · (options).
 * Rows carry the purple dashboard glyph, an optional lock, a location chip, two
 * dates, and owner/sharing avatars. The "Date viewed" header shows the active
 * descending sort arrow.
 */

import type { CSSProperties } from 'react';
import type { DashboardEntry, DashboardLocation, DashboardOwner } from '@/data/dashboards-seed';
import {
  DashboardListGlyph,
  LockGlyph,
  SpaceLocationGlyph,
  ProjectLocationGlyph,
  SortIcon,
  SearchIcon,
  SortArrowDownIcon,
  PlusColumnIcon,
  EllipsisIcon,
} from './dashboards-hub-icons';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32, 32, 32))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(90, 90, 90))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(140, 140, 140))';
const BORDER = 'var(--cu-border-divider, rgb(234, 234, 235))';
const HOVER = 'var(--cu-bg-hover, rgb(248, 248, 249))';

const COL = {
  name: { flex: '1 1 auto', minWidth: 0 } as CSSProperties,
  location: { width: 150, flexShrink: 0 } as CSSProperties,
  viewed: { width: 130, flexShrink: 0 } as CSSProperties,
  updated: { width: 120, flexShrink: 0 } as CSSProperties,
  owner: { width: 70, flexShrink: 0 } as CSSProperties,
  sharing: { width: 80, flexShrink: 0 } as CSSProperties,
  options: { width: 44, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' } as CSSProperties,
};

function ControlPill({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 30,
        padding: '0 12px',
        background: 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 7,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

function LocationCell({ location }: { location: DashboardLocation }) {
  if (!location) {
    return <span style={{ color: TEXT_MUTED, fontSize: 13 }}>–</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', color: TEXT_MUTED, flexShrink: 0 }}>
        {location.kind === 'space' ? <SpaceLocationGlyph size={16} /> : <ProjectLocationGlyph size={16} />}
      </span>
      <span
        style={{
          fontSize: 13,
          color: TEXT_SECONDARY,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {location.label}
      </span>
    </span>
  );
}

function Avatar({ owner }: { owner: DashboardOwner }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: owner.color,
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.2,
        }}
      >
        {owner.initials}
      </span>
      <span
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#2ecc71',
          border: '1.5px solid var(--cu-bg-app, #fff)',
        }}
        aria-hidden="true"
      />
    </span>
  );
}

function HeaderCell({
  label,
  style,
  sorted,
  align = 'left',
}: {
  label: string;
  style: CSSProperties;
  sorted?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 6,
        fontSize: 12.5,
        fontWeight: 500,
        color: TEXT_MUTED,
      }}
    >
      <span>{label}</span>
      {sorted && <SortArrowDownIcon size={13} />}
    </div>
  );
}

function Row({ dashboard, onOpen }: { dashboard: DashboardEntry; onOpen: (id: string) => void }) {
  return (
    <div
      role="row"
      onClick={() => onOpen(dashboard.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 40,
        padding: '0 12px',
        borderBottom: `1px solid ${BORDER}`,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ ...COL.name, display: 'flex', alignItems: 'center', gap: 10 }}>
        <DashboardListGlyph size={18} />
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dashboard.name}
        </span>
        {dashboard.locked && (
          <span style={{ display: 'inline-flex', color: TEXT_MUTED, flexShrink: 0 }}>
            <LockGlyph size={13} />
          </span>
        )}
      </div>

      <div style={{ ...COL.location, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <LocationCell location={dashboard.location} />
      </div>

      <div style={{ ...COL.viewed, fontSize: 13, color: TEXT_SECONDARY }}>
        {dashboard.viewedLabel}
      </div>

      <div style={{ ...COL.updated, fontSize: 13, color: TEXT_SECONDARY }}>
        {dashboard.updatedLabel}
      </div>

      <div style={{ ...COL.owner, display: 'flex', justifyContent: 'center' }}>
        <Avatar owner={dashboard.owner} />
      </div>

      <div style={{ ...COL.sharing, display: 'flex', justifyContent: 'center' }}>
        <Avatar owner={dashboard.owner} />
      </div>

      <div style={COL.options}>
        <button
          type="button"
          aria-label="Row options"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_MUTED,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <EllipsisIcon size={16} />
        </button>
      </div>
    </div>
  );
}

export function DashboardsTable({
  dashboards,
  onOpen,
}: {
  dashboards: DashboardEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <ControlPill>
          <SortIcon size={14} />
          Sort
        </ControlPill>
        <ControlPill>
          <SearchIcon size={15} />
          Search
        </ControlPill>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        <div
          role="row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            height: 36,
            padding: '0 12px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <HeaderCell label="Name" style={COL.name} />
          <HeaderCell label="Location" style={COL.location} />
          <HeaderCell label="Date viewed" style={COL.viewed} sorted />
          <HeaderCell label="Date updated" style={COL.updated} />
          <HeaderCell label="Owner" style={COL.owner} align="center" />
          <HeaderCell label="Sharing" style={COL.sharing} align="center" />
          <div style={COL.options}>
            <span style={{ display: 'inline-flex', color: TEXT_MUTED }}>
              <PlusColumnIcon size={16} />
            </span>
          </div>
        </div>

        {dashboards.map((dashboard) => (
          <Row key={dashboard.id} dashboard={dashboard} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
