/**
 * Doc render-chain synthesizer for the OWNED ClickUp replay backend.
 *
 * Opening a doc by deep-link fires a render chain the crawl never recorded:
 *   - POST /docs/v1/team/{ws}/docs/bulk  { ids:[docId] }  -> doc metadata
 *   - GET  /docs/v1/view/{docId}/page                     -> pages WITH content
 * Both 404 in the recordings, so every doc shows "page is unavailable". This
 * module closes that gap from OWNED export data (`docs.json` + `doc-pages.json`):
 * it overlays each export doc's id/name/parent onto a REAL captured doc-bulk
 * `data` template, and emits the pages array (with markdown content) in the shape
 * the bundle's page reader (`ce$5`) consumes.
 *
 * GATED: every synth returns null/empty unless the requested doc id is present in
 * the export, so the SW falls back to the recording / empty-200 for anything we
 * do not own — nothing that previously worked can regress.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { StoreDoc, StoreDocPages } from './store-types';

const TEMPLATE_FILE = join('doc-templates', 'doc-bulk.json');

/** Fallback doc viz `type` when the template lacks one (real captured docs use 9). */
const DOC_VIEW_TYPE = 9;

/** The captured doc-bulk `data` object used as a structural template. */
export type DocBulkTemplate = Record<string, unknown> | null;

let cachedTemplate: DocBulkTemplate = null;
let templateLoaded = false;

/** Load the captured doc-bulk template once. Returns null when absent. */
export function loadDocBulkTemplate(backendDir: string): DocBulkTemplate {
  if (templateLoaded) return cachedTemplate;
  templateLoaded = true;
  const path = join(backendDir, TEMPLATE_FILE);
  if (!existsSync(path)) {
    cachedTemplate = null;
    return null;
  }
  try {
    cachedTemplate = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    cachedTemplate = null;
  }
  return cachedTemplate;
}

const DOC_VIEW_TEMPLATE_FILE = join('view-templates', 'doc.json');
let cachedDocView: Record<string, unknown> | null = null;
let docViewLoaded = false;

/** Load the doc-TYPE viz view template (`view-templates/doc.json`). */
export function loadDocViewTemplate(backendDir: string): Record<string, unknown> | null {
  if (docViewLoaded) return cachedDocView;
  docViewLoaded = true;
  const path = join(backendDir, DOC_VIEW_TEMPLATE_FILE);
  if (!existsSync(path)) {
    cachedDocView = null;
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { view?: Record<string, unknown> };
    cachedDocView = (raw.view ?? raw) as Record<string, unknown>;
  } catch {
    cachedDocView = null;
  }
  return cachedDocView;
}

/** Reset the template cache (tests / re-seed). */
export function resetDocSynthCache(): void {
  cachedTemplate = null;
  templateLoaded = false;
  cachedDocView = null;
  docViewLoaded = false;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Synthesize the `data` object for one doc in a docs/bulk response. Overlays the
 * export doc's identity (id/name/parent/type) and its page ids onto the captured
 * template so the bundle's doc model is well-shaped. Returns null when the export
 * doc is missing (caller skips it -> the bundle marks it not-found, no crash).
 */
export function synthDocData(
  doc: StoreDoc,
  pages: StoreDocPages | undefined,
  template: DocBulkTemplate,
  workspaceId: string,
): Record<string, unknown> | null {
  if (!doc?.id) return null;
  const base = template ? deepClone(template) : ({} as Record<string, unknown>);

  base.id = doc.id;
  base.name = doc.name ?? (base.name as string) ?? 'Untitled';
  if (doc.parent) {
    const parentId = doc.parent.id != null ? String(doc.parent.id) : (base.parent as { id?: string })?.id;
    const parentType = doc.parent.type != null ? String(doc.parent.type) : (base.parent as { type?: string })?.type;
    base.parent = { id: parentId, type: parentType };
  }
  if (typeof doc.date_created !== 'undefined') base.date_created = String(doc.date_created);
  if (typeof doc.date_updated !== 'undefined') base.view_date_updated = String(doc.date_updated);

  const pageIds = (pages?.pages ?? []).map((p) => p.id).filter(Boolean) as string[];
  if (pageIds.length > 0) {
    base.pages = pageIds;
    base.last_page = pageIds[0];
    base.last_viewed_page = pageIds[0];
    const settings = (base.doc_settings as Record<string, unknown>) ?? {};
    settings.last_page = pageIds[0];
    settings.workspace_id = workspaceId;
    base.doc_settings = settings;
  }
  base.archived = doc.deleted === true ? true : false;
  return base;
}

/**
 * Synthesize a doc-TYPE `viz/v1/view/{docId}` body for an owned doc. The doc
 * deep-link route fetches `viz/v1/view/{docId}` FIRST; without a doc-type view it
 * 404s and the bundle shows "This Doc is unavailable" before the doc chain runs.
 *
 * The template is a REAL captured doc-type viz body (`view.type === 9`). Type 9 is
 * what routes the bundle into the ProseMirror doc editor; the earlier hardcoded
 * type 12 routed it into a list/view shell instead. We PRESERVE the template's
 * type and overlay only the per-doc identity, mirroring the real capture (parent
 * carries the export's string type code, not a remapped numeric).
 */
export function synthDocVizView(
  doc: StoreDoc | undefined,
  docViewTemplate: Record<string, unknown> | null,
  workspaceId: string,
): Record<string, unknown> | null {
  if (!doc?.id || !docViewTemplate) return null;
  const view = deepClone(docViewTemplate);
  const parentId = doc.parent?.id != null ? String(doc.parent.id) : workspaceId;
  const parentType = doc.parent?.type != null ? String(doc.parent.type) : '5';

  view.id = doc.id;
  view.name = doc.name ?? 'Untitled';
  if (typeof view.type !== 'number') view.type = DOC_VIEW_TYPE;
  view.parent = { id: parentId, type: parentType };
  view.parent_id_text = parentId;
  if (typeof view.parent_id_bigint !== 'undefined') view.parent_id_bigint = parentId;
  view.team_id = Number(workspaceId) || workspaceId;
  if (typeof doc.date_created !== 'undefined') view.date_created = String(doc.date_created);
  if (typeof doc.date_updated !== 'undefined') view.date_updated = String(doc.date_updated);
  return { view };
}

/**
 * Build a `/docs/v1/view/{docId}/page` response: `{ pages: [...] }` where each
 * page carries the markdown content + the fields the bundle's page reader needs.
 * Returns null when the doc has no owned pages, so the caller falls through.
 */
export function synthDocPages(
  pages: StoreDocPages | undefined,
): { pages: Record<string, unknown>[] } | null {
  if (!pages?.pages || pages.pages.length === 0) return null;
  const out = pages.pages.map((p) => formatPage(p, pages.docId));
  return { pages: out };
}

/** Normalize one export page row into the page DTO the bundle consumes. */
function formatPage(p: Record<string, unknown> & { id: string }, docId: string): Record<string, unknown> {
  const creatorId = (p.creator_id as number | undefined) ?? (p.creator as number | undefined) ?? null;
  const authors = Array.isArray(p.authors) ? p.authors : creatorId != null ? [creatorId] : [];
  return {
    id: p.id,
    doc_id: (p.doc_id as string) ?? docId,
    workspace_id: p.workspace_id ?? null,
    name: (p.name as string) ?? 'Untitled',
    content: (p.content as string) ?? '',
    content_format: 'text/md',
    order_index: (p.order_index as number) ?? 0,
    parent_page_id: (p.parent_page_id as string) ?? null,
    sub_title: (p.sub_title as string) ?? null,
    presentation_details: p.presentation_details ?? { show_subtitle_header: false },
    avatar: p.avatar ?? null,
    creator: creatorId,
    authors,
    contributors: Array.isArray(p.contributors) ? p.contributors : [],
    date_created: p.date_created != null ? String(p.date_created) : '',
    date_updated: p.date_updated != null ? String(p.date_updated) : '',
    date_edited: p.date_edited != null ? String(p.date_edited) : '',
    edited_by: (p.edited_by as number | undefined) ?? creatorId,
    deleted: p.deleted === true,
    archived: p.archived === true,
    protected: p.protected === true,
  };
}
