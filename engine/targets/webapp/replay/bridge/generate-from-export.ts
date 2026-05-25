/**
 * Generate synthetic INTERNAL-shape replay recordings for EVERY list/space in a
 * ClickUp export, so the replay renders lists the crawl never captured.
 *
 * Strategy (stays in the proven static-replay model — no live server, no SW
 * rewrite): load the export's public-API data + the captured internal-shape
 * templates, then for each list emit recordings for the endpoints the bundle
 * hits to render a list view:
 *   - GET  /hierarchy/v1/subcategory/{listId}        (list detail)
 *   - POST /view/v1/genericView                      (task-id groups)
 *   - POST /task-v3/experience/{ws}/tasks/bulk       (full task data)
 *
 * Each per-list recording carries a `matchKey` so the SW can resolve the right
 * list among recordings sharing one wildcarded path pattern. A sidecar
 * task-id -> list-id index lets the SW route a tasks/bulk request (whose body
 * names task ids, not the list) to the correct list's recording.
 *
 * These recordings are MERGED with the captured recordings (bridge recordings
 * appended last). The build wires this behind an additive flag, so without it
 * behaviour is unchanged.
 */

import { redactString } from '../../redact';
import type { ReplayRecording } from '../types';
import type { CapturedTemplates } from './extract-templates';
import { extractTemplates } from './extract-templates';
import { loadExport, type ExportData } from './load-export';
import { synthStatusesForList } from './synth-statuses';
import { mapSubcategory } from './map-subcategory';
import { mapGenericView } from './map-generic-view';
import { mapTasksBulk } from './map-tasks-bulk';

const JSON_CT = 'application/json; charset=utf-8';

export type BridgeIndex = {
  /** task id -> list match key, so the SW routes tasks/bulk to a list. */
  taskToList: Record<string, string>;
  /** list id -> match key (identity today, reserved for future remap). */
  lists: string[];
};

export type BridgeResult = {
  recordings: ReplayRecording[];
  index: BridgeIndex;
  listCount: number;
  taskCount: number;
  warnings: string[];
};

function rec(
  method: string,
  pathPattern: string,
  origin: string,
  body: unknown,
  matchKey: string,
): ReplayRecording {
  return {
    method,
    pathPattern,
    origin,
    requestBodyKey: '',
    status: 200,
    contentType: JSON_CT,
    body: redactString(JSON.stringify(body)),
    matchKey,
  };
}

function originOf(templates: CapturedTemplates): string {
  // The bridge endpoints all target the frontdoor host. Derive it from the
  // captured templates is unnecessary: the SW matches on path, not origin, but
  // we record a representative origin for parity with captured recordings.
  return 'https://frontdoor-prod-eu-west-1-3.clickup.com';
}

export async function generateBridgeRecordings(
  crawlDir: string,
  exportDir: string,
): Promise<BridgeResult> {
  const warnings: string[] = [];
  const templates = await extractTemplates(crawlDir);

  const missing: string[] = [];
  if (!templates.subcategory) missing.push('subcategory');
  if (!templates.genericView) missing.push('genericView');
  if (!templates.tasksBulk) missing.push('tasks/bulk');
  if (missing.length > 0) {
    warnings.push(
      `Bridge: missing captured template(s) [${missing.join(', ')}] — those endpoint kinds will not be synthesized. ` +
        'Recapture a populated list view so the bundle has a structural skeleton.',
    );
  }

  let exportData: ExportData;
  try {
    exportData = loadExport(exportDir);
  } catch (err) {
    warnings.push(`Bridge: failed to load export — ${(err as Error).message}`);
    return { recordings: [], index: { taskToList: {}, lists: [] }, listCount: 0, taskCount: 0, warnings };
  }

  const origin = originOf(templates);
  const recordings: ReplayRecording[] = [];
  const taskToList: Record<string, string> = {};
  const listMatchKeys: string[] = [];
  let taskCount = 0;
  let listCount = 0;

  // The captured list already has REAL recordings from the crawl. Skip it so
  // its original capture serves untouched (strict no-regression), while every
  // OTHER list is synthesized from the export.
  const capturedListId = templates.capturedListId;

  for (const list of exportData.lists) {
    const listId = list.id;
    if (capturedListId && listId === capturedListId) continue;
    const tasks = exportData.tasksByList.get(listId) ?? [];
    const statusSet = synthStatusesForList(listId, exportData.listsById.get(listId), tasks);
    const matchKey = listId;

    // 1. subcategory (list detail).
    const subcategory = mapSubcategory(listId, list, tasks, statusSet, templates);
    if (subcategory) {
      recordings.push(
        rec('GET', `/hierarchy/v1/subcategory/${listId}`, origin, subcategory, `subcat:${matchKey}`),
      );
    }

    // 2. genericView (task-id groups).
    const genericView = mapGenericView(listId, list, tasks, statusSet, templates);
    if (genericView) {
      recordings.push(rec('POST', '/view/v1/genericView', origin, genericView, `gv:${matchKey}`));
    }

    // 3. tasks/bulk (full task data). Keyed by list; the SW routes via the
    // task-id index since the request body names task ids, not the list.
    if (tasks.length > 0) {
      const bulk = mapTasksBulk(listId, tasks, statusSet, templates);
      if (bulk) {
        recordings.push(
          rec(
            'POST',
            `/task-v3/experience/${exportData.workspaceId}/tasks/bulk`,
            origin,
            bulk,
            `bulk:${matchKey}`,
          ),
        );
        for (const task of tasks) taskToList[task.id] = `bulk:${matchKey}`;
      }
    }

    listMatchKeys.push(matchKey);
    listCount++;
    taskCount += tasks.length;
  }

  return {
    recordings,
    index: { taskToList, lists: listMatchKeys },
    listCount,
    taskCount,
    warnings,
  };
}
