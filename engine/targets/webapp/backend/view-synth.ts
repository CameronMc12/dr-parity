/**
 * viz/v1/view synthesizer for the OWNED ClickUp replay backend.
 *
 * The replay only ever recorded a handful of `viz/v1/view/{viewId}` bodies, so
 * every other view route 404s and the SPA renders "page is unavailable". This
 * module closes that gap deterministically: it loads a per-TYPE structural
 * TEMPLATE (a REAL captured `{ view: {...} }` body, one per view type) plus a
 * complete view CATALOG (viewId -> type + parent, enumerated from the public
 * API), and synthesizes a correct `viz/v1/view/{viewId}` response for ANY
 * catalogued view whose type has a template.
 *
 * It is intentionally NARROW and GATED: `synthVizView` returns null unless the
 * requested view id is in the catalog AND a template exists for its type. A null
 * means "not mine" so the SW falls back to the recording / empty-200 — nothing
 * that previously worked can regress.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG_FILE = 'view-catalog.json';
const TEMPLATES_DIR = 'view-templates';

/** ClickUp parent.type codes used inside the view object. */
const PARENT_TYPE: Record<string, number> = { space: 4, folder: 5, list: 6, team: 7 };

/** Catalog entry: the minimum needed to repopulate a template for this view. */
export type ViewCatalogEntry = {
  id: string;
  typeName: string;
  typeNum: number | null;
  name: string;
  parentId: string;
  parentKind: string;
  visibility?: string;
};

export type ViewCatalog = {
  generatedAt?: string;
  teamId: string;
  views: Record<string, ViewCatalogEntry>;
};

/** Loaded synthesizer assets: the catalog + one template per type that has one. */
export type ViewSynthAssets = {
  catalog: ViewCatalog | null;
  /** typeName -> the captured `{ view: {...} }` body (deep-cloned per request). */
  templates: Record<string, Record<string, unknown>>;
};

const EMPTY_ASSETS: ViewSynthAssets = { catalog: null, templates: {} };

let cached: ViewSynthAssets | null = null;

/** Load the catalog + per-type templates from the backend dir. Cached once. */
export function loadViewSynthAssets(backendDir: string): ViewSynthAssets {
  if (cached) return cached;
  const catalogPath = join(backendDir, CATALOG_FILE);
  const templatesDir = join(backendDir, TEMPLATES_DIR);

  let catalog: ViewCatalog | null = null;
  if (existsSync(catalogPath)) {
    try {
      catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as ViewCatalog;
    } catch {
      catalog = null;
    }
  }

  const templates: Record<string, Record<string, unknown>> = {};
  if (existsSync(templatesDir)) {
    for (const file of readdirSync(templatesDir)) {
      if (!file.endsWith('.json')) continue;
      const typeName = file.slice(0, -'.json'.length);
      try {
        const raw = JSON.parse(readFileSync(join(templatesDir, file), 'utf8')) as unknown;
        const view = (raw as { view?: unknown }).view ?? raw;
        if (view && typeof view === 'object') {
          templates[typeName] = view as Record<string, unknown>;
        }
      } catch {
        /* skip unparseable template */
      }
    }
  }

  cached = { catalog, templates };
  return cached;
}

/** Reset the cache (tests / re-seed). */
export function resetViewSynthCache(): void {
  cached = null;
}

/** Deep clone via structuredClone when available, else JSON round-trip. */
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Synthesize a `viz/v1/view/{viewId}` body for a catalogued view. Returns the
 * full `{ view: {...} }` shape with the template's structure but THIS view's
 * id/parent/name/type, or null when the view is not catalogued or its type has
 * no template (so the caller falls back to recordings — no regression).
 */
export function synthVizView(
  viewId: string,
  assets: ViewSynthAssets,
): Record<string, unknown> | null {
  if (!assets.catalog) return null;
  const entry = assets.catalog.views[viewId];
  if (!entry) return null;
  const template = assets.templates[entry.typeName];
  if (!template) return null;

  const view = deepClone(template);
  const parentTypeNum = PARENT_TYPE[entry.parentKind] ?? (view.parent as { type?: number })?.type ?? 6;

  view.id = entry.id;
  view.name = entry.name;
  if (entry.typeNum != null) view.type = entry.typeNum;
  view.parent = { id: entry.parentId, type: parentTypeNum };
  view.parent_id_text = entry.parentId;
  if (typeof view.parent_id_bigint !== 'undefined') view.parent_id_bigint = entry.parentId;
  view.team_id = Number(assets.catalog.teamId) || assets.catalog.teamId;
  if (entry.visibility) view.visibility = entry.visibility;

  return { view };
}

/** Returns the set of typeNames that currently have a template. */
export function templatedTypes(assets: ViewSynthAssets): string[] {
  return Object.keys(assets.templates).sort();
}

export { EMPTY_ASSETS };
