/** Display labels for the toolbar Sort field, shared by ViewToolbar + SortMenu. */

import type { SortField } from '@/store/workspace/view-config.types';

export const SORT_FIELD_LABEL: Record<NonNullable<SortField>, string> = {
  status: 'Status',
  name: 'Task Name',
  assignee: 'Assignee',
  priority: 'Priority',
  dueDate: 'Due date',
  startDate: 'Start date',
  dateCreated: 'Date created',
  dateUpdated: 'Date updated',
  dateClosed: 'Date closed',
  timeTracked: 'Time tracked',
  timeEstimate: 'Time estimate',
};

/** Toolbar label: the active field name, or plain "Sort" when unsorted. */
export function SortFieldLabel(field: SortField): string {
  return field ? SORT_FIELD_LABEL[field] : 'Sort';
}
