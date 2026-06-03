'use client';

/**
 * Calendar interaction controller. Owns the in-flight drag id and exposes the
 * store-backed mutations a calendar cell needs: reschedule (drop a chip onto a
 * day → set its dueDate) and quick-create (click an empty day → new task dated
 * to that day, then open it in the task modal). All writes go through the shared
 * workspace + ui stores — no local fake state.
 */

import { useCallback, useState } from 'react';
import { endOfDay } from '@/lib/view-data';
import { useScopeDefaultListId, type ViewScope } from '@/lib/view-scope';
import { useWorkspaceStore } from '@/store/workspace';
import { useUiStore } from '@/store/ui-store';

export interface CalendarActions {
  draggingId: string | null;
  beginDrag: (taskId: string) => void;
  endDrag: () => void;
  /** Reschedule `taskId` onto `dayMs` (sets dueDate to that day's end). */
  rescheduleTo: (taskId: string, dayMs: number) => void;
  /** Unschedule `taskId` (clears dueDate so it returns to the sidebar). */
  unscheduleTask: (taskId: string) => void;
  /** Create a task dated to `dayMs` and open it for editing. */
  createOnDay: (dayMs: number) => void;
  /**
   * Inline quick-create (ClickUp cell `+` composer): create a named task dated to
   * `dayMs` WITHOUT opening the modal. Empty names fall back to "New Task".
   */
  quickCreateOnDay: (dayMs: number, name: string) => void;
}

export function useCalendarActions(scope: ViewScope): CalendarActions {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const targetListId = useScopeDefaultListId(scope);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const openTask = useUiStore((s) => s.openTask);

  const beginDrag = useCallback((taskId: string) => setDraggingId(taskId), []);
  const endDrag = useCallback(() => setDraggingId(null), []);

  const rescheduleTo = useCallback(
    (taskId: string, dayMs: number) => {
      if (!taskId) return;
      updateTask(taskId, { dueDate: endOfDay(dayMs) });
      setDraggingId(null);
    },
    [updateTask],
  );

  const unscheduleTask = useCallback(
    (taskId: string) => {
      if (!taskId) return;
      updateTask(taskId, { dueDate: null });
      setDraggingId(null);
    },
    [updateTask],
  );

  const createOnDay = useCallback(
    (dayMs: number) => {
      if (!targetListId) return;
      const task = createTask({ name: 'New Task', listId: targetListId, dueDate: endOfDay(dayMs) });
      openTask(task.id);
    },
    [targetListId, createTask, openTask],
  );

  const quickCreateOnDay = useCallback(
    (dayMs: number, name: string) => {
      if (!targetListId) return;
      const trimmed = name.trim();
      createTask({ name: trimmed || 'New Task', listId: targetListId, dueDate: endOfDay(dayMs) });
    },
    [targetListId, createTask],
  );

  return {
    draggingId,
    beginDrag,
    endDrag,
    rescheduleTo,
    unscheduleTask,
    createOnDay,
    quickCreateOnDay,
  };
}
