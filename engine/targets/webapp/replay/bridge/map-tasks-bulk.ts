/**
 * Map a list's export tasks into the INTERNAL task-v3 bulk response shape.
 *
 * The bundle's task fetch is POST /task-v3/.../tasks/bulk and the response is a
 * deeply-nested internal shape: { tasks: [{ object_id, status:'found', data:{
 * task:{...} } }], statuses, fields, list_status_ids_map, user_map, ... }.
 *
 * Rebuilding that shape from scratch is fragile. Instead we CLONE the captured
 * 37KB template task as a skeleton (preserving every structural/default field
 * the bundle reads) and OVERLAY the export task's real data: id, name, status,
 * dates, content, custom_fields. The statuses[] array + list_status_ids_map are
 * synthesized per-list so the status_id <-> statuses linkage stays consistent.
 */

import type { CapturedTemplates } from './extract-templates';
import type { ExportTask } from './load-export';
import type { SynthStatusSet } from './synth-statuses';
import { deepClone } from './clone-util';

type InternalTaskWrapper = {
  object_id: string;
  status: string;
  data: { task: Record<string, unknown> };
};

type TaskBulkBody = {
  tasks: InternalTaskWrapper[];
  statuses: unknown[];
  fields: unknown[];
  list_status_ids_map: Record<string, string[]>;
  user_map: Record<string, unknown>;
  group_map: Record<string, unknown>;
  parent_task_map: Record<string, unknown>;
  related_task_map: Record<string, unknown>;
  [key: string]: unknown;
};

function templateTaskSkeleton(template: CapturedTemplates['tasksBulk']): Record<string, unknown> | null {
  const body = template as TaskBulkBody | null;
  const first = body?.tasks?.[0];
  if (!first || !first.data?.task) return null;
  return first.data.task;
}

function ownerUserMap(task: ExportTask): { id: string; entry: Record<string, unknown> } | null {
  const creator = task.creator;
  if (!creator) return null;
  return {
    id: String(creator.id),
    entry: {
      id: creator.id,
      color: creator.color ?? '#595d66',
      email: creator.email ?? '',
      initials: (creator.username ?? '')
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      profilePicture: null,
      username: creator.username ?? '',
    },
  };
}

function overlayTask(
  skeleton: Record<string, unknown>,
  task: ExportTask,
  listId: string,
  statusId: string,
  ownerId: string | null,
): Record<string, unknown> {
  const t = deepClone(skeleton);

  t.id = task.id;
  t.name = task.name;
  t.status_id = statusId;
  t.subcategory = listId;
  t.html_content = task.description ?? null;
  t.content_size = task.description ? 'small' : 'none';
  t.custom_id = task.custom_id ?? null;
  t.priority = task.priority ?? null;

  // Clear references that only made sense for the captured task.
  t.direct_parent = null;
  t.root_parent = null;
  t.subtask_ids = [];
  t.tags = Array.isArray(task.tags) ? task.tags : [];
  t.related_tasks = [];
  t.related_tasks_count = { dependsOn: 0, dependedBy: 0 };
  t.attachments = [];
  t.lists = [{ list_id: listId, type: 'home' }];

  if (ownerId) {
    t.users = [
      { userid: Number(ownerId), type: 'owner' },
      { userid: Number(ownerId), type: 'creator' },
    ];
  }

  // Custom field values: the export task carries the field defs + values it
  // actually holds. Map into the internal { field_id, value, type } shape.
  const fields = Array.isArray(task.custom_fields) ? task.custom_fields : [];
  t.fields = fields
    .map((f) => {
      const cf = f as { id?: string; value?: unknown; type?: string };
      if (!cf.id || cf.value === undefined) return null;
      return {
        field_id: cf.id,
        value: cf.value,
        value_deleted: null,
        value_options: null,
        value_richtext: null,
        task_id: task.id,
        type: cf.type ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Dates: overlay onto the cloned time_mgmt block so its other defaults stay.
  const time = (t.time_mgmt as Record<string, unknown>) ?? {};
  time.date_created = task.date_created ?? time.date_created ?? null;
  time.date_updated = task.date_updated ?? task.date_created ?? time.date_updated ?? null;
  time.date_closed = task.date_closed ?? null;
  time.date_done = task.date_done ?? null;
  time.due_date = task.due_date ?? null;
  time.start_date = task.start_date ?? null;
  t.time_mgmt = time;

  const states = (t.states as Record<string, unknown>) ?? {};
  states.is_archived = task.archived ?? false;
  states.is_deleted = false;
  t.states = states;

  return t;
}

/**
 * Build the internal tasks/bulk response for a list from its export tasks.
 * Returns null when no template skeleton is available (cannot safely synthesize
 * the deep internal shape without one).
 */
export function mapTasksBulk(
  listId: string,
  tasks: ExportTask[],
  statusSet: SynthStatusSet,
  templates: CapturedTemplates,
): TaskBulkBody | null {
  const skeleton = templateTaskSkeleton(templates.tasksBulk);
  if (!skeleton) return null;

  const base = deepClone(templates.tasksBulk as TaskBulkBody);

  const userMap: Record<string, unknown> = {};
  const wrappers: InternalTaskWrapper[] = tasks.map((task) => {
    const statusId = statusSet.labelToId.get(task.status?.status ?? '') ?? statusSet.statusIds[0];
    const owner = ownerUserMap(task);
    if (owner) userMap[owner.id] = owner.entry;
    return {
      object_id: task.id,
      status: 'found',
      data: { task: overlayTask(skeleton, task, listId, statusId, owner?.id ?? null) },
    };
  });

  base.tasks = wrappers;
  base.statuses = statusSet.statuses;
  base.list_status_ids_map = { [listId]: statusSet.statusIds };
  base.user_map = Object.keys(userMap).length > 0 ? userMap : base.user_map;
  base.group_map = {};
  base.parent_task_map = {};
  base.related_task_map = {};
  // The captured `fields` array describes the captured list's custom fields;
  // leave it as the structural default (custom-field defs are sourced by the
  // separate /customFields endpoint), but scope nothing to the wrong list.
  return base;
}
