/**
 * Map a list's export tasks into the INTERNAL genericView response shape.
 *
 * genericView is the list view payload. Its `list.divisions[0].groups[]` carry
 * the per-status `task_ids` the bundle then fetches via tasks/bulk. We CLONE the
 * captured genericView (preserving permissions + the heavy structural defaults)
 * and rebuild: the division's `data` (list metadata) from the export list, and
 * one group per status carrying that status's export task ids.
 */

import type { CapturedTemplates } from './extract-templates';
import type { ExportList, ExportTask } from './load-export';
import type { SynthStatusSet } from './synth-statuses';
import { deepClone } from './clone-util';

type GenericViewBody = {
  list: { divisions: GvDivision[]; view_obj?: unknown };
  tasks: unknown[];
  team_id?: string;
  last_page?: boolean;
  [key: string]: unknown;
};

type GvDivision = {
  id: string;
  data: Record<string, unknown>;
  collapsed: boolean;
  task_count: number;
  groups: GvGroup[];
};

type GvGroup = {
  id: string;
  data: {
    subcategory_id: string;
    color: string;
    status: string;
    orderindex: number;
    label: string;
    status_group: string;
    type: string;
  };
  task_ids: string[];
  task_count: number;
  collapsed: boolean;
  includes_first_task: boolean;
  includes_last_task: boolean;
};

function buildGroups(
  listId: string,
  tasks: ExportTask[],
  statusSet: SynthStatusSet,
): GvGroup[] {
  // Bucket task ids by status label, preserving export order.
  const idsByLabel = new Map<string, string[]>();
  for (const task of tasks) {
    const label = task.status?.status ?? '';
    const arr = idsByLabel.get(label) ?? [];
    arr.push(task.id);
    idsByLabel.set(label, arr);
  }

  return statusSet.statuses.map((s) => {
    const taskIds = idsByLabel.get(s.status) ?? [];
    return {
      id: `${listId}_${s.status}`,
      data: {
        subcategory_id: listId,
        color: s.color,
        status: `${listId}_${s.status}`,
        orderindex: s.orderindex,
        label: s.status,
        status_group: statusSet.statusGroup,
        type: s.type,
      },
      task_ids: taskIds,
      task_count: taskIds.length,
      collapsed: false,
      includes_first_task: true,
      includes_last_task: true,
    };
  });
}

export function mapGenericView(
  listId: string,
  list: ExportList | undefined,
  tasks: ExportTask[],
  statusSet: SynthStatusSet,
  templates: CapturedTemplates,
): GenericViewBody | null {
  const template = templates.genericView as GenericViewBody | null;
  if (!template?.list?.divisions?.[0]) return null;

  const body = deepClone(template);
  const division = body.list.divisions[0];

  division.id = listId;
  division.task_count = tasks.length;
  division.collapsed = false;

  const data = division.data;
  data.id = listId;
  data.subcategory = listId;
  data.name = list?.name ?? (data.name as string) ?? 'List';
  if (typeof list?.orderindex === 'number') data.orderindex = list.orderindex;
  if (typeof list?.content === 'string') data.content = list.content;

  division.groups = buildGroups(listId, tasks, statusSet);

  // Drop any extra captured divisions; one division per list view.
  body.list.divisions = [division];
  body.tasks = [];
  body.last_page = false;

  return body;
}
