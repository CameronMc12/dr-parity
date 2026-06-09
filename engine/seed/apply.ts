/**
 * Idempotent apply runner. Walks the fixture and creates every entity, skipping
 * any that already exist (matched by name within their parent). Records every
 * created/matched id into the manifest keyed by fixture key.
 *
 * Custom fields cannot be created via the public API: values are only set when a
 * field of the same name already exists on the list. Unmatched field requests
 * are collected into `skippedFields` and reported.
 */

import {
  ClickUpClient,
  type CuCustomField,
  type CuList,
  type CuStatus,
  type CuTask,
} from './clickup-api.js';
import { resolveAnchor } from './plan.js';
import { type SeedManifest } from './manifest.js';
import {
  PRIORITY_VALUE,
  type SeedCustomFieldValue,
  type SeedFixture,
  type SeedList,
  type SeedTask,
} from './types.js';

export interface ApplyResult {
  manifest: SeedManifest;
  skippedFields: string[];
  remappedStatuses: string[];
}

interface ApplyCtx {
  client: ClickUpClient;
  teamId: string;
  workspaceId: string;
  selfUserId: number;
  now: number;
  manifest: SeedManifest;
  skippedFields: string[];
  remappedStatuses: string[];
  remappedSeen: Set<string>;
  taskIdByKey: Map<string, string>;
  log: (msg: string) => void;
}

function byName<T extends { name: string }>(items: T[], name: string): T | undefined {
  return items.find((i) => i.name === name);
}

/**
 * Resolves a fixture status name against a list's actual statuses. New ClickUp
 * spaces only carry their default status set; custom statuses cannot be created
 * via the public API. Unmatched names map to the list's canonical "to do"
 * (first type:"open") or its done/closed status when the fixture status means
 * complete. Never returns a status the list does not have.
 */
function makeStatusResolver(
  ctx: ApplyCtx,
  listKey: string,
  statuses: CuStatus[],
): (fixtureStatus: string | undefined) => string | undefined {
  const byLower = new Map(statuses.map((s) => [s.status.toLowerCase(), s]));
  const open = statuses.find((s) => s.type === 'open');
  const done = statuses.find((s) => s.type === 'done') ?? statuses.find((s) => s.type === 'closed');
  const completeNames = new Set(['done', 'complete', 'completed', 'closed', 'resolved', 'shipped']);

  return (fixtureStatus) => {
    if (!fixtureStatus) return undefined;
    const exact = byLower.get(fixtureStatus.toLowerCase());
    if (exact) return exact.status;

    const meansComplete = completeNames.has(fixtureStatus.toLowerCase());
    const fallback = (meansComplete ? done : open)?.status ?? open?.status ?? done?.status;
    const seenKey = `${listKey}:${fixtureStatus.toLowerCase()}`;
    if (fallback && !ctx.remappedSeen.has(seenKey)) {
      ctx.remappedSeen.add(seenKey);
      ctx.remappedStatuses.push(`${fixtureStatus} -> ${fallback}`);
      ctx.log(`SKIPPED STATUS "${fixtureStatus}" -> "${fallback}" (list ${listKey})`);
    }
    return fallback;
  };
}

export async function applyFixture(
  client: ClickUpClient,
  fixture: SeedFixture,
  teamId: string,
  manifest: SeedManifest,
  log: (msg: string) => void,
): Promise<ApplyResult> {
  const me = await client.getCurrentUser();
  const ctx: ApplyCtx = {
    client,
    teamId,
    workspaceId: teamId,
    selfUserId: me.id,
    now: Date.now(),
    manifest,
    skippedFields: [],
    remappedStatuses: [],
    remappedSeen: new Set(),
    taskIdByKey: new Map(),
    log,
  };

  const { space } = fixture;

  const existingSpaces = await client.listSpaces(teamId);
  let spaceId = byName(existingSpaces, space.name)?.id;
  if (!spaceId) {
    spaceId = (await client.createSpace(teamId, space.name)).id;
    log(`created space ${space.name} (${spaceId})`);
  } else {
    log(`skip space ${space.name} (exists ${spaceId})`);
  }
  manifest.spaceId = spaceId;
  manifest.ids[space.key] = spaceId;

  await ensureTags(ctx, spaceId, space);

  for (const folder of space.folders) {
    const existingFolders = await client.listFolders(spaceId);
    let folderId = byName(existingFolders, folder.name)?.id;
    if (!folderId) {
      folderId = (await client.createFolder(spaceId, folder.name)).id;
      log(`created folder ${folder.name} (${folderId})`);
    } else {
      log(`skip folder ${folder.name} (exists ${folderId})`);
    }
    manifest.ids[folder.key] = folderId;

    for (const list of folder.lists) {
      const existing = await client.listFolderLists(folderId);
      const listId = await ensureList(ctx, existing, list, () =>
        client.createFolderList(folderId!, list.name, list.content),
      );
      await ensureTasks(ctx, spaceId, listId, list);
    }
  }

  for (const list of space.folderlessLists) {
    const existing = await client.listFolderlessLists(spaceId);
    const listId = await ensureList(ctx, existing, list, () =>
      client.createFolderlessList(spaceId!, list.name, list.content),
    );
    await ensureTasks(ctx, spaceId, listId, list);
  }

  // dependencies need both endpoints created first.
  await applyDependencies(ctx, fixture);

  await applyDocs(ctx, fixture);
  await applyGoals(ctx, fixture);

  return { manifest, skippedFields: ctx.skippedFields, remappedStatuses: ctx.remappedStatuses };
}

async function ensureTags(ctx: ApplyCtx, spaceId: string, space: SeedFixture['space']): Promise<void> {
  const existing = await ctx.client.listSpaceTags(spaceId);
  const have = new Set(existing.map((t) => t.name));
  for (const tag of space.tags) {
    if (have.has(tag.name)) {
      ctx.log(`skip tag #${tag.name}`);
      continue;
    }
    await ctx.client.createSpaceTag(spaceId, tag.name, tag.fg, tag.bg);
    ctx.log(`created tag #${tag.name}`);
  }
}

async function ensureList(
  ctx: ApplyCtx,
  existing: CuList[],
  list: SeedList,
  create: () => Promise<CuList>,
): Promise<string> {
  let listId = byName(existing, list.name)?.id;
  if (!listId) {
    listId = (await create()).id;
    ctx.log(`created list ${list.name} (${listId})`);
  } else {
    ctx.log(`skip list ${list.name} (exists ${listId})`);
  }
  ctx.manifest.ids[list.key] = listId;
  return listId;
}

async function ensureTasks(ctx: ApplyCtx, spaceId: string, listId: string, list: SeedList): Promise<void> {
  const existing = await ctx.client.listTasks(listId);
  const fields = await ctx.client.getListFields(listId);
  const statuses = await ctx.client.getListStatuses(listId);
  const resolveStatus = makeStatusResolver(ctx, list.key, statuses);

  for (const task of list.tasks) {
    const created = await ensureTask(ctx, listId, existing, task, resolveStatus);
    ctx.taskIdByKey.set(task.key, created.id);
    ctx.manifest.ids[task.key] = created.id;

    if (!created.preexisting) {
      await applyTaskTags(ctx, created.id, task);
      await applyTaskChecklists(ctx, created.id, task);
      await applyTaskComments(ctx, created.id, task);
      await applyTaskFields(ctx, created.id, fields, task);
      await applySubtasks(ctx, listId, created.id, task, resolveStatus);
    }
  }
}

interface EnsuredTask {
  id: string;
  preexisting: boolean;
}

async function ensureTask(
  ctx: ApplyCtx,
  listId: string,
  existing: CuTask[],
  task: SeedTask,
  resolveStatus: (s: string | undefined) => string | undefined,
): Promise<EnsuredTask> {
  const match = byName(existing, task.name);
  if (match) {
    ctx.log(`skip task ${trim(task.name)} (exists ${match.id})`);
    return { id: match.id, preexisting: true };
  }
  const created = await ctx.client.createTask(listId, {
    name: task.name,
    description: task.description,
    assignees: task.assignSelf ? [ctx.selfUserId] : undefined,
    status: resolveStatus(task.status),
    priority: task.priority ? PRIORITY_VALUE[task.priority] : undefined,
    start_date: resolveAnchor(task.startAnchor ?? null, ctx.now),
    due_date: resolveAnchor(task.dueAnchor ?? null, ctx.now),
  });
  ctx.log(`created task ${trim(task.name)} (${created.id})`);
  return { id: created.id, preexisting: false };
}

async function applyTaskTags(ctx: ApplyCtx, taskId: string, task: SeedTask): Promise<void> {
  for (const tag of task.tags ?? []) {
    await ctx.client.addTagToTask(taskId, tag);
  }
}

async function applyTaskChecklists(ctx: ApplyCtx, taskId: string, task: SeedTask): Promise<void> {
  for (const cl of task.checklists ?? []) {
    const checklist = await ctx.client.createChecklist(taskId, cl.name);
    for (const item of cl.items) {
      await ctx.client.createChecklistItem(checklist.id, item.name, item.resolved ?? false);
    }
  }
}

async function applyTaskComments(ctx: ApplyCtx, taskId: string, task: SeedTask): Promise<void> {
  for (const c of task.comments ?? []) {
    await ctx.client.createTaskComment(taskId, c.text, task.assignSelf ? ctx.selfUserId : undefined);
  }
}

async function applyTaskFields(
  ctx: ApplyCtx,
  taskId: string,
  fields: CuCustomField[],
  task: SeedTask,
): Promise<void> {
  for (const f of task.customFields ?? []) {
    const field = fields.find((x) => x.name === f.name);
    if (!field) {
      ctx.skippedFields.push(`${f.name} (no such field on list — create it in the UI)`);
      continue;
    }
    const value = resolveFieldValue(ctx, field, f);
    if (value === undefined) {
      ctx.skippedFields.push(`${f.name} (could not resolve value/option)`);
      continue;
    }
    await ctx.client.setTaskFieldValue(taskId, field.id, value);
  }
}

function resolveFieldValue(
  ctx: ApplyCtx,
  field: CuCustomField,
  f: SeedCustomFieldValue,
): unknown {
  if (f.type === 'drop_down') {
    const opt = field.type_config?.options?.find(
      (o) => (o.name ?? o.label) === f.dropdownOptionName,
    );
    return opt?.id;
  }
  if (f.type === 'date') {
    return resolveAnchor(f.dateAnchor ?? null, ctx.now);
  }
  if (f.type === 'checkbox') {
    return f.value ? 'true' : 'false';
  }
  return f.value;
}

async function applySubtasks(
  ctx: ApplyCtx,
  listId: string,
  parentId: string,
  task: SeedTask,
  resolveStatus: (s: string | undefined) => string | undefined,
): Promise<void> {
  for (const sub of task.subtasks ?? []) {
    const created = await ctx.client.createTask(listId, {
      name: sub.name,
      status: resolveStatus(sub.status),
      priority: sub.priority ? PRIORITY_VALUE[sub.priority] : undefined,
      due_date: resolveAnchor(sub.dueAnchor ?? null, ctx.now),
      parent: parentId,
    });
    ctx.manifest.ids[sub.key] = created.id;
    ctx.log(`created subtask ${trim(sub.name)} (${created.id})`);
  }
}

async function applyDependencies(ctx: ApplyCtx, fixture: SeedFixture): Promise<void> {
  const allTasks: SeedTask[] = [];
  for (const folder of fixture.space.folders) for (const l of folder.lists) allTasks.push(...l.tasks);
  for (const l of fixture.space.folderlessLists) allTasks.push(...l.tasks);

  for (const task of allTasks) {
    if (!task.dependsOnKey) continue;
    const from = ctx.taskIdByKey.get(task.key);
    const to = ctx.taskIdByKey.get(task.dependsOnKey);
    if (!from || !to) {
      ctx.log(`skip dependency ${task.key} -> ${task.dependsOnKey} (missing id)`);
      continue;
    }
    try {
      await ctx.client.createDependency(from, to);
      ctx.log(`created dependency ${task.key} -> ${task.dependsOnKey}`);
    } catch (err) {
      // re-runs throw because the dependency already exists; treat as idempotent.
      ctx.log(`dependency ${task.key} -> ${task.dependsOnKey} skipped: ${(err as Error).message.slice(0, 80)}`);
    }
  }
}

async function applyDocs(ctx: ApplyCtx, fixture: SeedFixture): Promise<void> {
  for (const doc of fixture.space.docs) {
    if (ctx.manifest.ids[doc.key]) {
      ctx.log(`skip doc ${doc.name} (in manifest)`);
      continue;
    }
    const created = await ctx.client.createDoc(ctx.workspaceId, doc.name);
    ctx.manifest.ids[doc.key] = created.id;
    ctx.log(`created doc ${doc.name} (${created.id})`);
    for (const page of doc.pages) {
      const p = await ctx.client.createDocPage(ctx.workspaceId, created.id, page.name, page.content);
      ctx.manifest.ids[page.key] = p.id;
      ctx.log(`created doc page ${page.name} (${p.id})`);
    }
  }
}

async function applyGoals(ctx: ApplyCtx, fixture: SeedFixture): Promise<void> {
  for (const goal of fixture.space.goals) {
    if (ctx.manifest.ids[goal.key]) {
      ctx.log(`skip goal ${goal.name} (in manifest)`);
      continue;
    }
    const due = resolveAnchor(goal.dueAnchor, ctx.now) ?? ctx.now;
    const created = await ctx.client.createGoal(
      ctx.teamId,
      goal.name,
      goal.description,
      due,
      ctx.selfUserId,
    );
    ctx.manifest.ids[goal.key] = created.id;
    ctx.log(`created goal ${goal.name} (${created.id})`);
  }
}

function trim(s: string, max = 50): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
