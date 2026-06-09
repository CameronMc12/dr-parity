import type {
  CapturedResponse,
  Keyed,
  MockFolder,
  MockList,
  MockSpace,
  MockStatus,
  MockUser,
  MockWorkspace,
} from './types.js';
import { matches } from './net-reader.js';
import type { SeedManifest } from './fixture-fallback.js';

interface Ctx {
  users: Keyed<MockUser>;
  statuses: Keyed<MockStatus>;
  spaces: Keyed<MockSpace>;
  folders: Keyed<MockFolder>;
  lists: Keyed<MockList>;
}

function asStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

function recordUser(users: Keyed<MockUser>, raw: Record<string, unknown>): void {
  const id = asStr(raw.id);
  if (!id) return;
  if (users[id] && users[id]._source === 'captured') return;
  users[id] = {
    id,
    username: (raw.username as string) ?? 'Unknown',
    email: (raw.email as string) ?? null,
    color: (raw.color as string) ?? null,
    initials: (raw.initials as string) ?? null,
    profilePicture: (raw.profilePicture as string) ?? null,
    timezone: (raw.timezone as string) ?? null,
    _source: 'captured',
  };
}

function extractWorkspace(
  res: CapturedResponse[],
  users: Keyed<MockUser>,
): MockWorkspace | null {
  const team = res.find((r) => matches(r, /^\/team\/v1\/team\/\d+/));
  if (!team || typeof team.json !== 'object' || team.json == null) return null;
  const t = team.json as Record<string, unknown>;
  const owner = t.owner as Record<string, unknown> | undefined;
  if (owner) recordUser(users, owner);
  const members = (t.members as Array<Record<string, unknown>>) ?? [];
  for (const m of members) {
    const u = (m.user as Record<string, unknown>) ?? m;
    recordUser(users, u);
  }
  return {
    id: asStr(t.id) ?? '',
    name: (t.name as string) ?? 'Workspace',
    color: (t.color as string) ?? null,
    ownerId: asStr(owner?.id) ?? '',
    dateCreated: asStr(t.date_created),
    memberIds: Object.keys(users),
    _source: 'captured',
  };
}

function extractStatuses(res: CapturedResponse[], statuses: Keyed<MockStatus>): void {
  // task-v3 bulk carries fully-typed status rows; customFields/v2 taskStatuses
  // carries the all_statuses palette. Prefer the bulk rows (richer typing).
  const allStatusRows: Array<Record<string, unknown>> = [];
  for (const r of res) {
    if (matches(r, /^\/task-v3\/experience\/\d+\/tasks\/bulk/)) {
      const j = r.json as Record<string, unknown>;
      for (const s of (j.statuses as Array<Record<string, unknown>>) ?? []) {
        allStatusRows.push(s);
      }
    }
  }
  for (const s of allStatusRows) {
    const id = asStr(s.id);
    if (!id) continue;
    statuses[id] = {
      id,
      status: (s.status as string) ?? '',
      color: (s.color as string) ?? null,
      type: (s.type as string) ?? 'open',
      orderindex: typeof s.orderindex === 'number' ? s.orderindex : null,
      projectId: asStr(s.project_id),
      _source: 'captured',
    };
  }
}

/** The sidebar tree holds the seed space → folders (categories) → lists. */
function extractTree(res: CapturedResponse[], ctx: Ctx, manifest: SeedManifest): void {
  const tree = res.find((r) =>
    matches(r, /^\/hierarchy\/v3\/experience\/sidebar\/workspaces\/\d+\/tree/),
  );
  const wsId = manifest.teamId;
  if (tree && typeof tree.json === 'object') {
    const projects = ((tree.json as Record<string, unknown>).projects ?? []) as Array<
      Record<string, unknown>
    >;
    for (const sp of projects) {
      if (asStr(sp.id) !== manifest.spaceId) continue;
      const spaceId = asStr(sp.id)!;
      const folderIds: string[] = [];
      const folderlessListIds: string[] = [];
      for (const cat of (sp.categories as Array<Record<string, unknown>>) ?? []) {
        const folderId = asStr(cat.id)!;
        const hidden = Boolean(cat.hidden);
        const listIds: string[] = [];
        for (const sub of (cat.subcategories as Array<Record<string, unknown>>) ?? []) {
          const listId = asStr(sub.id)!;
          listIds.push(listId);
          ctx.lists[listId] = {
            id: listId,
            name: (sub.name as string) ?? '',
            folderId: hidden ? null : folderId,
            spaceId,
            orderindex: typeof sub.orderindex === 'number' ? sub.orderindex : null,
            content: null,
            statusIds: [],
            taskIds: [],
            _source: 'captured',
          };
          if (hidden) folderlessListIds.push(listId);
        }
        if (hidden) continue; // the "hidden" category holds folderless lists
        folderIds.push(folderId);
        ctx.folders[folderId] = {
          id: folderId,
          name: (cat.name as string) ?? '',
          spaceId,
          orderindex: typeof cat.orderindex === 'number' ? cat.orderindex : null,
          hidden: false,
          content: null,
          listIds,
          _source: 'captured',
        };
      }
      ctx.spaces[spaceId] = {
        id: spaceId,
        name: (sp.name as string) ?? '',
        workspaceId: wsId,
        color: null,
        private: false,
        orderindex: typeof sp.orderindex === 'number' ? sp.orderindex : null,
        content: null,
        statusIds: [],
        folderIds,
        folderlessListIds,
        _source: 'captured',
      };
    }
  }
}

/** Enrich the seed space with colour/content/status set from hierarchy/v1/project. */
function enrichSpace(res: CapturedResponse[], ctx: Ctx, manifest: SeedManifest): void {
  const project = res.find((r) => matches(r, /^\/hierarchy\/v1\/project\?/));
  if (!project || !Array.isArray(project.json)) return;
  for (const sp of project.json as Array<Record<string, unknown>>) {
    if (asStr(sp.id) !== manifest.spaceId) continue;
    const space = ctx.spaces[manifest.spaceId];
    if (!space) continue;
    space.color = (sp.color as string) ?? space.color;
    space.private = Boolean(sp.private);
    space.content = (sp.content as string) ?? space.content;
    const statusIds: string[] = [];
    for (const s of (sp.statuses as Array<Record<string, unknown>>) ?? []) {
      const id = asStr(s.id);
      if (!id) continue;
      statusIds.push(id);
      if (!ctx.statuses[id]) {
        ctx.statuses[id] = {
          id,
          status: (s.status as string) ?? '',
          color: (s.color as string) ?? null,
          type: (s.type as string) ?? 'open',
          orderindex: typeof s.orderindex === 'number' ? s.orderindex : null,
          projectId: manifest.spaceId,
          _source: 'captured',
        };
      }
    }
    if (statusIds.length) space.statusIds = statusIds;
  }
}

/** list_status_ids_map (from bulk) tells which statuses each list exposes. */
function wireListStatuses(res: CapturedResponse[], ctx: Ctx): void {
  for (const r of res) {
    if (!matches(r, /^\/task-v3\/experience\/\d+\/tasks\/bulk/)) continue;
    const map = (r.json as Record<string, unknown>).list_status_ids_map as
      | Record<string, string[]>
      | undefined;
    if (!map) continue;
    for (const [listId, statusIds] of Object.entries(map)) {
      const list = ctx.lists[listId];
      if (list && statusIds?.length) list.statusIds = statusIds;
    }
  }
}

export function extractHierarchy(res: CapturedResponse[], manifest: SeedManifest): Ctx & {
  workspace: MockWorkspace | null;
} {
  const ctx: Ctx = { users: {}, statuses: {}, spaces: {}, folders: {}, lists: {} };
  const workspace = extractWorkspace(res, ctx.users);
  extractStatuses(res, ctx.statuses);
  extractTree(res, ctx, manifest);
  enrichSpace(res, ctx, manifest);
  wireListStatuses(res, ctx);
  return { ...ctx, workspace };
}
