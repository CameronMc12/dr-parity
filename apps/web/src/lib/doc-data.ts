/**
 * Read-only doc body content for the Doc view. The sidebar metadata lives in
 * `data/docs-tree.json` (DocNode), but the actual page bodies were never wired
 * into the app — they sit in the research export. `data/doc-pages.json` is the
 * imported, trimmed copy of that export (markdown strings per page).
 *
 * Content format is MARKDOWN (not Quill/Codox delta, not HTML). 7 of 12 pages
 * carry non-empty content; the rest are intentionally empty pages in the source
 * doc and render as empty bodies.
 */

import docPagesJson from '@/data/doc-pages.json';

export interface DocPage {
  id: string;
  name: string;
  /** Raw markdown body. May be an empty string for blank pages. */
  content: string;
  orderIndex: number;
  dateUpdated: number | null;
}

export interface DocPages {
  docId: string;
  name: string;
  /** Pages pre-sorted by orderIndex ascending. */
  pages: DocPage[];
}

const DOC_PAGES = docPagesJson as DocPages[];

/** All docs that have page bodies available. */
export function allDocPages(): DocPages[] {
  return DOC_PAGES;
}

/** Page bodies for a doc id, or null when the doc has no imported content. */
export function getDocPages(docId: string): DocPages | null {
  return DOC_PAGES.find((d) => d.docId === docId) ?? null;
}

/**
 * Resolve a single page within a doc. Falls back to the first page when no
 * pageId is supplied or the id is unknown, so `/v/dc/:docId` (no page) renders
 * the doc's landing page.
 */
export function getDocPage(docId: string, pageId?: string): DocPage | null {
  const doc = getDocPages(docId);
  if (!doc || doc.pages.length === 0) return null;
  if (!pageId) return doc.pages[0] ?? null;
  return doc.pages.find((p) => p.id === pageId) ?? doc.pages[0] ?? null;
}
