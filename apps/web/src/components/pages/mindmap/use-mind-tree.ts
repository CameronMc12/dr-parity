/**
 * Builds the Mind Map's hierarchical input tree from the SAME task objects every
 * other view reads. A synthetic root (the list) holds one child per top-level
 * task; each task holds one grandchild per subtask. Subtasks are sourced once
 * from the store as a parent->children map (no per-node hooks) so the whole tree
 * is memoised on stable inputs and never triggers a render loop.
 */

import { useMemo } from 'react';
import { useViewTasks } from '@/lib/view-data';
import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import type { MindInput } from './layout';

function matchesQuery(name: string, q: string): boolean {
  return q.length === 0 || name.toLowerCase().includes(q.toLowerCase());
}

function taskToInput(task: Task, subs: Task[]): MindInput {
  return {
    id: task.id,
    label: task.name,
    kind: task.parent ? 'subtask' : 'task',
    status: task.status,
    statusColor: task.statusColor,
    task,
    children: subs.map((s) => taskToInput(s, [])),
  };
}

type TaskBag = Record<string, Task>;

function buildSubtaskMap(bag: TaskBag): Record<string, Task[]> {
  const out: Record<string, Task[]> = {};
  for (const task of Object.values(bag)) {
    if (task.archived || !task.parent) continue;
    (out[task.parent] ??= []).push(task);
  }
  for (const list of Object.values(out)) {
    list.sort(
      (a, b) => a.order - b.order || (a.dateCreated ?? 0) - (b.dateCreated ?? 0),
    );
  }
  return out;
}

/**
 * @param viewId   View route token; resolved internally to the backing list.
 * @param listId   Resolved listId, used for the root node id.
 * @param listName Resolved list display name for the root.
 * @param query    Live search filter applied to top-level task names.
 */
export function useMindTree(
  viewId: string,
  listId: string,
  listName: string,
  query: string,
): MindInput {
  const tasks = useViewTasks(viewId);
  // Select the stable raw bag ref (changes only when tasks change), then derive
  // the parent->subtasks map in useMemo so no fresh object leaves the selector.
  const taskBag = useWorkspaceStore((s) => s.tasks);
  const subtaskMap = useMemo(() => buildSubtaskMap(taskBag), [taskBag]);

  return useMemo<MindInput>(() => {
    const visible = tasks.filter((t) => matchesQuery(t.name, query));
    const children = visible.map((t) => taskToInput(t, subtaskMap[t.id] ?? []));
    return {
      id: `root:${listId}`,
      label: listName || 'Mind Map',
      kind: 'root',
      children,
    };
  }, [tasks, subtaskMap, query, listId, listName]);
}

/** Resolve a list display name for the root node. Stable across renders. */
export function useListName(listId: string): string {
  return useWorkspaceStore(
    (s) => workspaceSelectors.findList(s, listId)?.list?.name ?? 'Mind Map',
  );
}
