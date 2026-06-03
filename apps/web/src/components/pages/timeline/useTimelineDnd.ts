'use client';

/**
 * Pointer controller for Timeline bar drag-to-reschedule. A bar is dragged
 * horizontally; the live pixel delta drives an optimistic preview, and on
 * pointer-up the resolved whole-day delta is committed to the store as explicit
 * start+due via updateTask.
 *
 * Dates are committed as both endpoints so a previously date-less task (rendered
 * from its deterministic deriveSpan) becomes a real, persisted span the moment
 * it's moved — matching ClickUp's drag-to-schedule behaviour.
 */

import { useCallback, useRef, useState } from 'react';
import { DAY_MS, deriveSpan, startOfDay } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { useWorkspaceStore } from '@/store/workspace';
import { pxToDays, type TimelineAxis } from './axis';

/** Pixels a pointer must travel before a gesture counts as a drag (not a click). */
export const DRAG_THRESHOLD_PX = 3;

interface ActiveDrag {
  taskId: string;
  startX: number;
  deltaPx: number;
}

export interface TimelineDnd {
  /** Currently dragging task id, or null. */
  activeId: string | null;
  /** Live pixel delta for the dragging bar. */
  deltaPx: number;
  /** Begin a drag from a pointer-down on a bar. */
  onBarPointerDown: (task: Task) => (e: React.PointerEvent) => void;
  /**
   * Reads whether the active gesture has moved past the drag threshold. This is
   * a side-effect-free read of a ref the move handler mutates, so a bar can
   * suppress the trailing click without mutating refs during render.
   */
  hasMoved: () => boolean;
  /**
   * Schedule a backlog (date-less) task by dropping it at a chart-local x. The
   * x is in axis pixels (already net of scroll + rail). Commits a 1-day span at
   * the dropped day via updateTask, matching ClickUp's drag-to-schedule.
   */
  scheduleAtX: (taskId: string, localX: number) => void;
}

/** Shift a span by a whole-day delta, returning explicit start+due ms. */
function commitMove(task: Task, dayDelta: number): { startDate: number; dueDate: number } {
  const span = deriveSpan(task);
  const shift = dayDelta * DAY_MS;
  return {
    startDate: startOfDay(span.start) + shift,
    dueDate: startOfDay(span.end) + shift,
  };
}

export function useTimelineDnd(axis: TimelineAxis): TimelineDnd {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const movedRef = useRef(false);
  const axisRef = useRef(axis);
  axisRef.current = axis;

  const onBarPointerDown = useCallback(
    (task: Task) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const next: ActiveDrag = { taskId: task.id, startX: e.clientX, deltaPx: 0 };
      dragRef.current = next;
      movedRef.current = false;
      setDrag(next);

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        cur.deltaPx = ev.clientX - cur.startX;
        // Genuine side effect of pointer movement — not a render-path mutation.
        if (Math.abs(cur.deltaPx) > DRAG_THRESHOLD_PX) movedRef.current = true;
        setDrag({ ...cur });
      };

      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        const cur = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!cur) return;
        const dayDelta = pxToDays(axisRef.current, ev.clientX - cur.startX);
        if (dayDelta !== 0) {
          // `tasks` is Record<string, Task> keyed by id (see tasks.slice.ts), so
          // this reads the freshest task and avoids the stale pointer-down closure.
          const latest = useWorkspaceStore.getState().tasks[cur.taskId] ?? task;
          updateTask(cur.taskId, commitMove(latest, dayDelta));
        }
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [updateTask],
  );

  const hasMoved = useCallback(() => movedRef.current, []);

  const scheduleAtX = useCallback(
    (taskId: string, localX: number) => {
      const ax = axisRef.current;
      const day = ax.origin + Math.round(localX / ax.dayWidth) * DAY_MS;
      const start = startOfDay(day);
      // 1-day default span (end of the dropped day) so startDate < dueDate holds
      // and downstream date logic never sees a zero-length span — matches
      // ClickUp's drag-to-schedule.
      updateTask(taskId, { startDate: start, dueDate: start + DAY_MS });
    },
    [updateTask],
  );

  return {
    activeId: drag?.taskId ?? null,
    deltaPx: drag?.deltaPx ?? 0,
    onBarPointerDown,
    hasMoved,
    scheduleAtX,
  };
}
