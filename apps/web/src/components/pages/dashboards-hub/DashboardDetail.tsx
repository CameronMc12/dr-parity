'use client';

/**
 * A single dashboard inside the hub. Renders the dashboard's widget grid, each
 * widget computed from the real workspace tasks store. A filter bar (status +
 * assignee) narrows the underlying task set and every widget recomputes.
 */

import { useMemo, useState } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import type { DashboardEntry } from '@/data/dashboards-seed';
import { useHubMetrics, EMPTY_HUB_FILTER, type HubFilterState } from './hub-metrics';
import { HubFilterBar } from './HubFilterBar';
import { Widget } from './widgets';
import { ChevronLeftIcon } from './dashboards-hub-icons';

export function DashboardDetail({
  dashboard,
  onBack,
}: {
  dashboard: DashboardEntry;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<HubFilterState>(EMPTY_HUB_FILTER);
  const { metrics, members, allStatuses } = useHubMetrics(filter);

  const filterActive = filter.statuses.length > 0 || filter.assignees.length > 0;

  const grid = useMemo(
    () =>
      dashboard.widgets.map((kind, i) => (
        <Widget key={`${kind}-${i}`} kind={kind} metrics={metrics} />
      )),
    [dashboard.widgets, metrics],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 56,
          padding: '8px 16px 8px 12px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to dashboards"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_SECONDARY,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.2 }}>
            {dashboard.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TEXT_MUTED,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dashboard.description}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <HubFilterBar
          statuses={allStatuses}
          members={members}
          filter={filter}
          onChange={setFilter}
        />
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, background: 'var(--cu-bg-app, rgb(249, 250, 251))' }}>
        {filterActive && (
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14 }}>
            Showing {metrics.total} filtered {metrics.total === 1 ? 'task' : 'tasks'}.
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {grid}
        </div>
      </div>
    </div>
  );
}
