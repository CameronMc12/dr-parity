/**
 * Scope contract. The seam every data view hangs off so a view body can render a
 * single LIST, an entire FOLDER (all tasks across its lists), or an entire SPACE
 * (all tasks across its folderless lists + every folder's lists) through one set
 * of hooks. For a single-list scope each hook is byte-identical to today's
 * per-list hook (useTasksByList / useListStatuses / useViewConfig / …) so the
 * proven List/Board/Calendar/Gantt/Table/Timeline/Workload bodies keep working
 * with zero regression.
 *
 * Render-loop safety (hard rules learned from prior bugs in this repo):
 *  - Hooks are NEVER called conditionally. We resolve listIds first with ONE
 *    useShallow selector, then read tasks/statuses with ONE selector over all
 *    listIds. No early return precedes a hook call.
 *  - No selector returns a freshly-allocated array/object without useShallow
 *    (collections) or useMemo (derived). A naked new array => app-wide
 *    "Maximum update depth exceeded".
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, workspaceSelectors as sel } from '@/store/workspace';
import {
  useMembers,
  useViewConfig,
} from '@/store/workspace/hooks';
import { orderStatusDefs, type StatusDef } from '@/data/status-set';
import { groupTasksByStatus, type StatusColumn } from './view-data';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { SpaceNode, Task, WorkspaceState } from '@/store/workspace/types';
import type { ViewConfig } from '@/store/workspace/view-config.types';

export type ViewScope =
  | { kind: 'list'; listId: string }
  | { kind: 'space'; spaceId: string }
  | { kind: 'folder'; folderId: string };

/** Neutral fallback colour reused by the breadcrumb for folder/list scopes. */
const FOLDER_COLOR = '#7b7b7b';

/** Stable per-render-class empty arrays so empty scopes never churn references. */
const EMPTY_LIST_IDS: readonly string[] = Object.freeze([]);
const EMPTY_TASKS: readonly Task[] = Object.freeze([]);
const EMPTY_FIELDS: readonly CustomFieldDef[] = Object.freeze([]);
const EMPTY_STATUSES: readonly StatusDef[] = Object.freeze([]);

/**
 * Stable string key for a scope. `list` -> the raw listId so a single-list scope
 * shares the exact viewConfig slice it always used; `space`/`folder` get a
 * namespaced key so they persist their own config without colliding with any
 * list id.
 */
export function scopeKey(scope: ViewScope): string {
  switch (scope.kind) {
    case 'list':
      return scope.listId;
    case 'space':
      return `space:${scope.spaceId}`;
    case 'folder':
      return `folder:${scope.folderId}`;
  }
}

/** Collect the list ids that belong to a space node (folderless + all folders). */
function spaceListIds(space: SpaceNode): string[] {
  return [
    ...space.folderlessLists.map((l) => l.id),
    ...space.folders.flatMap((f) => f.lists.map((l) => l.id)),
  ];
}

/** Pure resolver: the ordered list ids covered by a scope. [] when not found. */
function resolveScopeListIds(state: WorkspaceState, scope: ViewScope): string[] {
  switch (scope.kind) {
    case 'list':
      return [scope.listId];
    case 'space': {
      const space = state.tree.spaces.find((s) => s.id === scope.spaceId);
      return space ? spaceListIds(space) : [];
    }
    case 'folder': {
      for (const space of state.tree.spaces) {
        const folder = space.folders.find((f) => f.id === scope.folderId);
        if (folder) return folder.lists.map((l) => l.id);
      }
      return [];
    }
  }
}

/**
 * The list ids a scope covers. Single useShallow selector walking the tree, so
 * the reference is stable until the covered set actually changes. `list` returns
 * `[listId]` unconditionally — identical to today's single-list path.
 */
export function useScopeListIds(scope: ViewScope): string[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const ids = resolveScopeListIds(s, scope);
      return ids.length ? ids : (EMPTY_LIST_IDS as string[]);
    }),
  );
}

/**
 * Top-level tasks across every list in the scope. One useShallow selector over
 * all listIds. For a single list this is identical to `useTasksByList(listId)`
 * (same `tasksByList` filter, same order).
 */
export function useScopeTasks(scope: ViewScope): Task[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const ids = resolveScopeListIds(s, scope);
      const [first] = ids;
      if (first === undefined) return EMPTY_TASKS as Task[];
      if (ids.length === 1) return sel.tasksByList(s, first);
      return ids.flatMap((id) => sel.tasksByList(s, id));
    }),
  );
}

/**
 * Every task across the scope including subtasks. One useShallow selector. For a
 * single list this is identical to `useListTasksFlat(listId)`.
 */
export function useScopeTasksFlat(scope: ViewScope): Task[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const ids = resolveScopeListIds(s, scope);
      const [first] = ids;
      if (first === undefined) return EMPTY_TASKS as Task[];
      if (ids.length === 1) return sel.listTasksFlat(s, first);
      return ids.flatMap((id) => sel.listTasksFlat(s, id));
    }),
  );
}

/**
 * Union of the scope lists' status sets, deduped by label (first colour/type
 * wins), then re-ordered with the SAME ranking `status-set.ts` uses (orderIndex
 * ascending, done/closed pinned to the bottom). For a single list the upstream
 * `listStatusDefs` already returns the canonical order, and re-running
 * `orderStatusDefs` over it is a stable no-op — so the output equals
 * `useListStatuses(listId)`.
 *
 * Returned via useShallow so the dedupe array only changes when the underlying
 * per-list status sets change reference (each is cached in selectors.ts).
 */
export function useScopeStatuses(scope: ViewScope): StatusDef[] {
  // Dedupe inside the store selector using STABLE per-list refs (listStatusDefs
  // is cached in selectors.ts), so useShallow can stabilise the array. Ordering
  // — which allocates fresh StatusDef objects via orderStatusDefs — runs in
  // useMemo on that stable input. Never order inside the store selector or the
  // new object refs defeat useShallow and spin an infinite getServerSnapshot loop.
  const deduped = useWorkspaceStore(
    useShallow((s) => {
      const ids = resolveScopeListIds(s, scope);
      const [first] = ids;
      if (first === undefined) return EMPTY_STATUSES as StatusDef[];
      if (ids.length === 1) return sel.listStatusDefs(s, first);
      const byLabel = new Map<string, StatusDef>();
      for (const id of ids) {
        for (const def of sel.listStatusDefs(s, id)) {
          if (!byLabel.has(def.label)) byLabel.set(def.label, def);
        }
      }
      return [...byLabel.values()];
    }),
  );
  return useMemo(() => orderStatusDefs(deduped), [deduped]);
}

/** Persisted view config for the scope. === useViewConfig(scopeKey(scope)). */
export function useScopeConfig(scope: ViewScope): ViewConfig {
  return useViewConfig(scopeKey(scope));
}

/**
 * Board columns for the scope. Mirrors `useStatusColumns` but sourced from the
 * scope hooks, so a single-list scope produces the identical column array
 * today's `useStatusColumns(viewId)` produces for that list. Memoised on stable
 * deps (each input is a render-stable reference per its own hook).
 */
export function useScopeStatusColumns(scope: ViewScope): StatusColumn[] {
  const tasks = useScopeTasks(scope);
  const config = useScopeConfig(scope);
  const members = useMembers();
  const statusDefs = useScopeStatuses(scope);
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

/**
 * Union of custom-field definitions across the scope lists, deduped by field id
 * (first definition wins). For a single list this equals `useCustomFields(listId)`.
 */
export function useScopeCustomFields(scope: ViewScope): CustomFieldDef[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const ids = resolveScopeListIds(s, scope);
      const [first] = ids;
      if (first === undefined) return EMPTY_FIELDS as CustomFieldDef[];
      if (ids.length === 1) return s.customFields[first] ?? (EMPTY_FIELDS as CustomFieldDef[]);
      const byId = new Map<string, CustomFieldDef>();
      for (const id of ids) {
        for (const def of s.customFields[id] ?? []) {
          if (!byId.has(def.id)) byId.set(def.id, def);
        }
      }
      return byId.size ? [...byId.values()] : (EMPTY_FIELDS as CustomFieldDef[]);
    }),
  );
}

/**
 * Default list id for createTask / empty-state targeting: the listId for a
 * single-list scope, otherwise the first list id covered by the scope. Empty
 * string when the scope covers no lists.
 */
export function useScopeDefaultListId(scope: ViewScope): string {
  return useWorkspaceStore(
    (s) => resolveScopeListIds(s, scope)[0] ?? '',
  );
}

/**
 * The data token an APP/"other" view body should feed to the per-view data hooks
 * (`useViewTasks`, `useTeamBuckets`, `useEnsureDashboard`, …). For a list scope
 * this is the listId — byte-identical to the body's previous `viewId`-derived
 * listId. For a space/folder scope it is the scope's default/first listId, so the
 * body renders real tasks from a concrete list instead of an unresolvable
 * `space:<id>` token. Empty string when the scope covers no lists.
 */
export function useScopeListToken(scope: ViewScope, fallbackViewId: string): string {
  const defaultListId = useScopeDefaultListId(scope);
  return scope.kind === 'list' ? fallbackViewId : defaultListId;
}

/** Display name + dot colour for a scope (space colour / folder + list neutral). */
export function useScopeMeta(scope: ViewScope): { name: string; color: string } {
  return useWorkspaceStore(
    useShallow((s) => {
      switch (scope.kind) {
        case 'list': {
          const resolved = sel.findList(s, scope.listId);
          return {
            name: resolved?.list?.name ?? '',
            color: FOLDER_COLOR,
          };
        }
        case 'space': {
          const space = s.tree.spaces.find((sp) => sp.id === scope.spaceId);
          return { name: space?.name ?? '', color: space?.color ?? FOLDER_COLOR };
        }
        case 'folder': {
          for (const space of s.tree.spaces) {
            const folder = space.folders.find((f) => f.id === scope.folderId);
            if (folder) return { name: folder.name, color: FOLDER_COLOR };
          }
          return { name: '', color: FOLDER_COLOR };
        }
      }
    }),
  );
}
