'use client';

/**
 * Map view. Geographic task locations on an inline SVG world map. Our tasks carry
 * no real geo field, so each task is given a STABLE pseudo-location (its id hashed
 * to one of eight well-known cities + a small deterministic jitter) and projected
 * onto the map. A left panel lists tasks with their derived city; hovering a row
 * or pin cross-highlights the other; clicking opens the task; right-click opens
 * the shared task context menu. Nearby pins collapse into a count badge that fans
 * out on click.
 *
 * Route: /<wsId>/v/map/:viewId  ->  <MapView viewId=… />
 * Owns the whole `map/` folder; sources every row through `@/lib/view-data`.
 */

import { useMemo, useState } from 'react';
import { resolveViewListId, useViewTasks } from '@/lib/view-data';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { ViewShell } from '@/components/views/ViewShell';
import { useUiStore } from '@/store/ui-store';
import { clusterTasks, placeTask } from './geo';
import { MapCanvas } from './MapCanvas';
import { MapTaskList } from './MapTaskList';
import { MAP } from './tokens';

/** SVG-space cell edge used to grid-cluster overlapping pins. */
const CLUSTER_CELL = 26;

export function MapView({ viewId }: { viewId: string }) {
  const listId = resolveViewListId(viewId);
  const tasks = useViewTasks(viewId);
  const openTask = useUiStore((s) => s.openTask);
  const { onContextMenu, menu } = useTaskContextMenu();

  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.name.toLowerCase().includes(q));
  }, [tasks, query]);

  const placed = useMemo(() => filtered.map(placeTask), [filtered]);
  const clusters = useMemo(() => clusterTasks(placed, CLUSTER_CELL), [placed]);

  return (
    <ViewShell code="map" viewId={viewId}>
      <div
        style={{
          // ViewShell wraps children in an `overflow: auto` slot. The map must
          // fill that slot without becoming a scroll region, so break out with
          // absolute positioning (matches ClickUp's full-bleed map pane).
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          background: MAP.bg,
          color: MAP.textPrimary,
        }}
      >
        <ViewToolbar
          listId={listId}
          viewId={viewId}
          controls={['filter', 'assignee', 'search', 'addTask']}
          searchValue={query}
          onSearchChange={setQuery}
        />

        <div
          data-testid="map-view"
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <MapTaskList
            placed={placed}
            hoveredId={hoveredId}
            onOpen={openTask}
            onContextMenu={onContextMenu}
            onHover={setHoveredId}
          />
          <MapCanvas
            clusters={clusters}
            expandedKey={expandedKey}
            onExpand={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
            onOpen={openTask}
            onContextMenu={onContextMenu}
            onHover={setHoveredId}
            hoveredId={hoveredId}
          />
        </div>
      </div>

      {menu}
    </ViewShell>
  );
}
