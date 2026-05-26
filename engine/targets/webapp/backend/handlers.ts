/**
 * Request handlers for the OWNED ClickUp replay backend.
 *
 * Each handler takes the parsed request (method, path segments, query, body) and
 * the store + cached templates, and returns the INTERNAL-shape JSON the bundle
 * expects. List-render handlers (subcategory / genericView / tasks-bulk) REUSE
 * the proven bridge mappers at request time. Lighter reads (members, customFields,
 * badge_count, lineup, bootstrap, workspace core) are formatted directly from
 * store rows or the contract's sample shapes.
 *
 * A handler returns `null` to signal "not mine" so the router can try the next.
 */

import { mapGenericView } from '../replay/bridge/map-generic-view';
import { mapSubcategory } from '../replay/bridge/map-subcategory';
import { mapTasksBulk } from '../replay/bridge/map-tasks-bulk';
import { synthStatusesForList } from '../replay/bridge/synth-statuses';
import type { CapturedTemplates } from '../replay/bridge/extract-templates';
import type { BackendStore, StoreMember } from './store-types';
import { synthVizView, type ViewSynthAssets } from './view-synth';

export type RequestCtx = {
  method: string;
  pathname: string;
  segments: string[];
  query: URLSearchParams;
  body: unknown;
};

export type HandlerResult = {
  handler: string;
  body: unknown;
};

export type Handler = (
  ctx: RequestCtx,
  store: BackendStore,
  templates: CapturedTemplates,
) => HandlerResult | null;

// ---------------------------------------------------------------------------
// List-render handlers (reuse the proven bridge mappers at request time).
// ---------------------------------------------------------------------------

/** GET /hierarchy/v1/subcategory/{listId} */
export const subcategoryHandler: Handler = (ctx, store, templates) => {
  if (ctx.method !== 'GET') return null;
  const m = ctx.pathname.match(/\/hierarchy\/v1\/subcategory\/(\d+)\b/);
  if (!m) return null;
  const listId = m[1];
  const list = store.listById(listId);
  const tasks = store.tasksByList(listId);
  const statusSet = synthStatusesForList(listId, list, tasks);
  const body = mapSubcategory(listId, list, tasks, statusSet, templates);
  if (!body) return null;
  return { handler: 'subcategory', body };
};

/** POST /view/v1/genericView (body.parent.id names the list) */
export const genericViewHandler: Handler = (ctx, store, templates) => {
  if (ctx.method !== 'POST' || !/\/view\/v1\/genericView/.test(ctx.pathname)) return null;
  const parsed = ctx.body as { parent?: { id?: string | number } } | null;
  const listId = parsed?.parent?.id !== undefined ? String(parsed.parent.id) : null;
  if (!listId) return null;
  const list = store.listById(listId);
  const tasks = store.tasksByList(listId);
  const statusSet = synthStatusesForList(listId, list, tasks);
  const body = mapGenericView(listId, list, tasks, statusSet, templates);
  if (!body) return null;
  return { handler: 'genericView', body };
};

/** POST /task-v3/experience/{ws}/tasks/bulk (body.ids names tasks) */
export const tasksBulkHandler: Handler = (ctx, store, templates) => {
  if (ctx.method !== 'POST' || !/\/task-v3\/experience\/\d+\/tasks\/bulk/.test(ctx.pathname)) {
    return null;
  }
  const parsed = ctx.body as { ids?: unknown[] } | null;
  const ids = Array.isArray(parsed?.ids) ? parsed.ids.map(String) : [];
  if (ids.length === 0) return null;
  // Resolve the list from the first id that maps to one.
  let listId: string | undefined;
  for (const id of ids) {
    const l = store.taskToListId(id);
    if (l) {
      listId = l;
      break;
    }
  }
  if (!listId) return null;
  const tasks = store.tasksByList(listId).filter((t) => ids.includes(t.id));
  const effectiveTasks = tasks.length > 0 ? tasks : store.tasksByList(listId);
  const statusSet = synthStatusesForList(listId, store.listById(listId), effectiveTasks);
  const body = mapTasksBulk(listId, effectiveTasks, statusSet, templates);
  if (!body) return null;
  return { handler: 'tasksBulk', body };
};

// ---------------------------------------------------------------------------
// Hierarchy / sidebar handlers (serve captured skeletons + export overlay).
// ---------------------------------------------------------------------------

/** GET /hierarchy/v3/experience/sidebar/workspaces/{ws}/tree */
export const sidebarTreeHandler: Handler = (ctx, _store, templates) => {
  if (ctx.method !== 'GET') return null;
  if (!/\/hierarchy\/v3\/experience\/sidebar\/workspaces\/\d+\/tree/.test(ctx.pathname)) return null;
  if (!templates.sidebarTree) return null;
  return { handler: 'sidebarTree', body: templates.sidebarTree };
};

/** GET /hierarchy/v1/project?team={ws} */
export const projectHandler: Handler = (ctx, _store, templates) => {
  if (ctx.method !== 'GET' || !/\/hierarchy\/v1\/project\b/.test(ctx.pathname)) return null;
  if (!templates.project) return null;
  return { handler: 'project', body: templates.project };
};

/** GET /hierarchy/v1/team/{ws}/projectFeatures */
export const projectFeaturesHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/hierarchy\/v1\/team\/\d+\/projectFeatures/.test(ctx.pathname)) {
    return null;
  }
  return { handler: 'projectFeatures', body: {} };
};

/** GET /hierarchy/v1/team/{ws}/personalListHierarchy */
export const personalListHierarchyHandler: Handler = (ctx) => {
  if (
    ctx.method !== 'GET' ||
    !/\/hierarchy\/v1\/team\/\d+\/personalListHierarchy/.test(ctx.pathname)
  ) {
    return null;
  }
  return { handler: 'personalListHierarchy', body: { folders: [], lists: [] } };
};

/** GET /hierarchy/v3/experience/workspaces/{ws}?fields[]=core|location_statuses */
export const hierarchyExperienceHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET') return null;
  if (!/\/hierarchy\/v3\/experience\/workspaces\/\d+$/.test(ctx.pathname)) return null;
  const fields = ctx.query.getAll('fields[]');
  if (fields.includes('location_statuses')) {
    return { handler: 'hierarchy.location_statuses', body: { location_statuses: {} } };
  }
  // core: workspace structure summary.
  return {
    handler: 'hierarchy.core',
    body: {
      core: {
        id: store.workspaceId(),
        spaces: store.spaces().map((s) => ({ id: s.id, name: s.name })),
      },
    },
  };
};

// ---------------------------------------------------------------------------
// User / member handlers.
// ---------------------------------------------------------------------------

function memberEntry(m: StoreMember): Record<string, unknown> {
  return {
    id: m.id,
    username: m.username,
    email: m.email,
    color: m.color ?? '#595d66',
    profilePicture: m.profilePicture ?? null,
    initials: m.initials ?? '',
    role: m.role ?? 1,
    role_key: m.role_key ?? 'member',
  };
}

/** GET /user/v1/user?include_teams=true */
export const userHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/user\/v1\/user$/.test(ctx.pathname)) return null;
  const owner = store.owner();
  if (!owner) return null;
  return {
    handler: 'user',
    body: {
      user: {
        ...memberEntry(owner),
        teams: [
          {
            id: store.workspaceId(),
            name: (store.workspace()?.name as string) ?? 'Workspace',
            color: (store.workspace()?.color as string) ?? '#40BC86',
            members: store.members().map((m) => ({ user: memberEntry(m) })),
          },
        ],
      },
    },
  };
};

/** GET /v3-user/experience/{ws}/users */
export const v3UsersHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/v3-user\/experience\/\d+\/users$/.test(ctx.pathname)) return null;
  return {
    handler: 'v3Users',
    body: { users: store.members().map((m) => memberEntry(m)) },
  };
};

/** GET /user/v1/team/{ws}/member */
export const teamMemberHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/user\/v1\/team\/\d+\/member$/.test(ctx.pathname)) return null;
  return {
    handler: 'teamMember',
    body: { members: store.members().map((m) => ({ user: memberEntry(m) })) },
  };
};

/** GET /user/v1/team/{ws}/group */
export const teamGroupHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/user\/v1\/team\/\d+\/group$/.test(ctx.pathname)) return null;
  return { handler: 'teamGroup', body: { groups: [] } };
};

// ---------------------------------------------------------------------------
// Custom fields.
// ---------------------------------------------------------------------------

/** GET /customFields/v1/team/{ws}/fields */
export const customFieldsHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/customFields\/v1\/team\/\d+\/fields$/.test(ctx.pathname)) {
    return null;
  }
  // Aggregate unique field defs across all lists.
  const seen = new Set<string>();
  const fields: unknown[] = [];
  for (const list of store.lists()) {
    for (const f of store.customFieldsForList(list.id)) {
      const id = (f as { id?: string }).id;
      if (id && !seen.has(id)) {
        seen.add(id);
        fields.push(f);
      }
    }
  }
  return { handler: 'customFields', body: { fields } };
};

/** GET /customFields/v2/team/{ws}/fields/taskStatuses */
export const taskStatusesHandler: Handler = (ctx) => {
  if (
    ctx.method !== 'GET' ||
    !/\/customFields\/v2\/team\/\d+\/fields\/taskStatuses/.test(ctx.pathname)
  ) {
    return null;
  }
  return { handler: 'taskStatuses', body: { fields: [] } };
};

/** GET /tasks/v1/{ws}/customItems */
export const customItemsHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/tasks\/v1\/\d+\/customItems/.test(ctx.pathname)) return null;
  return { handler: 'customItems', body: { custom_items: [] } };
};

// ---------------------------------------------------------------------------
// Bootstrap / workspace / counters.
// ---------------------------------------------------------------------------

/** GET /workspace-v3/experience/bootstrap/{ws}
 *  Rich bootstrap shape: workspace identity + a non-degenerate body so init does
 *  not stall. The `{ff:{}}` stub previously stalled the bundle's boot. */
export const bootstrapHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/workspace-v3\/experience\/bootstrap\/\d+/.test(ctx.pathname)) {
    return null;
  }
  const ws = store.workspace();
  return {
    handler: 'bootstrap',
    body: {
      workspace_id: store.workspaceId(),
      workspace_name: (ws?.name as string) ?? 'Workspace',
      workspace_color: (ws?.color as string) ?? '#40BC86',
      workspace_avatar: (ws?.avatar as unknown) ?? null,
      spaces: store.spaces().map((s) => ({ id: s.id, name: s.name })),
      ff: {},
    },
  };
};

/** GET /workspace-v3/core/workspace/{ws} */
export const workspaceCoreHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET' || !/\/workspace-v3\/core\/workspace\/\d+/.test(ctx.pathname)) {
    return null;
  }
  const ws = store.workspace();
  return {
    handler: 'workspaceCore',
    body: {
      id: store.workspaceId(),
      name: (ws?.name as string) ?? 'Workspace',
      color: (ws?.color as string) ?? '#40BC86',
      avatar: (ws?.avatar as unknown) ?? null,
      members: store.members().map((m) => ({ user: memberEntry(m) })),
    },
  };
};

/** GET /data/v3/workspaces/{ws}/badging/badge_count */
export const badgeCountHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/data\/v3\/workspaces\/\d+\/badging\/badge_count/.test(ctx.pathname)) {
    return null;
  }
  return { handler: 'badgeCount', body: { count: 0 } };
};

/** GET /home/user/{userId}/lineup */
export const lineupHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/home\/user\/\d+\/lineup/.test(ctx.pathname)) return null;
  return { handler: 'lineup', body: { lineup: [], ids: [] } };
};

/** POST /inbox/v3/workspaces/{ws}/notifications/bundles/search */
export const inboxSearchHandler: Handler = (ctx) => {
  if (
    ctx.method !== 'POST' ||
    !/\/inbox\/v3\/workspaces\/\d+\/notifications\/bundles\/search/.test(ctx.pathname)
  ) {
    return null;
  }
  return { handler: 'inboxSearch', body: { bundles: [], last_page: true } };
};

/** POST /inbox/v3/workspaces/{ws}/notifications/bundles/stats/fetch */
export const inboxStatsHandler: Handler = (ctx) => {
  if (
    ctx.method !== 'POST' ||
    !/\/inbox\/v3\/workspaces\/\d+\/notifications\/bundles\/stats\/fetch/.test(ctx.pathname)
  ) {
    return null;
  }
  return { handler: 'inboxStats', body: { stats: {} } };
};

// ---------------------------------------------------------------------------
// viz/v1/view synthesizer (closes the largest UNAVAILABLE gap).
// ---------------------------------------------------------------------------

/**
 * GET /viz/v1/view/{viewId} — synthesize the view body from a per-type template
 * + the catalog. A factory so the loaded synth assets are captured in a closure
 * (the generic Handler signature carries no place for them). GATED: returns null
 * unless the view is catalogued AND its type has a template, so the SW falls
 * back to the recording / empty-200 for anything uncovered (no regression).
 */
export function makeVizViewHandler(assets: ViewSynthAssets): Handler {
  return (ctx) => {
    if (ctx.method !== 'GET') return null;
    const m = ctx.pathname.match(/\/viz\/v1\/view\/([^/]+)\b/);
    if (!m) return null;
    const body = synthVizView(decodeURIComponent(m[1]), assets);
    if (!body) return null;
    return { handler: 'vizView', body };
  };
}

/** Ordered handler chain. List-render handlers first (highest value). */
export const HANDLERS: Handler[] = [
  subcategoryHandler,
  genericViewHandler,
  tasksBulkHandler,
  sidebarTreeHandler,
  projectHandler,
  projectFeaturesHandler,
  personalListHierarchyHandler,
  hierarchyExperienceHandler,
  userHandler,
  v3UsersHandler,
  teamMemberHandler,
  teamGroupHandler,
  customFieldsHandler,
  taskStatusesHandler,
  customItemsHandler,
  bootstrapHandler,
  workspaceCoreHandler,
  badgeCountHandler,
  lineupHandler,
  inboxSearchHandler,
  inboxStatsHandler,
];
