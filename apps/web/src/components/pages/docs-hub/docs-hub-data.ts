import { docUpdatedAt, type Doc } from '@/store/workspace/docs.slice';

/**
 * Docs hub table row. Derived from a live `Doc` in the docs store (the editable,
 * persisted source of truth) rather than the static export, so created / renamed
 * / deleted docs reflect immediately in the hub.
 */
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
  favorite: boolean;
}

export function docToRow(doc: Doc): DocHubRow {
  return {
    id: doc.id,
    name: doc.name,
    location: doc.location,
    emoji: doc.emoji,
    pageCount: doc.pages.length,
    updated: docUpdatedAt(doc),
    favorite: doc.favorite,
  };
}
