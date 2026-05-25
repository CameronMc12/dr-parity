/**
 * Map an export list into the INTERNAL subcategory (list-detail) response shape.
 *
 * GET /hierarchy/v1/subcategory/{listId} returns the list's metadata + its
 * statuses + task counts. We CLONE the captured subcategory (preserving the
 * heavy permissions/feature defaults) and overlay the export list's id, name,
 * content, statuses, and counts.
 */

import type { CapturedTemplates } from './extract-templates';
import type { ExportList, ExportTask } from './load-export';
import type { SynthStatusSet } from './synth-statuses';
import { substituteTokens } from './clone-util';

type SubcategoryBody = Record<string, unknown>;

export function mapSubcategory(
  listId: string,
  list: ExportList | undefined,
  tasks: ExportTask[],
  statusSet: SynthStatusSet,
  templates: CapturedTemplates,
): SubcategoryBody | null {
  const template = templates.subcategory;
  const capturedListId = templates.capturedListId;
  if (!template || !capturedListId) return null;

  // Retarget the cloned template's captured-list id (appears in many nested
  // string fields: status ids, status_group, _version_vector, etc.) to this
  // list id, then overlay the export fields.
  const replacements = new Map<string, string>([[capturedListId, listId]]);
  const body = substituteTokens(template, replacements) as SubcategoryBody;

  body.id = listId;
  body.name = list?.name ?? body.name ?? 'List';
  if (typeof list?.content === 'string') body.content = list.content;
  if (typeof list?.orderindex === 'number') body.orderindex = list.orderindex;
  body.archived = list?.archived ?? false;
  body.deleted = false;
  body.taskCount = tasks.length;
  body.taskcount = tasks.length;
  body.statuses = statusSet.statuses;
  body.status_group = statusSet.statusGroup;
  if (list?.folder?.id) {
    body.category = list.folder.id;
  }

  return body;
}
