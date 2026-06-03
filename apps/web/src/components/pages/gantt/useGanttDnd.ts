'use client';

/**
 * Pointer controller for Gantt bar interactions: move (drag the whole bar to
 * reschedule) and resize (drag an edge to change duration). The active drag is
 * tracked as a live pixel delta so the bar can render an optimistic preview;
 * on pointer-up the resolved day-delta is committed to the store via updateTask.
 *
 * Dates are committed as explicit start+due so a previously date-less task
 * (rendered from its deterministic deriveSpan) becomes a real, persisted span
 * the moment the user moves it — matching ClickUp's drag-to-schedule behaviour.
 */

import { useCallback, useRef, useState } from 'react';
import { DAY_MS, deriveSpan, startOfDay } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { useWorkspaceStore } from '@/store/workspace';
import { pxToDays, type TimelineAxis } from './timeline';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

interface ActiveDrag {
  taskId: string;
  mode: DragMode;
  startX: number;
  deltaPx: number;
}

export interface GanttDnd {
  /** Currently dragging task id, or null. */
  activeId: string | null;
  /** Live pixel delta for the dragging bar (move = whole-bar shift). */
  deltaPx: number;
  /** Active drag mode (which handle), or null. */
  mode: DragMode | null;
  /** Begin a drag from a pointer-down on a bar or one of its edges. */
  onBarPointerDown: (task: Task, mode: DragMode) => (e: React.PointerEvent) => void;
}

/** Apply a whole-day shift / resize to a span and return explicit start+due ms. */
function commitDates(task: Task, mode: DragMode, dayDelta: number): { startDate: number; dueDate: number } {
  const span = deriveSpan(task);
  let start = startOfDay(span.start);
  let end = startOfDay(span.end);
  const shift = dayDelta * DAY_MS;

  if (mode === 'move') {
    start += shift;
    end += shift;
  } else if (mode === 'resize-start') {
    start = Math.min(start + shift, end);
  } else {
    end = Math.max(end + shift, start);
  }
  return { startDate: start, dueDate: end };
}

/**
 * When "Reschedule dependencies" is on, a whole-bar MOVE cascades the same
 * day-shift onto every downstream task linked from the dragged one (one level
 * deep, which is enough for the seeded fixtures and avoids cycle handling).
 */
function cascadeLinkedShift(taskId: string, dayDelta: number, updateTask: (id: string, patch: { startDate: number; dueDate: number }) => void) {
  const tasks = useWorkspaceStore.getState().tasks;
  const source = tasks[taskId];
  const links = source?.linkedTaskIds ?? [];
  for (const id of links) {
    const dep = tasks[id];
    if (!dep) continue;
    updateTask(id, commitDates(dep, 'move', dayDelta));
  }
}

export function useGanttDnd(axis: TimelineAxis, rescheduleDeps: boolean): GanttDnd {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const axisRef = useRef(axis);
  axisRef.current = axis;
  const rescheduleRef = useRef(rescheduleDeps);
  rescheduleRef.current = rescheduleDeps;

  const onBarPointerDown = useCallback(
    (task: Task, mode: DragMode) => (e: React.PointerEvent) => {
      // Left button only; don't trigger the row's open-task click.
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const next: ActiveDrag = { taskId: task.id, mode, startX: e.clientX, deltaPx: 0 };
      dragRef.current = next;
      setDrag(next);

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        const deltaPx = ev.clientX - cur.startX;
        cur.deltaPx = deltaPx;
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
          const latest = useWorkspaceStore.getState().tasks[cur.taskId] ?? task;
          updateTask(cur.taskId, commitDates(latest, cur.mode, dayDelta));
          // Cascade to linked successors only on a whole-bar move with the
          // "Reschedule dependencies" toggle active.
          if (cur.mode === 'move' && rescheduleRef.current) {
            cascadeLinkedShift(cur.taskId, dayDelta, updateTask);
          }
        }
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [updateTask],
  );

  return {
    activeId: drag?.taskId ?? null,
    deltaPx: drag?.deltaPx ?? 0,
    mode: drag?.mode ?? null,
    onBarPointerDown,
  };
}
