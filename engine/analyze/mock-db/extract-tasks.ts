import type {
  CapturedResponse,
  Keyed,
  MockChecklist,
  MockCustomFieldValue,
  MockStatus,
  MockTask,
  MockUser,
} from './types.js';
import { matches } from './net-reader.js';
import {
  anchorToDate,
  fixtureSubtasksByKey,
  fixtureTasksByKey,
  priorityValue,
  type SeedManifest,
} from './fixture-fallback.js';

/** Fixed base date so anchor-relative fixture dates are deterministic. */
const BASE_MS = Date.parse('2026-06-04T00:00:00Z');

function asStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

function toPriority(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(typeof raw === 'object' ? (raw as { priority?: unknown }).priority : raw);
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
}

function mapChecklists(raw: unknown): MockChecklist[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c, i) => {
    const obj = c as Record<string, unknown>;
    const items = Array.isArray(obj.items)
      ? (obj.items as Array<Record<string, unknown>>).map((it, j) => ({
          id: asStr(it.id) ?? `${i}-${j}`,
          name: (it.name as string) ?? '',
          resolved: Boolean(it.resolved),
        }))
      : [];
    return {
      id: asStr(obj.id) ?? String(i),
      name: (obj.name as string) ?? 'Checklist',
      resolved: typeof obj.resolved === 'number' ? obj.resolved : items.filter((x) => x.resolved).length,
      unresolved:
        typeof obj.unresolved === 'number' ? obj.unresolved : items.filter((x) => !x.resolved).length,
      items,
    };
  });
}

function mapTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => (typeof t === 'string' ? t : ((t as { name?: string }).name ?? ''))).filter(Boolean);
}

function mapAssignees(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => (typeof u === 'object' ? asStr((u as { id?: unknown }).id) : asStr(u)))
    .filter((x): x is string => Boolean(x));
}

/** Collect every richest captured task record across all bulk responses. */
function collectCapturedTasks(res: CapturedResponse[]): Map<string, Record<string, unknown>> {
  const best = new Map<string, Record<string, unknown>>();
  for (const r of res) {
    if (!matches(r, /^\/task-v3\/experience\/\d+\/tasks\/bulk/)) continue;
    const arr = (r.json as Record<string, unknown>).tasks as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const task = (entry.data as Record<string, unknown>)?.task as Record<string, unknown>;
      const id = asStr(entry.object_id) ?? (task && asStr(task.id));
      if (!task || !id) continue;
      const prev = best.get(id);
      if (!prev || Object.keys(task).length > Object.keys(prev).length) best.set(id, task);
    }
  }
  return best;
}

function statusNameFor(statusId: string | null, statuses: Keyed<MockStatus>): string | null {
  if (!statusId) return null;
  return statuses[statusId]?.status ?? null;
}

export function extractTasks(
  res: CapturedResponse[],
  manifest: SeedManifest,
  statuses: Keyed<MockStatus>,
  users: Keyed<MockUser>,
): { tasks: Keyed<MockTask>; foundIds: Set<string>; fixtureIds: Set<string> } {
  const captured = collectCapturedTasks(res);
  const fixtureMap = fixtureTasksByKey();
  const tasks: Keyed<MockTask> = {};
  const foundIds = new Set<string>();
  const fixtureIds = new Set<string>();

  // 1. Every captured task becomes a real, captured-source record.
  for (const [id, t] of captured) {
    const statusId = asStr(t.status_id);
    tasks[id] = {
      id,
      name: (t.name as string) ?? '',
      description: (t.html_content as string) ?? null,
      listId: asStr(t.subcategory),
      statusId,
      status: statusNameFor(statusId, statuses),
      priority: toPriority(t.priority),
      parentId: asStr(t.direct_parent),
      subtaskIds: Array.isArray(t.subtask_ids) ? (t.subtask_ids as unknown[]).map(String) : [],
      assigneeIds: mapAssignees(t.assignees ?? t.users),
      tagNames: mapTags(t.tags),
      startDate: asStr(t.start_date),
      dueDate: asStr(t.due_date),
      dateCreated: asStr(t.date_created),
      checklists: mapChecklists(t.checklists),
      customFieldValues: [],
      commentCount: 0,
      dependsOnIds: [],
      _source: 'captured',
    };
    foundIds.add(id);
  }

  // 2. Walk the manifest's task ids. Any not captured is filled from fixture
  //    (under its REAL id). Captured tasks are enriched with fixture-only
  //    fields the captures never carried (dates, assignees, CF values, deps).
  const keyToId = manifest.ids;
  for (const [fixtureKey, { task: f, listKey }] of fixtureMap) {
    const realId = keyToId[fixtureKey];
    if (!realId) continue;
    const listId = keyToId[listKey] ?? null;
    const existing = tasks[realId];

    const fStart = anchorToDate(f.startAnchor, BASE_MS);
    const fDue = anchorToDate(f.dueAnchor, BASE_MS);
    const ownerId = Object.keys(users)[0] ?? null;
    const fAssigneeIds = f.assignSelf && ownerId ? [ownerId] : [];
    const fCustom: MockCustomFieldValue[] = (f.customFields ?? []).map((cf) => ({
      fieldId: null,
      name: cf.name,
      type: cf.type,
      value: cf.dropdownOptionName ?? cf.value ?? null,
    }));
    const dependsOnIds = f.dependsOnKey && keyToId[f.dependsOnKey] ? [keyToId[f.dependsOnKey]] : [];

    if (existing) {
      // enrich captured task with fixture-only fields
      if (!existing.startDate) existing.startDate = fStart;
      if (!existing.dueDate) existing.dueDate = fDue;
      if (!existing.description) existing.description = f.description ?? null;
      if (!existing.assigneeIds.length) existing.assigneeIds = fAssigneeIds;
      if (!existing.customFieldValues.length) existing.customFieldValues = fCustom;
      if (!existing.dependsOnIds.length) existing.dependsOnIds = dependsOnIds;
      if (!existing.priority) existing.priority = priorityValue(f.priority);
      continue;
    }

    // fully synthesise from fixture under the real id
    tasks[realId] = {
      id: realId,
      name: f.name,
      description: f.description ?? null,
      listId,
      statusId: null,
      status: f.status ?? null,
      priority: priorityValue(f.priority),
      parentId: null,
      subtaskIds: (f.subtasks ?? []).map((s) => keyToId[s.key]).filter(Boolean),
      assigneeIds: fAssigneeIds,
      tagNames: f.tags ?? [],
      startDate: fStart,
      dueDate: fDue,
      dateCreated: null,
      checklists: (f.checklists ?? []).map((c, i) => ({
        id: `${realId}-cl${i}`,
        name: c.name,
        resolved: c.items.filter((x) => x.resolved).length,
        unresolved: c.items.filter((x) => !x.resolved).length,
        items: c.items.map((it, j) => ({ id: `${realId}-cl${i}-${j}`, name: it.name, resolved: Boolean(it.resolved) })),
      })),
      customFieldValues: fCustom,
      commentCount: (f.comments ?? []).length,
      dependsOnIds,
      _source: 'fixture',
    };
    fixtureIds.add(realId);
  }

  // 3. Materialise fixture subtasks under their real ids if not already captured.
  for (const [subKey, { subtask, parentKey, listKey }] of fixtureSubtasksByKey()) {
    const realId = keyToId[subKey];
    if (!realId || tasks[realId]) continue;
    const parentId = keyToId[parentKey] ?? null;
    const listId = keyToId[listKey] ?? null;
    tasks[realId] = {
      id: realId,
      name: subtask.name,
      description: null,
      listId,
      statusId: null,
      status: subtask.status ?? null,
      priority: priorityValue(subtask.priority ?? null),
      parentId,
      subtaskIds: [],
      assigneeIds: [],
      tagNames: [],
      startDate: null,
      dueDate: anchorToDate(subtask.dueAnchor, BASE_MS),
      dateCreated: null,
      checklists: [],
      customFieldValues: [],
      commentCount: 0,
      dependsOnIds: [],
      _source: 'fixture',
    };
    if (parentId && tasks[parentId] && !tasks[parentId].subtaskIds.includes(realId)) {
      tasks[parentId].subtaskIds.push(realId);
    }
    fixtureIds.add(realId);
  }

  return { tasks, foundIds, fixtureIds };
}
