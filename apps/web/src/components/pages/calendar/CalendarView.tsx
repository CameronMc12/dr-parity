'use client';

/**
 * Calendar view. Month grid (default) / week strip of task chips placed on their
 * resolved due/derived dates.
 *
 * Header chrome (breadcrumb + view tabs) comes from the shared `<ViewShell>`;
 * the toolbar row is the shared `<ViewToolbar>` so Filter / Closed / Assignee /
 * Search / Add Task are all real. The calendar's own month-nav strip (Today ·
 * month/week toggle · prev/next · month label) sits directly beneath it. Only
 * the grids below are owned by this view.
 *
 * Route: /<wsId>/v/cal/:viewId  ->  <CalendarView scope={{ kind:'list', listId }} />
 *
 * Data: scope-driven via useScopeTasks(scope) — identical rows to the List view
 * for a single list, and the union of every list's tasks for a space/folder
 * scope. Placement via deriveSpan/monthRange from '@/lib/view-data'. Chips open
 * the task modal, right-click opens the shared task context menu; empty days
 * create a dated task on the scope's default list; dragging a chip reschedules
 * its dueDate regardless of which list the task belongs to.
 */

import { useMemo, useState } from 'react';
import type { Task } from '@/lib/view-data';
import { scopeKey, useScopeTasks, type ViewScope } from '@/lib/view-scope';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar, type ViewToolbarControl } from '@/components/views/ViewToolbar';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { CAL } from './tokens';
import { useCalendarState } from './calendar-state';
import { useCalendarActions } from './use-calendar-actions';
import { CalendarMonthNav } from './CalendarHeader';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';
import { FourDayGrid } from './FourDayGrid';
import { DayGrid } from './DayGrid';
import { TasksSidebar } from './TasksSidebar';

const TOOLBAR_CONTROLS: ViewToolbarControl[] = [
  'filter',
  'closed',
  'assignee',
  'search',
  'customize',
  'addTask',
];

/** Filter tasks by a case-insensitive name match. */
function filterTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => t.name.toLowerCase().includes(q));
}

export function CalendarView({ scope }: { scope: ViewScope }) {
  // Stable key used for the chrome (breadcrumb/tabs) AND the toolbar's persisted
  // config. For a list scope this IS the listId, so ViewShell/ViewToolbar behave
  // exactly as before; a space/folder scope gets its own namespaced config slice.
  const key = scopeKey(scope);
  const tasks = useScopeTasks(scope);
  const cal = useCalendarState();
  const actions = useCalendarActions(scope);
  const { onContextMenu, menu } = useTaskContextMenu();

  const [q, setQ] = useState('');
  const visibleTasks = useMemo(() => filterTasks(tasks, q), [tasks, q]);

  return (
    <ViewShell code="cal" viewId={key} scope={scope}>
      {/*
        HEIGHT COUPLING (read before changing): this `height:'100%'` only resolves
        because ViewShell renders its children inside a `flex:1; minHeight:0`
        flex child with a definite height (see ViewShell). That gives this div a
        bounded parent, which the inner `flex:1` grid divs fill. If ViewShell's
        wrapper ever stops being a definite-height flex child, the grid collapses
        to zero height. ChatView documents the same dependency.
      */}
      <div
        data-testid="calendar-view"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: CAL.bg,
          color: CAL.textPrimary,
          overflow: 'hidden',
        }}
      >
        {/*
          Single toolbar row (ClickUp parity): the period-nav cluster sits on the
          LEFT and the shared working controls (Filter / Closed / Assignee /
          Search / Customize / Add Task) render to the RIGHT. ViewToolbar's own
          internal spacer pushes its controls to the far edge, so wrapping both in
          one flex row reproduces the real single-row layout. ViewToolbar owns the
          row's bottom border; the nav cluster is padded to match.
        */}
        <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 40,
              paddingLeft: 20,
              borderBottom: `1px solid ${CAL.gridBorder}`,
            }}
          >
            <CalendarMonthNav
              periodLabel={cal.periodLabel}
              viewType={cal.viewType}
              onPrev={cal.goPrev}
              onNext={cal.goNext}
              onToday={cal.goToday}
              onViewType={cal.setViewType}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ViewToolbar
              listId={key}
              viewId={key}
              controls={TOOLBAR_CONTROLS}
              searchValue={q}
              onSearchChange={setQ}
            />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {cal.viewType === 'month' && (
              <MonthGrid
                tasks={visibleTasks}
                scrollTarget={cal.scrollTarget}
                actions={actions}
                onChipContextMenu={onContextMenu}
              />
            )}
            {cal.viewType === 'week' && (
              <WeekGrid
                tasks={visibleTasks}
                weekStartMs={cal.weekStartMs}
                actions={actions}
                onChipContextMenu={onContextMenu}
              />
            )}
            {cal.viewType === '4days' && (
              <FourDayGrid
                tasks={visibleTasks}
                startMs={cal.fourDayStartMs}
                actions={actions}
                onChipContextMenu={onContextMenu}
              />
            )}
            {cal.viewType === 'day' && (
              <DayGrid
                tasks={visibleTasks}
                dayStartMs={cal.dayStartMs}
                actions={actions}
                onChipContextMenu={onContextMenu}
              />
            )}
          </div>
          <TasksSidebar
            tasks={tasks}
            actions={actions}
            onChipContextMenu={onContextMenu}
          />
        </div>
      </div>
      {menu}
    </ViewShell>
  );
}
