/**
 * Synthesize a per-list set of subcategory-scoped statuses from the export.
 *
 * The export's task.status.id is SPACE/folder-scoped (e.g. `p901511060890_...`),
 * but the captured INTERNAL task shape groups tasks by a SUBCATEGORY-scoped
 * status id (e.g. `sc901523543284_...`) and renders the statuses[] array the
 * bulk response carries. To keep the status_id <-> statuses[] linkage internally
 * consistent for ANY list, we mint synthetic subcategory status ids per list and
 * map each export task's status (by label) onto the synthetic id.
 *
 * The label, color, type, and orderindex all come from the export status so the
 * rendered chips match the user's real workflow.
 */

import type { ExportList, ExportStatus, ExportTask } from './load-export';

export type SynthStatus = {
  id: string;
  status: string;
  project_id: null;
  orderindex: number;
  color: string;
  type: string;
  category_id: null;
  status_group: string;
  subcategory_id: string;
};

export type SynthStatusSet = {
  /** subcategory status group token, e.g. `subcat_901523543274`. */
  statusGroup: string;
  /** Ordered subcategory statuses for this list. */
  statuses: SynthStatus[];
  /** Map export status label -> synthetic subcategory status id. */
  labelToId: Map<string, string>;
  /** Ordered status ids (for list_status_ids_map). */
  statusIds: string[];
};

const DEFAULT_COLOR = '#87909e';

function tokenFromLabel(label: string, index: number): string {
  const slug = label
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8);
  return slug.length > 0 ? `${slug}${index}` : `st${index}`;
}

/**
 * Build the subcategory status set for a list. Prefers the list's own statuses
 * (override_statuses) when present; otherwise derives the distinct statuses from
 * the list's tasks in export order, falling back to a single Open status so the
 * view always has at least one group.
 */
export function synthStatusesForList(
  listId: string,
  list: ExportList | undefined,
  tasks: ExportTask[],
): SynthStatusSet {
  const statusGroup = `subcat_${listId}`;
  const ordered: ExportStatus[] = [];
  const seen = new Set<string>();

  const push = (s: ExportStatus | undefined): void => {
    if (!s || !s.status) return;
    const label = s.status;
    if (seen.has(label)) return;
    seen.add(label);
    ordered.push(s);
  };

  if (Array.isArray(list?.statuses) && list.statuses.length > 0) {
    for (const s of list.statuses) push(s);
  }
  // Always fold in statuses actually used by tasks (covers lists with no
  // explicit status set, or tasks whose status is not in the list set).
  for (const task of tasks) push(task.status);

  if (ordered.length === 0) {
    ordered.push({ id: 'open', status: 'Open', color: DEFAULT_COLOR, type: 'open', orderindex: 0 });
  }

  const statuses: SynthStatus[] = [];
  const labelToId = new Map<string, string>();
  const statusIds: string[] = [];

  ordered.forEach((s, index) => {
    const id = `sc${listId}_${tokenFromLabel(s.status, index)}`;
    statuses.push({
      id,
      status: s.status,
      project_id: null,
      orderindex: typeof s.orderindex === 'number' ? s.orderindex : index,
      color: s.color || DEFAULT_COLOR,
      type: s.type || (index === 0 ? 'open' : 'custom'),
      category_id: null,
      status_group: statusGroup,
      subcategory_id: listId,
    });
    labelToId.set(s.status, id);
    statusIds.push(id);
  });

  return { statusGroup, statuses, labelToId, statusIds };
}
