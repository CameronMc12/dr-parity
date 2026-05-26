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
import { mapCalendarView } from '../replay/bridge/map-calendar-view';
import { mapSubcategory } from '../replay/bridge/map-subcategory';
import { mapTasksBulk } from '../replay/bridge/map-tasks-bulk';
import type { ExportTask } from '../replay/bridge/load-export';
import { synthStatusesForList } from '../replay/bridge/synth-statuses';
import type { CapturedTemplates } from '../replay/bridge/extract-templates';
import type { BackendStore, StoreMember } from './store-types';
import { synthVizView, type ViewSynthAssets } from './view-synth';
import { synthDefaultViews } from './default-views-synth';
import {
  synthDocData,
  synthDocPages,
  synthDocVizView,
  type DocBulkTemplate,
} from './doc-synth';

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

/** ClickUp `parent.type` codes inside a genericView/view request body. */
const PARENT_TYPE_SPACE = 4;
const PARENT_TYPE_FOLDER = 5;
const PARENT_TYPE_LIST = 6;
/** View `type` code for a calendar view. */
const VIEW_TYPE_CALENDAR = 5;

type GenericViewRequest = {
  id?: string | number;
  type?: number;
  parent?: { id?: string | number; type?: number };
};

/**
 * Collect the export tasks in a view's scope. A list parent uses that list's tasks;
 * a folder/space parent aggregates the tasks of every list under it (resolved via
 * each list's `space.id` / `folder.id`).
 */
function tasksForParent(
  store: BackendStore,
  parentId: string,
  parentType: number | undefined,
): { listId: string; tasks: ExportTask[] } {
  if (parentType === PARENT_TYPE_FOLDER) {
    const lists = store.lists().filter((l) => l.folder?.id === parentId);
    return { listId: lists[0]?.id ?? parentId, tasks: lists.flatMap((l) => store.tasksByList(l.id)) };
  }
  if (parentType === PARENT_TYPE_SPACE) {
    const lists = store.lists().filter((l) => l.space?.id === parentId);
    return { listId: lists[0]?.id ?? parentId, tasks: lists.flatMap((l) => store.tasksByList(l.id)) };
  }
  // Default + explicit list parent.
  return { listId: parentId, tasks: store.tasksByList(parentId) };
}

/**
 * POST /view/v1/genericView. The request body names the view (`id` + `type`) and its
 * `parent` (id + type). A LIST view returns the list-shaped `list.divisions[].groups`
 * payload; a CALENDAR view (type 5) returns the calendar-shaped `calendar.groups`
 * payload — serving the list shape to a calendar makes the bundle throw
 * "We ran into some trouble when loading your view." A factory so the captured
 * calendar template is closed over; GATED so an unavailable calendar template falls
 * back to the list mapper (no regression).
 */
export function makeGenericViewHandler(
  calendarTemplate: Record<string, unknown> | null,
): Handler {
  return (ctx, store, templates) => {
    if (ctx.method !== 'POST' || !/\/view\/v1\/genericView/.test(ctx.pathname)) return null;
    const parsed = ctx.body as GenericViewRequest | null;
    const rawParentId = parsed?.parent?.id;
    if (rawParentId === undefined) return null;
    const parentId = String(rawParentId);
    const parentType = parsed?.parent?.type;

    // CALENDAR branch: a calendar-shaped body (typeNum 5) so the calendar hydrates.
    if (parsed?.type === VIEW_TYPE_CALENDAR && calendarTemplate) {
      const { tasks } = tasksForParent(store, parentId, parentType);
      const body = mapCalendarView(tasks, calendarTemplate as never);
      if (body) return { handler: 'genericView.calendar', body };
      // Calendar template missing/mismatched -> fall through to the list mapper.
    }

    // LIST branch (default): list-shaped divisions/groups.
    const { listId, tasks } = tasksForParent(store, parentId, parentType);
    const list = store.listById(listId);
    const statusSet = synthStatusesForList(listId, list, tasks);
    const body = mapGenericView(listId, list, tasks, statusSet, templates);
    if (!body) return null;
    return { handler: 'genericView', body };
  };
}

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

// ---------------------------------------------------------------------------
// View-collection synthesizers (close the view-ROUTE-RESOLUTION gap).
//
// The SPA resolves a /v/{type}/{viewId} route by ENUMERATING a location's views
// via two collection reads, then binds the target view from the returned views[]:
//   GET /viz/v1/default_views?parent_id={loc}&parent_type={t}
//   GET /viz/v1/view?parent_id={loc}&parent_type={t}&...   (collection, no id)
// Recordings answer both for the WRONG location with views:[] so the target view
// is never found and the route falls to the default list scaffold. These handlers
// populate views[] from the catalogue so the SPA finds + binds the target view and
// then fetches viz/v1/view/{id} (already synthesized). GATED: null unless the
// catalog has views for the requested parent, so uncovered locations fall back to
// the recording (no regression).
// ---------------------------------------------------------------------------

/** GET /viz/v1/default_views?parent_id={X}&parent_type={T} */
export function makeDefaultViewsHandler(
  assets: ViewSynthAssets,
  envelope: Record<string, unknown> | null,
): Handler {
  return (ctx) => {
    if (ctx.method !== 'GET' || !/\/viz\/v1\/default_views$/.test(ctx.pathname)) return null;
    const parentId = ctx.query.get('parent_id');
    if (!parentId) return null;
    const body = synthDefaultViews(parentId, assets, envelope);
    if (!body) return null;
    return { handler: 'defaultViews', body };
  };
}

/** GET /viz/v1/view?parent_id={X}&parent_type={T}&... (collection — no id segment) */
export function makeViewCollectionHandler(
  assets: ViewSynthAssets,
  envelope: Record<string, unknown> | null,
): Handler {
  return (ctx) => {
    if (ctx.method !== 'GET' || !/\/viz\/v1\/view$/.test(ctx.pathname)) return null;
    const parentId = ctx.query.get('parent_id');
    if (!parentId) return null;
    const body = synthDefaultViews(parentId, assets, envelope);
    if (!body) return null;
    return { handler: 'viewCollection', body };
  };
}

// ---------------------------------------------------------------------------
// Doc render chain (closes the docs UNAVAILABLE gap). Serves the deep-link doc
// chain from the owned export: doc metadata via docs/bulk, page content via
// docs/v1/view/{docId}/page. GATED: returns null unless the requested doc id is
// in the export, so unowned docs fall back to the recording / empty-200.
// ---------------------------------------------------------------------------

/**
 * POST /docs/v1/team/{ws}/docs/bulk  body { ids: [...] } -> { docs: [{ object_id,
 * status:'found', data:{...} }] }. The bundle's `getDoc` keeps only FOUND rows,
 * so a deep-link doc whose id we own renders; unowned ids are simply omitted.
 */
export function makeDocsBulkHandler(template: DocBulkTemplate): Handler {
  return (ctx, store) => {
    if (ctx.method !== 'POST' || !/\/docs\/v1\/team\/\d+\/docs\/bulk/.test(ctx.pathname)) return null;
    const ids = Array.isArray((ctx.body as { ids?: unknown[] })?.ids)
      ? (ctx.body as { ids: unknown[] }).ids.map(String)
      : [];
    if (ids.length === 0) return null;
    const docs: Record<string, unknown>[] = [];
    for (const id of ids) {
      const doc = store.docById(id);
      if (!doc) continue;
      const data = synthDocData(doc, store.docPages(id), template, store.workspaceId());
      if (data) docs.push({ object_id: id, status: 'found', data });
    }
    // GATED: only answer when we actually own at least one requested doc; else
    // null so the hub's recorded docs/bulk (the full list) is not shadowed.
    if (docs.length === 0) return null;
    return { handler: 'docsBulk', body: { docs } };
  };
}

/**
 * GET /docs/v1/view/{docId}/page -> { pages: [...] } with markdown content for
 * every page in the doc. This is the read that paints the doc body.
 */
export const docPagesHandler: Handler = (ctx, store) => {
  if (ctx.method !== 'GET') return null;
  const m = ctx.pathname.match(/\/docs\/v1\/view\/([^/]+)\/page$/);
  if (!m) return null;
  const docId = decodeURIComponent(m[1]);
  const body = synthDocPages(store.docPages(docId));
  if (!body) return null;
  return { handler: 'docPages', body };
};

/** GET /docs/v1/team/{ws}/docs/{docId} -> single doc (same data shape as bulk). */
export function makeDocSingleHandler(template: DocBulkTemplate): Handler {
  return (ctx, store) => {
    if (ctx.method !== 'GET') return null;
    const m = ctx.pathname.match(/\/docs\/v1\/team\/\d+\/docs\/([^/]+)$/);
    if (!m) return null;
    const docId = decodeURIComponent(m[1]);
    if (docId === 'bulk' || docId === 'search') return null;
    const doc = store.docById(docId);
    if (!doc) return null;
    const data = synthDocData(doc, store.docPages(docId), template, store.workspaceId());
    if (!data) return null;
    return { handler: 'docSingle', body: data };
  };
}

/** GET /docs/v1/page/{pageId}/lastViewed -> harmless ack so the chain proceeds. */
export const docLastViewedHandler: Handler = (ctx) => {
  if (ctx.method !== 'GET' || !/\/docs\/v1\/page\/[^/]+\/lastViewed$/.test(ctx.pathname)) return null;
  return { handler: 'docLastViewed', body: { ok: true } };
};

/**
 * GET /viz/v1/view/{docId} where {docId} is an OWNED doc -> a doc-type view so
 * the doc deep-link route proceeds into the doc body load instead of 404ing into
 * "This Doc is unavailable". Must be registered BEFORE the generic vizViewHandler
 * so an owned doc id is answered as a doc, not via the (catalog) view synth.
 * GATED: returns null unless the id matches an owned doc, so list/board/etc.
 * viz ids fall through to the generic handler exactly as before.
 */
export function makeDocVizViewHandler(docViewTemplate: Record<string, unknown> | null): Handler {
  return (ctx, store) => {
    if (ctx.method !== 'GET') return null;
    const m = ctx.pathname.match(/\/viz\/v1\/view\/([^/]+)$/);
    if (!m) return null;
    const id = decodeURIComponent(m[1]);
    const doc = store.docById(id);
    if (!doc) return null;
    const body = synthDocVizView(doc, docViewTemplate, store.workspaceId());
    if (!body) return null;
    return { handler: 'docVizView', body };
  };
}

/** Ordered handler chain. List-render handlers first (highest value). */
export const HANDLERS: Handler[] = [
  subcategoryHandler,
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
  docPagesHandler,
  docLastViewedHandler,
];
