/**
 * Column registry for the List view. Maps each `ColumnId` to its header label,
 * track width, and the field-manager grouping ("Shown" vs "Hidden" defaults).
 * The `name` column is always first and always visible.
 */

import { isCustomFieldColumn } from '@/store/workspace/view-config.types';
import type { ColumnId, TableColumnId } from '@/store/workspace/view-config.types';

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** CSS grid track for this column. */
  track: string;
}

/** Grid track width for every custom-field (`cf:*`) column. */
export const CUSTOM_FIELD_TRACK = '130px';

/**
 * True when a column id is a built-in column (has a COLUMN_DEFS entry). Lets the
 * List view filter custom-field `cf:*` columns out of TableColumnId lists so the
 * remaining ids narrow to ColumnId for the built-in rendering path.
 */
export function isBuiltinColumn(c: TableColumnId): c is ColumnId {
  return c in COLUMN_DEFS;
}

export const COLUMN_DEFS: Record<ColumnId, ColumnDef> = {
  name: { id: 'name', label: 'Task Name', track: 'minmax(220px, 1fr)' },
  assignee: { id: 'assignee', label: 'Assignee', track: '110px' },
  dueDate: { id: 'dueDate', label: 'Due date', track: '116px' },
  priority: { id: 'priority', label: 'Priority', track: '116px' },
  status: { id: 'status', label: 'Status', track: '120px' },
  comments: { id: 'comments', label: 'Comments', track: '90px' },
  startDate: { id: 'startDate', label: 'Start date', track: '116px' },
  tags: { id: 'tags', label: 'Tags', track: '120px' },
  timeEstimate: { id: 'timeEstimate', label: 'Time estimate', track: '120px' },
  createdBy: { id: 'createdBy', label: 'Created by', track: '110px' },
  taskId: { id: 'taskId', label: 'Task ID', track: '120px' },
  dateCreated: { id: 'dateCreated', label: 'Date created', track: '120px' },
};

/** Header labels used by the column-manager popover, in ClickUp's order. */
export const HIDDEN_FIELD_LABELS: string[] = [
  'Assigned Comments',
  'Created by',
  'Custom Task ID',
  'Date closed',
  'Date created',
  'Date done',
  'Date updated',
  'Dependencies',
  'Latest comment',
  'Linked Docs',
  'Linked tasks',
  'Lists',
  'Pull Requests',
  'Sprints',
  'Start date',
  'Tags',
  'Task ID',
  'Task Type',
  'Time estimate',
  'Time tracked',
  'Timeline',
];

/** Track for one column id — built-in widths come from COLUMN_DEFS, custom = fixed. */
function trackFor(id: TableColumnId): string {
  return isCustomFieldColumn(id) ? CUSTOM_FIELD_TRACK : COLUMN_DEFS[id].track;
}

/**
 * Build the CSS grid template for the active visible columns. Accepts built-in
 * and `cf:*` custom-field columns; the lead rail and a trailing add-column rail
 * bracket the data tracks.
 */
export function buildGridTemplate(visible: TableColumnId[]): string {
  // Lead rail holds the hover cluster: drag handle, checkbox, subtask chevron,
  // then the status circle — matching ClickUp's left-of-name affordances.
  const lead = '88px';
  const trailing = '28px'; // row kebab + add-column rail
  const tracks = [COLUMN_DEFS.name.track, ...visible.map(trackFor)].join(' ');
  return `${lead} ${tracks} ${trailing}`;
}
