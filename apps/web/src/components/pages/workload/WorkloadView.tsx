'use client';

/**
 * Workload view. Team capacity over time: assignee lanes × day columns. Each cell
 * shows that assignee's scheduled load for the day ("<N>h", summing task
 * timeEstimate hours across the day's overlapping tasks) as a green capacity
 * pill; over the daily baseline it turns red. Hovering a cell lists its tasks;
 * click → open modal, right-click → task context menu.
 *
 * Mirrors the official ClickUp Workload chrome: a left toolbar cluster (Today /
 * metric / range / Daily-Scheduled / Save-view), the shared view toolbar, and a
 * sub-header (week-range stepper + show/hide eye + capacity face + day columns).
 *
 * Contract (do not change the export name):
 *   <WorkloadView scope={scope} />
 * For a single-list scope ({ kind: 'list', listId }) this renders identically to
 * the legacy per-list view; for a space/folder scope it aggregates every task
 * across the scope's lists into one workload-by-assignee chart.
 *
 * All task data flows through the scope hooks (`@/lib/view-scope`) and the
 * workspace store; dates come from `deriveSpan`; the modal opens via
 * `useUiStore().openTask`. Layout is anchored on the fixed ANCHOR_NOW so it's
 * stable across SSR/CSR.
 */

import { useMemo, useState } from 'react';
import { scopeKey, useScopeDefaultListId, useScopeTasks, type ViewScope } from '@/lib/view-scope';
import { useMembers } from '@/store/workspace/hooks';
import { useUiStore } from '@/store/ui-store';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { WorkloadToolbarLeft, BacklogToggle } from './WorkloadToolbar';
import { WorkloadGrid } from './WorkloadGrid';
import { WorkloadTasksPanel } from './WorkloadTasksPanel';
import {
  buildDays,
  buildLanes,
  buildMatrix,
  defaultWindowStart,
  rangeLabel,
  shiftWindow,
  type Lane,
  type ScheduleMode,
} from './periods';
import {
  loadWorkloadPrefs,
  saveWorkloadPrefs,
  clearWorkloadPrefs,
  type WorkloadPrefs,
} from './view-prefs';
import {
  WL,
  DAILY_CAPACITY_HOURS,
  type WorkloadMetric,
  type WorkloadRangeDays,
} from './tokens';

const TOOLBAR_CONTROLS = ['group', 'filter', 'closed', 'assignee', 'search', 'customize', 'addTask'] as const;

/** Day-column width per zoom level. Index 0 = most zoomed-out. */
const ZOOM_WIDTHS = [88, 116, 148] as const;
const DEFAULT_ZOOM = 1;

/** Factory-fresh toolbar config (what "Reset to default" restores to). */
const DEFAULT_PREFS: WorkloadPrefs = {
  metric: 'time',
  range: 14,
  schedule: 'Daily Scheduled',
  backlog: false,
  showEmpty: true,
  capacityOn: true,
  zoom: DEFAULT_ZOOM,
};

export function WorkloadView({ scope }: { scope: ViewScope }) {
  const key = scopeKey(scope);
  const shellViewId = useScopeDefaultListId(scope) || key;
  const tasks = useScopeTasks(scope);
  const members = useMembers();
  const openTask = useUiStore((s) => s.openTask);
  const { onContextMenu, menu } = useTaskContextMenu();

  // Hydrate the toolbar from any saved per-scope prefs; fall back to defaults.
  const initial = useMemo<WorkloadPrefs>(
    () => loadWorkloadPrefs(key) ?? DEFAULT_PREFS,
    [key],
  );

  const [metric, setMetric] = useState<WorkloadMetric>(initial.metric);
  const [range, setRange] = useState<WorkloadRangeDays>(initial.range);
  const [schedule, setSchedule] = useState<ScheduleMode>(initial.schedule);
  const [backlog, setBacklog] = useState(initial.backlog);
  const [windowStart, setWindowStart] = useState<number>(defaultWindowStart);
  const [showEmpty, setShowEmpty] = useState(initial.showEmpty);
  const [capacityOn, setCapacityOn] = useState(initial.capacityOn);
  const [zoom, setZoom] = useState(initial.zoom);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const days = useMemo(() => buildDays(range, windowStart), [range, windowStart]);
  const allLanes = useMemo(() => buildLanes(members, tasks), [members, tasks]);
  const matrix = useMemo(
    () => buildMatrix(tasks, allLanes, days, metric, schedule, backlog),
    [tasks, allLanes, days, metric, schedule, backlog],
  );

  function handleSaveAction(action: string): void {
    const current: WorkloadPrefs = {
      metric,
      range,
      schedule,
      backlog,
      showEmpty,
      capacityOn,
      zoom,
    };
    if (action === 'Save view') {
      saveWorkloadPrefs(key, current);
      return;
    }
    if (action === 'Save as new view') {
      saveWorkloadPrefs(`${key}:copy-${Date.now()}`, current);
      return;
    }
    if (action === 'Reset to default') {
      clearWorkloadPrefs(key);
      setMetric(DEFAULT_PREFS.metric);
      setRange(DEFAULT_PREFS.range);
      setSchedule(DEFAULT_PREFS.schedule);
      setBacklog(DEFAULT_PREFS.backlog);
      setShowEmpty(DEFAULT_PREFS.showEmpty);
      setCapacityOn(DEFAULT_PREFS.capacityOn);
      setZoom(DEFAULT_PREFS.zoom);
      setWindowStart(defaultWindowStart());
    }
  }

  const visibleLanes = useMemo<Lane[]>(() => {
    if (showEmpty) return allLanes;
    return allLanes.filter((l) => !matrix.emptyLaneIds.has(l.id));
  }, [allLanes, matrix.emptyLaneIds, showEmpty]);

  const hiddenEmptyCount = matrix.emptyLaneIds.size;
  const colWidth = ZOOM_WIDTHS[zoom] ?? ZOOM_WIDTHS[DEFAULT_ZOOM];
  const baseCapacity = capacityFor(metric);
  // When the capacity guide is off, no cell ever reads "over" (red), but the
  // lane label still shows the finite baseline so the number stays meaningful.
  const capacity = capacityOn ? baseCapacity : Number.POSITIVE_INFINITY;
  const label = useMemo(() => rangeLabel(days), [days]);

  const empty = allLanes.length === 0;

  return (
    <ViewShell code="wl" viewId={shellViewId} scope={scope}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 40,
            borderBottom: `1px solid ${WL.gridBorder}`,
            flexShrink: 0,
          }}
        >
          <WorkloadToolbarLeft
            metric={metric}
            onMetric={setMetric}
            range={range}
            onRange={setRange}
            schedule={schedule}
            onSchedule={setSchedule}
            onToday={() => setWindowStart(defaultWindowStart())}
            onSaveAction={handleSaveAction}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <ViewToolbar
              listId={key}
              controls={[...TOOLBAR_CONTROLS]}
              searchValue=""
              onSearchChange={() => undefined}
            />
          </div>
          <BacklogToggle active={backlog} onToggle={() => setBacklog((v) => !v)} />
        </div>

        {empty ? (
          <div style={{ padding: '32px 24px', color: WL.textMuted, fontSize: 13 }}>
            No people to chart on the workload.
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
              <WorkloadGrid
                lanes={visibleLanes}
                days={days}
                matrix={matrix}
                capacity={capacity}
                displayCapacity={baseCapacity}
                metric={metric}
                colWidth={colWidth}
                hiddenEmptyCount={hiddenEmptyCount}
                showEmpty={showEmpty}
                onToggleEmpty={() => setShowEmpty((v) => !v)}
                rangeLabel={label}
                onToday={() => setWindowStart(defaultWindowStart())}
                onPrevWeek={() => setWindowStart((w) => shiftWindow(w, -1))}
                onNextWeek={() => setWindowStart((w) => shiftWindow(w, 1))}
                capacityOn={capacityOn}
                onToggleCapacity={() => setCapacityOn((v) => !v)}
                onOpenTask={openTask}
                onContextMenu={onContextMenu}
                onZoomIn={() => setZoom((z) => Math.min(ZOOM_WIDTHS.length - 1, z + 1))}
                onZoomOut={() => setZoom((z) => Math.max(0, z - 1))}
              />
            </div>
            <WorkloadTasksPanel
              tasks={tasks}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              onOpenTask={openTask}
              onContextMenu={onContextMenu}
            />
          </div>
        )}
      </div>
      {menu}
    </ViewShell>
  );
}

/** Daily capacity baseline per metric (hours for time, units for tasks/points). */
function capacityFor(metric: WorkloadMetric): number {
  if (metric === 'tasks') return 3;
  if (metric === 'points') return 5;
  return DAILY_CAPACITY_HOURS;
}
