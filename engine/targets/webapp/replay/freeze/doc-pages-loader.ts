/**
 * Doc-pages loader + emitter (build-time).
 *
 * Reads the captured ClickUp doc export (`doc-pages.json`) and transforms its
 * verbose per-doc/per-page schema into a compact lookup index keyed by docId
 * and pageId, then writes `<cloneDir>/replay/doc-pages.json` so the in-page
 * doc-freezer shim can resolve markdown content with one fetch + two map
 * lookups.
 *
 * Source schema (verbose, per the export):
 *   [{ docId, name, pages: [{ id, name, content, doc_id, ... }] }, ...]
 *
 * Emitted schema (compact lookup):
 *   {
 *     <docId>: {
 *       name: "<doc title>",
 *       pages: { <pageId>: { name, content } }
 *     }
 *   }
 *
 * Pages whose `content` is an empty string are still indexed (the shim can
 * decide to render an empty editor), but a `null` / missing content drops the
 * page entry so the shim falls through cleanly.
 *
 * Pure read/write — no other side effects. Mirrors the architecture of
 * `view-template-emitter.ts` from the view-synth iteration.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** One page entry in the COMPACT emitted index. */
export type CompactDocPage = {
  name: string;
  content: string;
};

/** One doc entry in the COMPACT emitted index. */
export type CompactDocEntry = {
  name: string;
  pages: Record<string, CompactDocPage>;
};

/** The compact index emitted to `<cloneDir>/replay/doc-pages.json`. */
export type CompactDocIndex = Record<string, CompactDocEntry>;

/** Counters reported by the loader for build-log telemetry. */
export type DocPagesLoadResult = {
  index: CompactDocIndex;
  docCount: number;
  pageCount: number;
  totalContentBytes: number;
  emptyPageCount: number;
};

type SourcePage = {
  id?: string;
  name?: string;
  content?: string | null;
};

type SourceDoc = {
  docId?: string;
  name?: string;
  pages?: SourcePage[];
};

/**
 * Load the source export and transform it into the compact lookup index.
 * Returns an empty index (and zeroed counters) when the source file is
 * missing or unreadable — callers can then skip emission silently.
 */
export function loadDocPages(sourcePath: string): DocPagesLoadResult {
  let raw: string;
  try {
    raw = readFileSync(sourcePath, 'utf8');
  } catch {
    return { index: {}, docCount: 0, pageCount: 0, totalContentBytes: 0, emptyPageCount: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { index: {}, docCount: 0, pageCount: 0, totalContentBytes: 0, emptyPageCount: 0 };
  }
  if (!Array.isArray(parsed)) {
    return { index: {}, docCount: 0, pageCount: 0, totalContentBytes: 0, emptyPageCount: 0 };
  }

  const index: CompactDocIndex = {};
  let pageCount = 0;
  let totalContentBytes = 0;
  let emptyPageCount = 0;

  for (const entry of parsed as SourceDoc[]) {
    const docId = entry?.docId;
    if (!docId || typeof docId !== 'string') continue;

    const pages: Record<string, CompactDocPage> = {};
    for (const page of entry.pages ?? []) {
      const pageId = page?.id;
      if (!pageId || typeof pageId !== 'string') continue;
      if (page.content === null || page.content === undefined) continue;

      const content = String(page.content);
      pages[pageId] = {
        name: typeof page.name === 'string' ? page.name : '',
        content,
      };
      pageCount++;
      totalContentBytes += content.length;
      if (content.length === 0) emptyPageCount++;
    }

    index[docId] = {
      name: typeof entry.name === 'string' ? entry.name : '',
      pages,
    };
  }

  return {
    index,
    docCount: Object.keys(index).length,
    pageCount,
    totalContentBytes,
    emptyPageCount,
  };
}

/**
 * Emit the compact doc-pages index to `<cloneOutputDir>/replay/doc-pages.json`.
 * No-op when `index` is empty so empty profiles never write a stub file.
 */
export function emitDocPages(index: CompactDocIndex, cloneOutputDir: string): string | null {
  if (Object.keys(index).length === 0) return null;
  const outPath = join(cloneOutputDir, 'replay', 'doc-pages.json');
  mkdirSync(dirname(outPath), { recursive: true });
  // Compact JSON (no pretty-print) — this file is fetched at page load.
  writeFileSync(outPath, JSON.stringify(index), 'utf8');
  return outPath;
}
