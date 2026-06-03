'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { ListGroup } from './grouping';

export interface DropTarget {
  taskId: string;
  /** Insert before or after the target row. */
  edge: 'before' | 'after';
}

export interface ListDnd {
  draggingId: string | null;
  dropTarget: DropTarget | null;
  isDragging: boolean;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onRowDragOver: (taskId: string, edge: 'before' | 'after') => void;
  /** Drop onto a specific row in a group (reorder + optional status move). */
  onDropOnRow: (group: ListGroup) => void;
  /** Drop into a group with no specific row target (append to end). */
  onDropOnGroup: (group: ListGroup) => void;
}

interface GroupApply {
  /** Patch applied to a task moved into this group (e.g. status fields). */
  groupPatch: (group: ListGroup) => Record<string, unknown>;
}

/**
 * Pointer/HTML5 drag-and-drop controller for the List view.
 *
 * Reorder within a group rewrites every sibling's `order`. Dropping into a
 * different group additionally applies the group's identity (status / priority)
 * so the task changes column, then re-sequences the destination group.
 */
export function useListDnd(groups: ListGroup[], apply: GroupApply): ListDnd {
  const reorderTasks = useWorkspaceStore((s) => s.reorderTasks);
  const updateTask = useWorkspaceStore((s) => s.updateTask);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const draggingRef = useRef<string | null>(null);

  const onDragStart = useCallback((taskId: string) => {
    draggingRef.current = taskId;
    setDraggingId(taskId);
  }, []);

  const onDragEnd = useCallback(() => {
    draggingRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const onRowDragOver = useCallback((taskId: string, edge: 'before' | 'after') => {
    if (draggingRef.current === taskId) {
      setDropTarget(null);
      return;
    }
    setDropTarget((prev) =>
      prev?.taskId === taskId && prev.edge === edge ? prev : { taskId, edge },
    );
  }, []);

  const commit = useCallback(
    (group: ListGroup, targetTaskId: string | null, edge: 'before' | 'after') => {
      const moved = draggingRef.current;
      onDragEnd();
      if (!moved) return;

      // Destination group's task ids minus the dragged one.
      const destIds = group.tasks.map((t) => t.id).filter((id) => id !== moved);

      let insertAt = destIds.length;
      if (targetTaskId && targetTaskId !== moved) {
        const idx = destIds.indexOf(targetTaskId);
        if (idx !== -1) insertAt = edge === 'before' ? idx : idx + 1;
      }
      destIds.splice(insertAt, 0, moved);

      // Cross-group move: stamp the destination group's identity first.
      const inGroup = group.tasks.some((t) => t.id === moved);
      if (!inGroup) {
        const patch = apply.groupPatch(group);
        if (Object.keys(patch).length) updateTask(moved, patch);
      }

      reorderTasks(destIds);
    },
    [apply, reorderTasks, updateTask, onDragEnd],
  );

  const onDropOnRow = useCallback(
    (group: ListGroup) => {
      const t = dropTarget;
      commit(group, t?.taskId ?? null, t?.edge ?? 'after');
    },
    [commit, dropTarget],
  );

  const onDropOnGroup = useCallback(
    (group: ListGroup) => commit(group, null, 'after'),
    [commit],
  );

  return useMemo(
    () => ({
      draggingId,
      dropTarget,
      isDragging: draggingId !== null,
      onDragStart,
      onDragEnd,
      onRowDragOver,
      onDropOnRow,
      onDropOnGroup,
    }),
    [draggingId, dropTarget, onDragStart, onDragEnd, onRowDragOver, onDropOnRow, onDropOnGroup],
  );
}
