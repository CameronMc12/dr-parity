/**
 * Per-list view-config slice. Stores grouping, column visibility, subtasks mode,
 * customize toggles, filters, and collapsed groups for each list independently.
 * All mutations are immutable so persist snapshots stay clean.
 */

import type { StateCreator } from 'zustand';
import type { WorkspaceState } from './types';
import type {
  ColumnId,
  DueDateFilter,
  FilterState,
  GroupByField,
  MultiFilterField,
  SortDir,
  SortField,
  SubtasksMode,
  TableColumnId,
  ViewConfig,
  ViewConfigActions,
} from './view-config.types';

function emptyFilters(): FilterState {
  return { status: [], priority: [], assignee: [], tags: [], dueDate: null };
}

const DEFAULT_VISIBLE: ColumnId[] = [
  'assignee',
  'dueDate',
  'priority',
  'status',
  'comments',
];

const DEFAULT_HIDDEN: ColumnId[] = [
  'startDate',
  'tags',
  'timeEstimate',
  'createdBy',
  'taskId',
  'dateCreated',
];

export function defaultViewConfig(): ViewConfig {
  return {
    groupBy: 'status',
    sortDir: 'asc',
    sortField: null,
    visibleColumns: [...DEFAULT_VISIBLE],
    hiddenColumns: [...DEFAULT_HIDDEN],
    subtasks: 'collapsed',
    showEmptyStatuses: false,
    wrapText: false,
    showTaskLocations: false,
    showSubtaskParentNames: false,
    showClosed: true,
    filters: emptyFilters(),
    savedFilters: [],
    collapsedGroups: [],
  };
}

/** Normalise a (possibly persisted-v1) config so new filter fields always exist. */
function withFilterDefaults(c: ViewConfig): ViewConfig {
  const f = c.filters;
  return {
    ...c,
    filters: {
      status: f.status ?? [],
      priority: f.priority ?? [],
      assignee: f.assignee ?? [],
      tags: f.tags ?? [],
      dueDate: f.dueDate ?? null,
    },
    savedFilters: c.savedFilters ?? [],
  };
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const createViewConfigSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  ViewConfigActions
> = (set, get) => {
  const config = (listId: string): ViewConfig =>
    withFilterDefaults(get().viewConfigs[listId] ?? defaultViewConfig());

  const patch = (listId: string, next: Partial<ViewConfig>) => {
    set((state) => ({
      viewConfigs: {
        ...state.viewConfigs,
        [listId]: { ...(state.viewConfigs[listId] ?? defaultViewConfig()), ...next },
      },
    }));
  };

  return {
    viewConfigs: {},

    setGroupBy: (listId, field: GroupByField) => patch(listId, { groupBy: field }),

    setSortDir: (listId, dir: SortDir) => patch(listId, { sortDir: dir }),

    setSortField: (listId, field: SortField) => patch(listId, { sortField: field }),

    toggleColumn: (listId, col: TableColumnId) => {
      if (col === 'name') return;
      const c = config(listId);
      const isShown = c.visibleColumns.includes(col);
      patch(listId, {
        visibleColumns: isShown
          ? c.visibleColumns.filter((x) => x !== col)
          : [...c.visibleColumns, col],
        hiddenColumns: isShown
          ? [...c.hiddenColumns, col]
          : c.hiddenColumns.filter((x) => x !== col),
      });
    },

    setSubtasksMode: (listId, mode: SubtasksMode) => patch(listId, { subtasks: mode }),

    setViewToggle: (listId, key, value) => patch(listId, { [key]: value }),

    toggleFilterValue: (listId, field: MultiFilterField, value: string) => {
      const c = config(listId);
      patch(listId, {
        filters: { ...c.filters, [field]: toggleInList(c.filters[field], value) },
      });
    },

    setDueDateFilter: (listId, value: DueDateFilter) => {
      const c = config(listId);
      patch(listId, { filters: { ...c.filters, dueDate: value } });
    },

    clearFilters: (listId) => patch(listId, { filters: emptyFilters() }),

    saveCurrentFilter: (listId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const c = config(listId);
      const saved = {
        id: `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        filters: { ...c.filters },
      };
      patch(listId, { savedFilters: [...c.savedFilters, saved] });
    },

    applySavedFilter: (listId, savedId) => {
      const c = config(listId);
      const found = c.savedFilters.find((s) => s.id === savedId);
      if (!found) return;
      patch(listId, { filters: { ...found.filters } });
    },

    deleteSavedFilter: (listId, savedId) => {
      const c = config(listId);
      patch(listId, { savedFilters: c.savedFilters.filter((s) => s.id !== savedId) });
    },

    setGroupCollapsed: (listId, groupKey, collapsed) => {
      const c = config(listId);
      patch(listId, {
        collapsedGroups: collapsed
          ? [...new Set([...c.collapsedGroups, groupKey])]
          : c.collapsedGroups.filter((k) => k !== groupKey),
      });
    },

    collapseAllGroups: (listId, groupKeys) =>
      patch(listId, { collapsedGroups: [...new Set(groupKeys)] }),

    expandAllGroups: (listId) => patch(listId, { collapsedGroups: [] }),
  };
};
