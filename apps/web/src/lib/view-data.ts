/**
 * Shared view-data layer for the Board / Calendar / Gantt / Doc views.
 *
 * Every non-List view sources its rows through this module so they all read the
 * SAME task objects the List view uses (no parallel/fake dataset). It re-exports
 * the proven List-view data path (`useTasksByList`, `useViewConfig`, the
 * `buildGroups` grouping engine) behind a small, view-friendly surface.
 *
 * Date helpers for Calendar/Gantt live in `./view-dates`; doc bodies in
 * `./doc-data`. Both are re-exported here so a view needs only this one import.
 */

import { useMemo } from 'react';
import { VIEW_TO_LIST } from '@/data/workspace-tree';
import { buildGroups, type ListGroup } from '@/components/pages/listview/grouping';
import {
  useListStatuses,
  useMembers,
  useTasksByList,
  useViewConfig,
} from '@/store/workspace/hooks';
import type { StatusDef } from '@/data/status-set';
import type { Member, Task } from '@/store/workspace/types';
import type { ViewConfig } from '@/store/workspace/view-config.types';

export type { ListGroup } from '@/components/pages/listview/grouping';
export type { Task, Member } from '@/store/workspace/types';
export type { ViewConfig } from '@/store/workspace/view-config.types';

// Re-export the date + doc helpers so views import a single module.
export {
  ANCHOR_NOW,
  DAY_MS,
  clampSpan,
  daysInSpan,
  deriveSpan,
  endOfDay,
  monthRange,
  spanTouchesDay,
  startOfDay,
} from './view-dates';
export type { MonthRange, TaskSpan } from './view-dates';
export { allDocPages, getDocPage, getDocPages } from './doc-data';
export type { DocPage, DocPages } from './doc-data';

/**
 * Resolve a view URL token to its underlying listId. The token may be an opaque
 * viewId (mapped via VIEW_TO_LIST) or a raw listId — identical resolution to the
 * List branch in ClickUpWorkspace. Pure; safe to call outside React.
 */
export function resolveViewListId(viewId: string): string {
  return VIEW_TO_LIST[viewId] ?? viewId;
}

/**
 * Tasks for a view, resolved from its URL token. Returns the SAME top-level Task
 * objects the List view renders (full fields: status/statusColor, priority,
 * dueDate, startDate, assignees, tags, etc.). Subtasks are nested under their
 * parent — query them per-row with `useSubtasks(task.id)` as the List view does.
 */
export function useViewTasks(viewId: string): Task[] {
  return useTasksByList(resolveViewListId(viewId));
}

/** Per-view config (groupBy, filters, showClosed, …) for a view token. */
export function useViewConfigForView(viewId: string): ViewConfig {
  return useViewConfig(resolveViewListId(viewId));
}

/** Ordered status definitions for a view's list, including empty statuses. */
export function useViewStatuses(viewId: string): StatusDef[] {
  return useListStatuses(resolveViewListId(viewId));
}

/**
 * Status-ordered groups for the Board (one column per status). Pure wrapper over
 * the List-view grouping engine forced to `groupBy: 'status'`, so columns honour
 * the same status-order ranking and closed-pinned-bottom behaviour as List view.
 * Each group is `{ key, label, color, dashed, tasks }`.
 */
export function groupTasksByStatus(
  tasks: Task[],
  config: ViewConfig,
  members: Member[],
  statusDefs?: StatusDef[],
): ListGroup[] {
  return buildGroups(tasks, { ...config, groupBy: 'status' }, members, statusDefs);
}

export interface StatusColumn {
  /** `status:<label>` stable key. */
  key: string;
  status: string;
  color: string;
  /** Status type so empty columns stamp the right type onto added cards. */
  statusType: string;
  /** Dashed indicator for not-started statuses. */
  dashed: boolean;
  tasks: Task[];
}

/**
 * Memoised status columns for a view, ready for the Board to map over. Sources
 * tasks + config + members + the list's status SET from the store, then groups
 * by status so EVERY defined status renders a column (including empty ones). The
 * returned array is stable across renders unless the underlying data changes.
 */
export function useStatusColumns(viewId: string): StatusColumn[] {
  const tasks = useViewTasks(viewId);
  const config = useViewConfigForView(viewId);
  const members = useMembers();
  const statusDefs = useViewStatuses(viewId);
  return useMemo(() => {
    return groupTasksByStatus(tasks, config, members, statusDefs).map((g) => ({
      key: g.key,
      status: g.label,
      color: g.color,
      statusType: g.statusType ?? g.tasks[0]?.statusType ?? '',
      dashed: g.dashed,
      tasks: g.tasks,
    }));
  }, [tasks, config, members, statusDefs]);
}
