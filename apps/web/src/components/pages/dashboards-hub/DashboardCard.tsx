import { BORDER, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import { DashboardCardGlyph } from './dashboards-hub-icons';
import type { DashboardEntry } from '@/data/dashboards-seed';

/**
 * Dashboard hub card. Used when captured dashboards exist; otherwise the hub
 * shows its empty state.
 */
export function DashboardCard({ dashboard }: { dashboard: DashboardEntry }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 240,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: 'rgb(250, 250, 250)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgb(250, 250, 250)')}
    >
      <div
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgb(244, 244, 244)',
          color: 'rgb(170, 170, 170)',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <DashboardCardGlyph size={36} />
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY }}>{dashboard.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: dashboard.owner.color,
              color: 'white',
              fontSize: 9,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {dashboard.owner.initials}
          </span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>{dashboard.updatedLabel}</span>
        </div>
      </div>
    </div>
  );
}
