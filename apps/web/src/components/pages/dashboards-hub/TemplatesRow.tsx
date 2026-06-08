import { BORDER, TEXT_PRIMARY, TEXT_MUTED } from '../page-primitives';
import { DashboardCardGlyph } from './dashboards-hub-icons';
import { DASHBOARD_TEMPLATES } from '@/data/dashboards-seed';

/** Horizontal row of starter templates shown above the dashboard gallery. */
export function TemplatesRow() {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, margin: '0 0 12px' }}>
        Start from a template
      </h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {DASHBOARD_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: 230,
              textAlign: 'left',
              padding: 12,
              background: 'white',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'border-color 140ms ease, box-shadow 140ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tpl.accent;
              e.currentTarget.style.boxShadow = `0 2px 10px ${tpl.accent}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: `${tpl.accent}1f`,
                color: tpl.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DashboardCardGlyph size={20} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                {tpl.name}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: TEXT_MUTED,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tpl.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
