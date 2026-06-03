'use client';

/**
 * HTML5 drag-and-drop controller for the Kanban board. Tracks which card is being
 * dragged and the hovered (column, index) drop slot, exposes an optimistic
 * preview ordering so the card visually moves as you drag, and commits the move
 * to the workspace store on drop:
 *   - cross-column drop  -> updateTask(status/statusColor/statusType) + reorderTasks
 *   - same-column drop   -> reorderTasks (manual `order`)
 *
 * No external dnd library — pure native drag events, so it adds zero bundle cost.
 */

import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import type { StatusColumn } from '@/lib/view-data';

interface DragState {
  taskId: string;
  fromKey: string;
}

interface DropTarget {
  columnKey: string;
  index: number;
}

export interface BoardDnd {
  draggingId: string | null;
  /** Per-column ordered task list with the in-flight optimistic preview applied. */
  preview: Record<string, Task[]>;
  startDrag: (taskId: string, fromKey: string) => void;
  endDrag: () => void;
  setDropTarget: (columnKey: string, index: number) => void;
  /** True while a card hovers this empty column (drop-zone highlight). */
  isColumnActive: (columnKey: string) => boolean;
  /** True when the drop indicator line should render at (columnKey, index). */
  isSlotActive: (columnKey: string, index: number) => boolean;
  commit: () => void;
}

function statusFieldsFor(col: StatusColumn, columns: StatusColumn[]): Partial<Task> {
  const sample = col.tasks[0] ?? columns.flatMap((c) => c.tasks).find((t) => t.status === col.status);
  if (sample) {
    return { status: sample.status, statusColor: sample.statusColor, statusType: sample.statusType };
  }
  // Empty (user-added) group: no task to infer from — default to a non-terminal
  // custom status so the card stays "active", not accidentally closed.
  return { status: col.status, statusColor: col.color, statusType: 'custom' };
}

export function useBoardDnd(columns: StatusColumn[]): BoardDnd {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const reorderTasks = useWorkspaceStore((s) => s.reorderTasks);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  const base = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.key] = col.tasks;
    return map;
  }, [columns]);

  // Optimistic preview: remove the dragged card from its source list and splice
  // it into the hovered slot so the board reflows live during the drag.
  const preview = useMemo(() => {
    if (!drag || !target) return base;
    const next: Record<string, Task[]> = {};
    for (const [key, list] of Object.entries(base)) {
      next[key] = list.filter((t) => t.id !== drag.taskId);
    }
    const dragged = base[drag.fromKey]?.find((t) => t.id === drag.taskId);
    if (!dragged) return base;
    const dest = next[target.columnKey] ?? [];
    const idx = Math.max(0, Math.min(target.index, dest.length));
    next[target.columnKey] = [...dest.slice(0, idx), dragged, ...dest.slice(idx)];
    return next;
  }, [base, drag, target]);

  const startDrag = useCallback((taskId: string, fromKey: string) => {
    setDrag({ taskId, fromKey });
  }, []);

  const endDrag = useCallback(() => {
    setDrag(null);
    setTarget(null);
  }, []);

  const setDropTarget = useCallback(
    (columnKey: string, index: number) => {
      setTarget((prev) =>
        prev && prev.columnKey === columnKey && prev.index === index ? prev : { columnKey, index },
      );
    },
    [],
  );

  const isColumnActive = useCallback(
    (columnKey: string) => !!drag && target?.columnKey === columnKey,
    [drag, target],
  );

  const isSlotActive = useCallback(
    (columnKey: string, index: number) =>
      !!drag && target?.columnKey === columnKey && target?.index === index,
    [drag, target],
  );

  const commit = useCallback(() => {
    if (!drag || !target) {
      endDrag();
      return;
    }
    const destCol = columns.find((c) => c.key === target.columnKey);
    if (!destCol) {
      endDrag();
      return;
    }

    // Status change first (cross-column), then persist a GLOBAL ordering. We
    // re-sequence every column in display order off the optimistic preview, so
    // `order` stays globally monotonic and sibling columns keep non-overlapping
    // indexes (a destination-only reorder would clash with other columns at 0).
    if (drag.fromKey !== target.columnKey) {
      updateTask(drag.taskId, statusFieldsFor(destCol, columns));
    }
    const globalOrder = columns.flatMap((col) => (preview[col.key] ?? col.tasks).map((t) => t.id));
    reorderTasks(globalOrder);
    endDrag();
  }, [drag, target, columns, preview, updateTask, reorderTasks, endDrag]);

  return {
    draggingId: drag?.taskId ?? null,
    preview,
    startDrag,
    endDrag,
    setDropTarget,
    isColumnActive,
    isSlotActive,
    commit,
  };
}
