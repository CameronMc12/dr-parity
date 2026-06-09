/**
 * Map ClickUp export tasks into the apps/web Task seed shape. Faithfully
 * carries id, name, status (+color/type), priority (+color), assignees, dates,
 * tags, parent, archived, time estimate, and description.
 *
 * Date fields in the export are epoch-ms strings; apps/web stores numbers.
 */

import { mapAssignee } from './map-members';
import type { ExportTask, ExportTag, TargetTask, TargetTaskTag } from './types';

/** Parse an epoch-ms string to a number, or null when absent/invalid. */
function toEpoch(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Map an export tag to the apps/web TaskTag (single color; export bg == fg). */
function mapTag(tag: ExportTag): TargetTaskTag {
  return { name: tag.name, color: tag.tag_bg || tag.tag_fg || '#7b68ee' };
}

/** Map a single export task to the apps/web Task seed entry. */
export function mapTask(task: ExportTask): TargetTask {
  if (!task.id) throw new Error('Encountered an export task with no id');
  if (!task.list?.id) {
    throw new Error(`Task ${task.id} ("${task.name}") has no list.id — cannot place it`);
  }

  const status = task.status;
  const priority = task.priority;
  const tags = Array.isArray(task.tags) ? task.tags.map(mapTag) : [];

  const mapped: TargetTask = {
    id: task.id,
    name: task.name ?? '',
    status: status?.status ?? 'open',
    statusColor: status?.color ?? '#87909e',
    statusType: status?.type ?? 'open',
    listId: task.list.id,
    priority: priority?.priority ?? null,
    priorityColor: priority?.color ?? null,
    dueDate: toEpoch(task.due_date),
    startDate: toEpoch(task.start_date),
    assignees: Array.isArray(task.assignees) ? task.assignees.map(mapAssignee) : [],
    dateCreated: toEpoch(task.date_created),
    dateUpdated: toEpoch(task.date_updated),
    parent: task.parent ?? null,
    archived: Boolean(task.archived),
    tags,
  };

  if (task.description && task.description.trim()) {
    mapped.description = task.description;
  }
  if (task.time_estimate != null) {
    mapped.timeEstimate = task.time_estimate;
  }

  return mapped;
}

/** Map all export tasks; throws on the first malformed task. */
export function mapTasks(tasks: ExportTask[]): TargetTask[] {
  if (!Array.isArray(tasks)) throw new Error('Export tasks is not an array');
  return tasks.map(mapTask);
}
