/**
 * Per-list List-view configuration. Captures everything a ClickUp list view can
 * remember: grouping field, sort direction, which columns are shown/hidden and
 * in what order, the subtasks display mode, the customize toggles, and the
 * active filters. Keyed by listId so every list (and My Tasks) keeps its own.
 */

export type GroupByField = 'status' | 'priority' | 'assignee' | 'none';

export type SortDir = 'asc' | 'desc';

/**
 * Field the Sort toolbar menu sorts every group's rows by. `null` keeps ClickUp's
 * default (manual DnD order / group order). Mirrors the board/list Sort By list.
 */
export type SortField =
  | 'status'
  | 'name'
  | 'assignee'
  | 'priority'
  | 'dueDate'
  | 'startDate'
  | 'dateCreated'
  | 'dateUpdated'
  | 'dateClosed'
  | 'timeTracked'
  | 'timeEstimate'
  | null;

export type SubtasksMode = 'collapsed' | 'expanded' | 'separate';

/** Stable built-in column identifiers. `name` is never hidden. */
export type ColumnId =
  | 'name'
  | 'assignee'
  | 'dueDate'
  | 'priority'
  | 'status'
  | 'comments'
  | 'startDate'
  | 'tags'
  | 'timeEstimate'
  | 'createdBy'
  | 'taskId'
  | 'dateCreated';

/**
 * A custom field is addressed in the Table column system as `cf:<fieldId>`.
 * This is a SEPARATE union from the built-in ColumnId so existing
 * Record<ColumnId, …> maps (COLUMN_DEFS etc.) stay exhaustive and additive.
 * The Table builder uses TableColumnId for its visible/hidden column lists.
 */
export type CustomFieldColumnId = `cf:${string}`;

/** Built-in columns plus custom-field columns. Use this in the Table view. */
export type TableColumnId = ColumnId | CustomFieldColumnId;

/** True when a column id addresses a custom field. */
export function isCustomFieldColumn(col: TableColumnId): col is CustomFieldColumnId {
  return col.startsWith('cf:');
}

/** Narrow a column id to its custom-field id, or null for a built-in column. */
export function customFieldIdFromColumn(col: TableColumnId): string | null {
  return col.startsWith('cf:') ? col.slice(3) : null;
}

/** Build the column id for a custom field. */
export function columnIdForCustomField(fieldId: string): CustomFieldColumnId {
  return `cf:${fieldId}`;
}

/** Multi-select filter fields (each is an OR-set of allowed values). */
export type MultiFilterField = 'status' | 'priority' | 'assignee' | 'tags';

/** Relative due-date buckets. `null` = no due-date filter. */
export type DueDateFilter = 'overdue' | 'today' | 'week' | 'none' | null;

export interface FilterState {
  /** status string -> included. Empty array = no status filter. */
  status: string[];
  /** priority key (urgent/high/normal/low) -> included. */
  priority: string[];
  /** assignee id -> included. */
  assignee: string[];
  /** tag name -> included. Empty array = no tag filter. */
  tags: string[];
  /** Relative due-date bucket, or null for no due-date filter. */
  dueDate: DueDateFilter;
}

/** A named snapshot of a FilterState the user can re-apply. */
export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
}

export interface ViewConfig {
  groupBy: GroupByField;
  sortDir: SortDir;
  /** Active toolbar Sort field. `null` = default group/manual order. */
  sortField: SortField;
  /**
   * Ordered list of visible columns (excludes the always-on `name`). Holds both
   * built-in `ColumnId` values and `cf:<fieldId>` custom-field columns.
   */
  visibleColumns: TableColumnId[];
  hiddenColumns: TableColumnId[];
  subtasks: SubtasksMode;
  showEmptyStatuses: boolean;
  wrapText: boolean;
  showTaskLocations: boolean;
  showSubtaskParentNames: boolean;
  showClosed: boolean;
  filters: FilterState;
  /** User-named filter snapshots for this view, in save order. */
  savedFilters: SavedFilter[];
  collapsedGroups: string[];
}

export interface ViewConfigActions {
  /** All persisted per-list view configs, keyed by listId. */
  viewConfigs: Record<string, ViewConfig>;

  setGroupBy: (listId: string, field: GroupByField) => void;
  setSortDir: (listId: string, dir: SortDir) => void;
  setSortField: (listId: string, field: SortField) => void;
  toggleColumn: (listId: string, col: TableColumnId) => void;
  setSubtasksMode: (listId: string, mode: SubtasksMode) => void;
  setViewToggle: (
    listId: string,
    key:
      | 'showEmptyStatuses'
      | 'wrapText'
      | 'showTaskLocations'
      | 'showSubtaskParentNames'
      | 'showClosed',
    value: boolean,
  ) => void;
  toggleFilterValue: (
    listId: string,
    field: MultiFilterField,
    value: string,
  ) => void;
  /** Set (or clear, with null) the relative due-date filter bucket. */
  setDueDateFilter: (listId: string, value: DueDateFilter) => void;
  clearFilters: (listId: string) => void;
  /** Save the view's current filters as a named snapshot. */
  saveCurrentFilter: (listId: string, name: string) => void;
  /** Replace the view's active filters with a saved snapshot's filters. */
  applySavedFilter: (listId: string, savedId: string) => void;
  /** Remove a saved filter snapshot. */
  deleteSavedFilter: (listId: string, savedId: string) => void;
  setGroupCollapsed: (listId: string, groupKey: string, collapsed: boolean) => void;
  collapseAllGroups: (listId: string, groupKeys: string[]) => void;
  expandAllGroups: (listId: string) => void;
}
