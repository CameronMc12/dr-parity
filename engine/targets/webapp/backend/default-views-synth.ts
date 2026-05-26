/**
 * viz/v1/default_views + viz/v1/view (collection) synthesizer for the OWNED
 * ClickUp replay backend.
 *
 * ROOT CAUSE this closes (confirmed by live Playwright probe):
 * The SPA resolves a /v/{type}/{viewId} route by ENUMERATING the views of a
 * location, not by fetching the view directly. For every view route it fires:
 *   GET /viz/v1/default_views?parent_id={loc}&parent_type={t}
 *   GET /viz/v1/view?parent_id={loc}&parent_type={t}&exclude_types=...   (collection)
 * Both are COLLECTION reads whose `views[]` must contain the target view so the
 * SPA can bind the view to its location and mount the target context (breadcrumb
 * + pane). In recordings-only mode both come from a single captured recording for
 * the WRONG location (901523543284) with `views: []`, so the target view id is
 * never found and the SPA falls back to the default list-view scaffold
 * ("Cameron Mc's Workspace" Channel-home). The backend already serves the per-view
 * `viz/v1/view/{id}` body correctly, but it is never reached for binding because
 * the location's view collection is empty.
 *
 * This module synthesizes both COLLECTION responses from the view CATALOG: given a
 * `parent_id` (a real location OR a view id used as a fallback parent), it returns
 * the catalogued views for that location inside `views[]`, each a full view object
 * cloned from the per-type template (so the SPA finds + binds the target view).
 *
 * GATED + ADDITIVE: returns null unless the catalog has at least one view for the
 * resolved parent, so any uncovered location falls back to the recording / empty-200
 * exactly as before (no regression).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ViewCatalog, ViewCatalogEntry, ViewSynthAssets } from './view-synth';

const ENVELOPE_FILE = 'view-templates/_default_views_envelope.json';

/** ClickUp parent.type codes. */
const PARENT_TYPE: Record<string, number> = { space: 4, folder: 5, list: 6, team: 7 };

/**
 * Catalog typeName -> standard_views slot key. STANDARD view types are read by the
 * SPA from `standard_views[key]` (not `views[]`); the /v/t/, /v/g/ etc. routes
 * resolve their active view from this slot. Custom types (clickboard, conversation,
 * doc, form, embed, location_overview) have no standard slot and live only in views[].
 */
const STANDARD_SLOT: Record<string, string> = {
  list: 'list',
  board: 'board',
  calendar: 'calendar',
  gantt: 'gantt_type',
  table: 'table',
  timeline: 'timeline',
  dashboard: 'dashboard',
};

type Envelope = Record<string, unknown> & {
  views?: unknown[];
  standard_views?: Record<string, unknown>;
};

let cachedEnvelope: Envelope | null = null;
let envelopeLoaded = false;

/** Load the captured default_views envelope once (cloned per request). */
export function loadDefaultViewsEnvelope(backendDir: string): Envelope | null {
  if (envelopeLoaded) return cachedEnvelope;
  envelopeLoaded = true;
  const path = join(backendDir, ENVELOPE_FILE);
  if (!existsSync(path)) {
    cachedEnvelope = null;
    return null;
  }
  try {
    cachedEnvelope = JSON.parse(readFileSync(path, 'utf8')) as Envelope;
  } catch {
    cachedEnvelope = null;
  }
  return cachedEnvelope;
}

/** Reset caches (tests / re-seed). */
export function resetDefaultViewsCache(): void {
  cachedEnvelope = null;
  envelopeLoaded = false;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Resolve the parent location for a default_views / collection request. The SPA
 * sometimes passes the VIEW id itself as parent_id (with parent_type 7) when it
 * cannot resolve the view's real location up front. In that case look the id up in
 * the catalog and substitute the view's REAL parent so the location's full view
 * set (including this view) is returned.
 */
function resolveParent(
  catalog: ViewCatalog,
  rawParentId: string,
): { parentId: string; parentKind: string } | null {
  // Direct location match: any catalogued view whose parent is rawParentId.
  for (const v of Object.values(catalog.views)) {
    if (v.parentId === rawParentId) return { parentId: v.parentId, parentKind: v.parentKind };
  }
  // Fallback: rawParentId is itself a view id -> use that view's real parent.
  const asView = catalog.views[rawParentId];
  if (asView) return { parentId: asView.parentId, parentKind: asView.parentKind };
  return null;
}

/** All catalogued views for a given parent location id. */
function viewsForParent(catalog: ViewCatalog, parentId: string): ViewCatalogEntry[] {
  return Object.values(catalog.views).filter((v) => v.parentId === parentId);
}

/**
 * Build one full view object for a catalogued entry by cloning the per-type
 * template (or the envelope's `list` view as a fallback shape) and stamping this
 * view's id / name / type / parent.
 */
function buildViewObject(
  entry: ViewCatalogEntry,
  assets: ViewSynthAssets,
  fallbackShape: Record<string, unknown>,
  teamId: string,
): Record<string, unknown> {
  const template = assets.templates[entry.typeName] ?? fallbackShape;
  const view = deepClone(template) as Record<string, unknown>;
  const parentTypeNum = PARENT_TYPE[entry.parentKind] ?? 6;

  view.id = entry.id;
  view.name = entry.name;
  if (entry.typeNum != null) view.type = entry.typeNum;
  view.parent = { id: entry.parentId, type: parentTypeNum };
  view.parent_id_text = entry.parentId;
  if (typeof view.parent_id_bigint !== 'undefined') view.parent_id_bigint = entry.parentId;
  view.team_id = Number(teamId) || teamId;
  if (entry.visibility) view.visibility = entry.visibility;
  view.standard = false;
  view.deleted = false;
  return view;
}

/**
 * Synthesize a default_views OR viz/v1/view collection body for `rawParentId`.
 * Returns the cloned envelope with `views[]` populated from the catalogue, or null
 * when the catalog has no views for the resolved parent (caller falls back to the
 * recording — no regression).
 */
export function synthDefaultViews(
  rawParentId: string,
  assets: ViewSynthAssets,
  envelope: Envelope | null,
): Record<string, unknown> | null {
  if (!assets.catalog || !envelope) return null;
  const resolved = resolveParent(assets.catalog, rawParentId);
  if (!resolved) return null;

  const entries = viewsForParent(assets.catalog, resolved.parentId);
  if (entries.length === 0) return null;

  const body = deepClone(envelope);
  const teamId = assets.catalog.teamId;
  // The envelope's `list` standard_view is the most complete view-object shape;
  // use it as the fallback when a type has no dedicated template.
  const fallbackShape =
    (body.standard_views?.list as Record<string, unknown>) ??
    (body.standard_views?.board as Record<string, unknown>) ??
    {};

  const builtById = new Map<string, Record<string, unknown>>();
  body.views = entries.map((e) => {
    const obj = buildViewObject(e, assets, fallbackShape, teamId);
    builtById.set(e.id, obj);
    // STANDARD types are read from standard_views[slot]; populate the slot with this
    // catalogued view so the /v/{type}/{viewId} route resolves its active view. (The
    // last standard view of a given type wins; one per location is the norm.)
    const slot = STANDARD_SLOT[e.typeName];
    if (slot && body.standard_views) body.standard_views[slot] = obj;
    return obj;
  });

  // When the request keyed off a VIEW id (route resolution), name that view the
  // default so the SPA mounts IT rather than the location's default list view.
  const requested = assets.catalog.views[rawParentId];
  if (requested && builtById.has(requested.id)) {
    body.default_view = builtById.get(requested.id);
  }

  body.last_page = true;
  return body;
}
