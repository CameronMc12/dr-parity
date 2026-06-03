'use client';

/**
 * Gantt (Timeline) view. A left task table synced to a right timeline chart:
 * one bar per task spanning its resolved start→due (coloured by status or
 * priority), milestone diamonds for due-only tasks, a red today line + badge,
 * weekend hatch tints, day/week/month zoom, Auto-fit, drag-to-reschedule +
 * edge-resize, dependency connectors (waiting / linked), and click-to-open.
 *
 * Header chrome (breadcrumb + view-tab strip) comes from the shared `<ViewShell>`.
 * The Gantt control row brackets the shared `<ViewToolbar>`:
 *   LEFT  — pane collapse | Today | zoom dropdown | Auto fit | Export.
 *   RIGHT — dependency-mode toggles + ViewToolbar (sort/filter/closed/assignee/
 *           search/customize/addTask).
 *
 * Scope-driven: every data hook reads from the `scope` prop, so this renders a
 * single LIST identically to before, or an entire SPACE/FOLDER by aggregating
 * every task across the scope's lists. Config/toolbar/breadcrumb key off
 * `scopeKey(scope)` so a space persists its own config without colliding with a
 * list id. For a `{ kind:'list' }` scope `scopeKey === listId`, so every key and
 * task set is byte-identical to the previous viewId-driven path.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { ANCHOR_NOW, deriveSpan, type Task } from '@/lib/view-data';
import {
  scopeKey,
  useScopeConfig,
  useScopeDefaultListId,
  useScopeTasks,
  type ViewScope,
} from '@/lib/view-scope';
import { buildGroups } from '@/components/pages/listview/grouping';
import { useMembers } from '@/store/workspace/hooks';
import { useWorkspaceStore } from '@/store/workspace';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar, type ViewToolbarControl } from '@/components/views/ViewToolbar';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ZOOM_ORDER, type DependencyMode, type GanttZoom } from './tokens';
import { GANTT } from './tokens';
import { GanttToolbarLeft, GanttDependencyToggles } from './GanttChrome';
import { GanttTaskTable } from './GanttTaskTable';
import { GanttTimeline } from './GanttTimeline';
import { flattenRows } from './rows';
import { autoFitDayWidth, buildAxis, xForMs } from './timeline';
import { useGanttDnd } from './useGanttDnd';

export type GanttColorBy = 'status' | 'priority';

const TOOLBAR_CONTROLS: ViewToolbarControl[] = [
  'sort',
  'filter',
  'closed',
  'assignee',
  'search',
  'customize',
  'addTask',
];

/** Case-insensitive name match on the flat task list before grouping. */
function filterByQuery(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => t.name.toLowerCase().includes(q));
}

export function GanttView({ scope }: { scope: ViewScope }) {
  const key = scopeKey(scope);
  const targetListId = useScopeDefaultListId(scope);
  const tasks = useScopeTasks(scope);
  const config = useScopeConfig(scope);
  const members = useMembers();
  const createTask = useWorkspaceStore((s) => s.createTask);

  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<GanttZoom>('week');
  const [fitWidth, setFitWidth] = useState<number | undefined>(undefined);
  const [colorBy] = useState<GanttColorBy>('status');
  const [paneCollapsed, setPaneCollapsed] = useState(false);
  // ClickUp's three right-cluster controls. `rescheduleDependencies` is on by
  // default (matches the captured active state); critical-path + baselines off.
  const [rescheduleDeps, setRescheduleDeps] = useState(true);
  const [criticalPath, setCriticalPath] = useState(false);
  // Baselines have no toolbar control in the captured Gantt, so they stay off:
  // the timeline receives `undefined` and skips its ghost-bar overlay.
  const showBaselines = false;
  const baselines: Record<string, { start: number; end: number }> = {};
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Dependency line style follows the critical-path toggle: solid red when the
  // critical path is highlighted, lighter "linked" style otherwise.
  const depMode: DependencyMode = criticalPath ? 'waiting' : 'linked';

  const { onContextMenu, menu } = useTaskContextMenu();

  const timelineRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLDivElement>(null);

  // Sync the follower task-table's translateY directly via DOM write — no
  // per-frame re-render of the view tree on scroll.
  const syncScroll = useCallback((scrollTop: number) => {
    const el = tableInnerRef.current;
    if (el) el.style.transform = `translateY(-${scrollTop}px)`;
  }, []);

  // Search narrows the flat list; ViewToolbar's group/filter/assignee/closed
  // config is honoured by `buildGroups` (same engine the List view uses).
  const searched = useMemo(() => filterByQuery(tasks, q), [tasks, q]);
  const groups = useMemo(
    () => buildGroups(searched, config, members),
    [searched, config, members],
  );
  const rows = useMemo(() => flattenRows(groups, collapsed), [groups, collapsed]);
  const axis = useMemo(() => buildAxis(searched, zoom, fitWidth), [searched, zoom, fitWidth]);
  const dnd = useGanttDnd(axis, rescheduleDeps);

  // True (unpadded) data span — seeds the Export modal's Start / End dates.
  const dataSpan = useMemo(() => {
    let start = ANCHOR_NOW;
    let end = ANCHOR_NOW;
    let seen = false;
    for (const t of searched) {
      const span = deriveSpan(t);
      if (!seen || span.start < start) start = span.start;
      if (!seen || span.end > end) end = span.end;
      seen = true;
    }
    return { start, end };
  }, [searched]);

  // Changing zoom (dropdown or +/- stepper) resets any Auto-fit override.
  // "Flexible" is itself an auto-fit mode, so it fits the data span to the
  // visible timeline width instead of using a fixed per-zoom dayWidth.
  const changeZoom = useCallback(
    (z: GanttZoom) => {
      setZoom(z);
      if (z === 'flexible') {
        const el = timelineRef.current;
        const target = el ? el.clientWidth - 24 : 960;
        setFitWidth(autoFitDayWidth(searched, z, target));
      } else {
        setFitWidth(undefined);
      }
    },
    [searched],
  );

  const zoomIn = useCallback(() => {
    setFitWidth(undefined);
    setZoom((z) => ZOOM_ORDER[Math.max(0, ZOOM_ORDER.indexOf(z) - 1)] ?? z);
  }, []);
  const zoomOut = useCallback(() => {
    setFitWidth(undefined);
    setZoom((z) => ZOOM_ORDER[Math.min(ZOOM_ORDER.length - 1, ZOOM_ORDER.indexOf(z) + 1)] ?? z);
  }, []);

  const autoFit = useCallback(() => {
    const el = timelineRef.current;
    const target = el ? el.clientWidth - 24 : 960;
    setFitWidth(autoFitDayWidth(searched, zoom, target));
  }, [searched, zoom]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const scrollToToday = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    const x = xForMs(axis, ANCHOR_NOW);
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
  }, [axis]);

  // Add a task into a group, seeding the group's status when grouping by status.
  const addTask = useCallback(
    (groupKey: string) => {
      const group = groups.find((g) => g.key === groupKey);
      const seed = group?.tasks[0];
      createTask({
        name: 'New Task',
        listId: targetListId,
        ...(seed && config.groupBy === 'status'
          ? { status: seed.status, statusColor: seed.statusColor, statusType: seed.statusType }
          : {}),
      });
    },
    [groups, createTask, targetListId, config.groupBy],
  );

  const empty = rows.length === 0;

  return (
    <ViewShell code="gtt" viewId={key} scope={scope}>
      <div
        data-testid="gantt-view"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: GANTT.bg,
          color: GANTT.textPrimary,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${GANTT.gridBorder}`,
            flexShrink: 0,
          }}
        >
          <GanttToolbarLeft
            zoom={zoom}
            onZoom={changeZoom}
            onToday={scrollToToday}
            onAutoFit={autoFit}
            paneCollapsed={paneCollapsed}
            onTogglePane={() => setPaneCollapsed((v) => !v)}
            spanStart={dataSpan.start}
            spanEnd={dataSpan.end}
          />
          <span style={{ flex: 1, minWidth: 0 }} />
          <GanttDependencyToggles
            state={{
              rescheduleDependencies: rescheduleDeps,
              criticalPath,
            }}
            onToggleReschedule={() => setRescheduleDeps((v) => !v)}
            onToggleCriticalPath={() => setCriticalPath((v) => !v)}
          />
          <ViewToolbar
            listId={key}
            viewId={key}
            controls={TOOLBAR_CONTROLS}
            searchValue={q}
            onSearchChange={setQ}
          />
        </div>

        {empty ? (
          <div style={{ padding: '32px 24px', color: GANTT.textMuted, fontSize: 13 }}>
            {q.trim()
              ? 'No tasks match your search.'
              : 'No tasks to schedule on the timeline.'}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {!paneCollapsed && (
              <GanttTaskTable
                ref={tableInnerRef}
                rows={rows}
                width={GANTT.labelColWidth}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onAddTask={addTask}
                onTaskContextMenu={onContextMenu}
              />
            )}
            <GanttTimeline
              ref={timelineRef}
              axis={axis}
              rows={rows}
              colorBy={colorBy}
              dependencyMode={depMode}
              criticalPath={criticalPath}
              baselines={showBaselines ? baselines : undefined}
              dnd={dnd}
              onScroll={syncScroll}
              onTaskContextMenu={onContextMenu}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
            />
          </div>
        )}
      </div>
      {menu}
    </ViewShell>
  );
}
