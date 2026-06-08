import { BORDER, TEXT_PRIMARY, PillButton, SearchIcon, PlusIcon } from '../page-primitives';

/**
 * Dashboards hub header. Oracle hub: page title left, a search/filter pill, and
 * a dark "+ New Dashboard" CTA on the right.
 */
export function DashboardsHubToolbar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        paddingLeft: 24,
        paddingRight: 16,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>Dashboards</h1>
      <span style={{ flex: 1 }} />
      <PillButton icon={<SearchIcon />}>Search</PillButton>
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 12,
          paddingRight: 14,
          background: 'rgb(48, 48, 48)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <PlusIcon size={14} />
        New Dashboard
      </button>
    </div>
  );
}
