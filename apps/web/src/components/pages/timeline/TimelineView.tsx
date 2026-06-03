'use client';

/**
 * Timeline view. A horizontal time axis where tasks render as rounded bars
 * packed onto SWIMLANES grouped by a field (Assignee default, or Status). Unlike
 * Gantt (one task per row), each lane packs many non-overlapping tasks side by
 * side. Left rail holds lane labels; the chart has a sticky date header, a red
 * today line, weekend tints, Day/Week/Month zoom, drag-to-reschedule, click-to-
 * open, and right-click task menu.
 *
 * Route: /<wsId>/v/tl/:viewId  ->  <TimelineView scope=… />
 *
 * All task data flows through the shared `@/lib/view-scope` layer so the body
 * renders a single LIST (identical to before) or an entire SPACE/FOLDER
 * (every task across the scope's lists). ViewShell supplies the breadcrumb +
 * tab strip; ViewToolbar supplies the shared controls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANCHOR_NOW } from '@/lib/view-data';
import { scopeKey, useScopeTasks, type ViewScope } from '@/lib/view-scope';
import { useMembers } from '@/store/workspace/hooks';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar, type ViewToolbarControl } from '@/components/views/ViewToolbar';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { DEFAULT_ZOOM, TL, type TimelineGroupBy, type TimelineZoom } from './tokens';
import { buildAxis, xForMs, type TimelineAxis } from './axis';
import { buildSwimlanes } from './swimlanes';
import { useTimelineRange } from './useTimelineRange';
import { useTimelineDnd } from './useTimelineDnd';
import { TimelineToolbar, ZoomStepper } from './TimelineToolbar';
import { LaneRail } from './LaneRail';
import { TimelineChart } from './TimelineChart';
import { BacklogPanel } from './BacklogPanel';

const TOOLBAR_CONTROLS: ViewToolbarControl[] = [
  'filter',
  'closed',
  'assignee',
  'search',
  'customize',
  'addTask',
];

/**
 * How close (px) the viewport must come to either end of the chart before the
 * window lazily extends in that direction. One viewport-ish of slack keeps the
 * growth ahead of the user so the scroll never visibly hits a wall.
 */
const EDGE_TRIGGER_PX = 600;

export function TimelineView({ scope }: { scope: ViewScope }) {
  const key = scopeKey(scope);
  const tasks = useScopeTasks(scope);
  const members = useMembers();

  const [zoom, setZoom] = useState<TimelineZoom>(DEFAULT_ZOOM);
  const [groupBy, setGroupBy] = useState<TimelineGroupBy>('none');
  // ClickUp's Timeline opens with the right-hand "Tasks" panel visible by
  // default (Unscheduled / Overdue / Unassigned), so match that initial state.
  const [panelOpen, setPanelOpen] = useState(true);
  const [q, setQ] = useState('');

  const { onContextMenu, menu } = useTaskContextMenu();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((t) => t.name.toLowerCase().includes(needle));
  }, [tasks, q]);

  // The scrollable window is owned by useTimelineRange and grows lazily; the
  // axis is a pure projection of that window so it never re-derives bounds from
  // task data on every render.
  const { range, extendLeft, extendRight } = useTimelineRange(filtered, zoom);
  const axis = useMemo(() => buildAxis(range, zoom), [range, zoom]);
  const lanes = useMemo(
    () => buildSwimlanes(filtered, groupBy, members),
    [filtered, groupBy, members],
  );
  const dnd = useTimelineDnd(axis);
  const empty = lanes.length === 0;

  // The left rail only renders when real swimlanes exist (grouped). When
  // grouping is None, ClickUp collapses it to 0px, so the visible chart width is
  // the full scroller — the centering + edge-trigger math must use the same
  // offset the rail actually consumes.
  const railOffset = groupBy === 'none' ? 0 : TL.railWidth;
  const railOffsetRef = useRef(railOffset);
  railOffsetRef.current = railOffset;

  // Live axis for the (stable) scroll handler, plus a pending left-prepend
  // compensation. When the window grows on the left, content shifts right by the
  // prepended pixel width; we re-apply that to scrollLeft after the reflow so the
  // viewport stays anchored on the same calendar position.
  const axisRef = useRef<TimelineAxis>(axis);
  axisRef.current = axis;
  const pendingLeftPxRef = useRef(0);
  const extendingRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    const pending = pendingLeftPxRef.current;
    if (!el || pending === 0) return;
    el.scrollLeft += pending;
    pendingLeftPxRef.current = 0;
    extendingRef.current = false;
  }, [axis]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || extendingRef.current) return;
    const viewW = el.clientWidth - railOffsetRef.current;
    const max = axisRef.current.width - viewW;
    if (el.scrollLeft <= EDGE_TRIGGER_PX) {
      extendingRef.current = true;
      pendingLeftPxRef.current = extendLeft();
    } else if (el.scrollLeft >= max - EDGE_TRIGGER_PX) {
      extendingRef.current = true;
      extendRight();
      // Right growth needs no scroll compensation; release the guard on the
      // next frame once the wider axis has committed.
      requestAnimationFrame(() => {
        extendingRef.current = false;
      });
    }
  }, [extendLeft, extendRight]);

  const scrollToToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = xForMs(axisRef.current, ANCHOR_NOW);
    el.scrollTo({
      left: Math.max(0, x - (el.clientWidth - railOffsetRef.current) / 2),
      behavior: 'smooth',
    });
  }, []);

  // Center the wide initial window on "today" the first time the chart mounts,
  // so the user lands on the live date rather than the far-left padding edge.
  const centeredRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || centeredRef.current || empty) return;
    centeredRef.current = true;
    const x = xForMs(axisRef.current, ANCHOR_NOW);
    el.scrollLeft = Math.max(0, x - (el.clientWidth - railOffsetRef.current) / 2);
  });

  return (
    <ViewShell code="tl" viewId={key} scope={scope}>
      <div
        data-testid="timeline-view"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <ViewToolbar
          listId={key}
          viewId={key}
          controls={TOOLBAR_CONTROLS}
          searchValue={q}
          onSearchChange={setQ}
        />
        <TimelineToolbar
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          zoom={zoom}
          onZoom={setZoom}
          onToday={scrollToToday}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', background: TL.bg }}>
          {empty ? (
            <div style={{ padding: '32px 24px', color: TL.textMuted, fontSize: 13 }}>
              {q.trim()
                ? `No tasks match "${q.trim()}".`
                : 'No tasks to place on the timeline.'}
            </div>
          ) : (
            <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
              <div
                ref={scrollRef}
                onScroll={onScroll}
                style={{
                  height: '100%',
                  minHeight: 0,
                  minWidth: 0,
                  overflow: 'auto',
                  display: 'flex',
                }}
              >
                {/* ClickUp collapses the left rail to 0px when grouping is
                    None (`--cu-timeline-left-sidebar-width: 0px`): the flat
                    "All tasks" track has no label cell, so the chart spans the
                    full width. The rail only appears once real swimlanes exist. */}
                {groupBy !== 'none' && <LaneRail lanes={lanes} showHeader />}
                <TimelineChart
                  axis={axis}
                  lanes={lanes}
                  dnd={dnd}
                  onContextMenu={onContextMenu}
                />
              </div>

              {/* Zoom controls float over the canvas (ClickUp parity): a small
                  vertical +/- stepper pinned to the top-RIGHT of the chart canvas
                  (hugging the Tasks-panel edge, ~75px down) while the chart
                  scrolls underneath. */}
              <div style={{ position: 'absolute', top: 75, right: 12, zIndex: 5 }}>
                <ZoomStepper zoom={zoom} onZoom={setZoom} />
              </div>
            </div>
          )}

          {panelOpen && (
            <BacklogPanel
              tasks={tasks}
              onClose={() => setPanelOpen(false)}
              onContextMenu={onContextMenu}
            />
          )}
        </div>
      </div>
      {menu}
    </ViewShell>
  );
}
