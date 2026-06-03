'use client';

/**
 * `useTaskContextMenu` — wire any view's task element to the shared right-click
 * `TaskContextMenu`.
 *
 * A view calls the hook once, spreads the returned `onContextMenu` onto each
 * task element (passing that task), and renders `menu` once anywhere in its
 * tree. Right-clicking opens the ClickUp task menu at the cursor; outside-click
 * and Escape close it. The native browser menu is suppressed.
 *
 * Sibling tasks of the opened task's list are pulled from the workspace store so
 * the "Set status" submenu shows that list's real status set without the caller
 * having to supply anything.
 *
 * @example
 *   const { onContextMenu, menu } = useTaskContextMenu();
 *   return (
 *     <>
 *       {tasks.map((t) => (
 *         <div key={t.id} onContextMenu={(e) => onContextMenu(e, t)}>{t.name}</div>
 *       ))}
 *       {menu}
 *     </>
 *   );
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import {
  TaskContextMenu,
  type TaskContextMenuPos,
} from './TaskContextMenu';

interface OpenState {
  task: Task;
  pos: TaskContextMenuPos;
}

export interface UseTaskContextMenu {
  /** Spread onto each task element: `onContextMenu={(e) => onContextMenu(e, task)}`. */
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  /** Render once per view. Null while closed. */
  menu: ReactElement | null;
  /** Imperative close (rarely needed; outside-click + Escape already handle it). */
  close: () => void;
}

/**
 * @param onRename Optional per-view inline-rename starter. Receives the task
 *   whose row was right-clicked. When omitted, "Rename" opens the task modal.
 */
export function useTaskContextMenu(onRename?: (task: Task) => void): UseTaskContextMenu {
  const [state, setState] = useState<OpenState | null>(null);
  const tasks = useWorkspaceStore((s) => s.tasks);

  const onContextMenu = useCallback((e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ task, pos: { x: e.clientX, y: e.clientY } });
  }, []);

  const close = useCallback(() => setState(null), []);

  // Sibling tasks of the opened task's list (drives the live status submenu).
  const listTasks = useMemo(() => {
    if (!state) return [];
    return Object.values(tasks).filter(
      (t) => t.listId === state.task.listId && !t.archived,
    );
  }, [tasks, state]);

  const menu = state ? (
    <TaskContextMenu
      task={state.task}
      listTasks={listTasks}
      pos={state.pos}
      onClose={close}
      onRename={onRename ? () => onRename(state.task) : undefined}
    />
  ) : null;

  return { onContextMenu, menu, close };
}
