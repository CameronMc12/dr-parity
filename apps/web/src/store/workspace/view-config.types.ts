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

export interface FilterState {
  /** status string -> included. Empty object = no status filter. */
  status: string[];
  /** priority key (urgent/high/normal/low) -> included. */
  priority: string[];
  /** assignee id -> included. */
  assignee: string[];
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
    field: keyof FilterState,
    value: string,
  ) => void;
  clearFilters: (listId: string) => void;
  setGroupCollapsed: (listId: string, groupKey: string, collapsed: boolean) => void;
  collapseAllGroups: (listId: string, groupKeys: string[]) => void;
  expandAllGroups: (listId: string) => void;
}
