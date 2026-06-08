import type { ReactNode } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '../page-primitives';
import {
  MiniBarIcon,
  MiniDonutIcon,
  MiniStatIcon,
  MiniListIcon,
} from './dashboards-hub-icons';
import type { DashboardEntry, WidgetKind } from '@/data/dashboards-seed';

/** Map a widget kind to a tiny preview glyph for the card footer. */
function widgetGlyph(kind: WidgetKind): ReactNode {
  switch (kind) {
    case 'statusBar':
    case 'priorityBreakdown':
    case 'assigneeBar':
      return <MiniBarIcon size={15} />;
    case 'statusDonut':
      return <MiniDonutIcon size={15} />;
    case 'statTotal':
    case 'statCompleted':
    case 'statOverdue':
      return <MiniStatIcon size={15} />;
    case 'dueSoon':
    case 'recentActivity':
      return <MiniListIcon size={15} />;
    default:
      return <MiniStatIcon size={15} />;
  }
}

/** A faint preview of the dashboard's first widgets as stacked bars. */
function PreviewArt() {
  const bars = [70, 46, 88, 34, 60];
  return (
    <div
      style={{
        height: 104,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '0 18px 16px',
        background: 'linear-gradient(180deg, rgb(248, 250, 252) 0%, rgb(242, 245, 249) 100%)',
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            borderRadius: '4px 4px 0 0',
            background: i % 2 === 0 ? 'rgb(176, 196, 222)' : 'rgb(201, 213, 228)',
          }}
        />
      ))}
    </div>
  );
}

export function DashboardCard({
  dashboard,
  onOpen,
}: {
  dashboard: DashboardEntry;
  onOpen: (id: string) => void;
}) {
  const glyphs = dashboard.widgets.slice(0, 4);

  return (
    <button
      onClick={() => onOpen(dashboard.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 280,
        textAlign: 'left',
        padding: 0,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: 'white',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        transition: 'box-shadow 140ms ease, transform 140ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 24, 40, 0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(16, 24, 40, 0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <PreviewArt />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, flex: 1, minWidth: 0 }}>
            {dashboard.name}
          </span>
          {dashboard.sharing === 'shared' && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: TEXT_SECONDARY,
                background: 'rgb(238, 240, 243)',
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              Shared
            </span>
          )}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: TEXT_MUTED,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {dashboard.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              background: dashboard.owner.color,
              color: 'white',
              fontSize: 9,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {dashboard.owner.initials}
          </span>
          <span style={{ fontSize: 11, color: TEXT_MUTED, flex: 1 }}>{dashboard.updatedLabel}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgb(170, 178, 188)' }}>
            {glyphs.map((kind, i) => (
              <span key={`${kind}-${i}`} style={{ display: 'inline-flex' }}>
                {widgetGlyph(kind)}
              </span>
            ))}
          </span>
        </div>
      </div>
    </button>
  );
}
