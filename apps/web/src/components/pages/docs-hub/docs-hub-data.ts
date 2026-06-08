import docPagesJson from '@/data/doc-pages.json';
import { DOCS_TREE } from '@/data/docs-tree';

/**
 * Docs hub table model. The source of truth for *which* docs exist is
 * `doc-pages.json` (13 docs, including the DR-PARITY-SEED Handbook), since that
 * is the same set the single-doc DocView reads. Location + emoji are enriched
 * from `docs-tree.json` where a matching row exists; `updated` is derived from
 * the latest page `dateUpdated`. Rows sort newest-first, with the Handbook
 * pinned to the top to mirror the oracle (All Docs, Date viewed ↓).
 */

interface RawPage {
  id: string;
  name: string;
  content: string;
  orderIndex: number;
  dateUpdated: number;
}

interface RawDoc {
  docId: string;
  name: string;
  pages: RawPage[];
}

export interface DocHubRow {
  /** Doc id — opens /<wsId>/v/dc/<id> in the single-doc DocView. */
  id: string;
  name: string;
  /** Space/folder name shown in the Location column. */
  location: string;
  /** Emoji avatar, or null for the default doc glyph. */
  emoji: string | null;
  pageCount: number;
  /** Last-updated epoch ms (max page dateUpdated). */
  updated: number;
}

const HANDBOOK_ID = '2kyr6013-2715';

const TREE_BY_ID = new Map(DOCS_TREE.map((d) => [d.id, d]));

function latestUpdated(pages: RawPage[]): number {
  return pages.reduce((max, p) => (p.dateUpdated > max ? p.dateUpdated : max), 0);
}

function toRow(doc: RawDoc): DocHubRow {
  const tree = TREE_BY_ID.get(doc.docId);
  return {
    id: doc.docId,
    name: doc.name,
    location: tree?.location ?? 'Everything',
    emoji: tree?.emoji ?? null,
    pageCount: doc.pages.length,
    updated: latestUpdated(doc.pages),
  };
}

export const DOC_HUB_ROWS: DocHubRow[] = (docPagesJson as RawDoc[])
  .map(toRow)
  .sort((a, b) => {
    if (a.id === HANDBOOK_ID) return -1;
    if (b.id === HANDBOOK_ID) return 1;
    return b.updated - a.updated;
  });
