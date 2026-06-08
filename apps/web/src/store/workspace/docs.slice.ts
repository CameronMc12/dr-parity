'use client';

/**
 * Docs store. The editable, persisted source of truth for the Docs experience
 * (hub cards, sidebar tree, single-doc view). Seeded from the static research
 * export (`doc-pages.json` for page bodies + `docs-tree.json` for metadata),
 * then mutated locally for create/rename/delete/edit and persisted to
 * localStorage under its own key.
 *
 * This is a STANDALONE Zustand store (not a slice of the workspace store) so it
 * can be added without touching the workspace store wiring. Reads are exposed
 * via small selector hooks at the bottom of the file.
 *
 * SSR note: persist runs with skipHydration; the DocsHydrator component (mounted
 * by the docs surfaces) rehydrates on the client to avoid hydration mismatches.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import docPagesJson from '@/data/doc-pages.json';
import { DOCS_TREE } from '@/data/docs-tree';

export const DOCS_STORAGE_KEY = 'parity-docs-v1';

export interface DocPage {
  id: string;
  name: string;
  /** Raw markdown body. May be empty for a blank page. */
  content: string;
  orderIndex: number;
  dateUpdated: number;
}

export interface Doc {
  id: string;
  name: string;
  /** Emoji avatar, or null for the default doc glyph. */
  emoji: string | null;
  /** Space/folder name shown in the hub Location column. */
  location: string;
  /** Pages, always sorted by orderIndex ascending. At least one page. */
  pages: DocPage[];
  favorite: boolean;
  /** Author member id (defaults to the seed current member). */
  authorId: string | null;
  /** Doc creation epoch ms. */
  createdAt: number;
}

interface RawPage {
  id: string;
  name: string;
  content: string;
  orderIndex: number;
  dateUpdated: number | null;
}

interface RawDoc {
  docId: string;
  name: string;
  pages: RawPage[];
}

const HANDBOOK_ID = '2kyr6013-2715';
const TREE_BY_ID = new Map(DOCS_TREE.map((d) => [d.id, d]));

function latestUpdated(pages: DocPage[]): number {
  return pages.reduce((max, p) => (p.dateUpdated > max ? p.dateUpdated : max), 0);
}

function seedDoc(raw: RawDoc): Doc {
  const tree = TREE_BY_ID.get(raw.docId);
  const pages: DocPage[] = raw.pages
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      content: p.content,
      orderIndex: p.orderIndex ?? i + 1,
      dateUpdated: p.dateUpdated ?? Date.now(),
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    id: raw.docId,
    name: raw.name,
    emoji: tree?.emoji ?? null,
    location: tree?.location ?? 'Everything',
    pages: pages.length > 0 ? pages : [blankPage(`${raw.docId}-p1`, raw.name)],
    favorite: false,
    authorId: null,
    createdAt: Date.now(),
  };
}

function seedDocs(): Doc[] {
  return (docPagesJson as RawDoc[]).map(seedDoc).sort((a, b) => {
    if (a.id === HANDBOOK_ID) return -1;
    if (b.id === HANDBOOK_ID) return 1;
    return latestUpdated(b.pages) - latestUpdated(a.pages);
  });
}

function blankPage(id: string, name = 'Untitled'): DocPage {
  return { id, name, content: '', orderIndex: 1, dateUpdated: Date.now() };
}

let idSeq = 0;
function freshId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

interface DocsState {
  docs: Doc[];

  // doc mutations
  createDoc: (init?: { name?: string; emoji?: string | null; location?: string }) => string;
  renameDoc: (docId: string, name: string) => void;
  setDocEmoji: (docId: string, emoji: string | null) => void;
  duplicateDoc: (docId: string) => string | null;
  deleteDoc: (docId: string) => void;
  toggleFavorite: (docId: string) => void;

  // page mutations
  createPage: (docId: string, init?: { name?: string; content?: string }) => string | null;
  renamePage: (docId: string, pageId: string, name: string) => void;
  setPageContent: (docId: string, pageId: string, content: string) => void;
  duplicatePage: (docId: string, pageId: string) => string | null;
  deletePage: (docId: string, pageId: string) => void;
}

function mapDoc(docs: Doc[], docId: string, fn: (doc: Doc) => Doc): Doc[] {
  return docs.map((d) => (d.id === docId ? fn(d) : d));
}

function touchPages(pages: DocPage[]): DocPage[] {
  return pages.map((p, i) => ({ ...p, orderIndex: i + 1 }));
}

export const useDocsStore = create<DocsState>()(
  persist(
    (set, get) => ({
      docs: seedDocs(),

      createDoc: (init) => {
        const id = freshId('doc');
        const pageId = freshId('pg');
        const name = init?.name ?? 'Untitled';
        const doc: Doc = {
          id,
          name,
          emoji: init?.emoji ?? null,
          location: init?.location ?? 'Everything',
          pages: [blankPage(pageId, name)],
          favorite: false,
          authorId: null,
          createdAt: Date.now(),
        };
        set((s) => ({ docs: [doc, ...s.docs] }));
        return id;
      },

      renameDoc: (docId, name) =>
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => {
            // Keep the landing page name in sync when it mirrors the doc title.
            const pages = d.pages.map((p, i) =>
              i === 0 && p.name === d.name ? { ...p, name } : p,
            );
            return { ...d, name, pages };
          }),
        })),

      setDocEmoji: (docId, emoji) =>
        set((s) => ({ docs: mapDoc(s.docs, docId, (d) => ({ ...d, emoji })) })),

      toggleFavorite: (docId) =>
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => ({ ...d, favorite: !d.favorite })),
        })),

      duplicateDoc: (docId) => {
        const src = get().docs.find((d) => d.id === docId);
        if (!src) return null;
        const id = freshId('doc');
        const copy: Doc = {
          ...src,
          id,
          name: `${src.name} (copy)`,
          favorite: false,
          createdAt: Date.now(),
          pages: src.pages.map((p) => ({
            ...p,
            id: freshId('pg'),
            dateUpdated: Date.now(),
          })),
        };
        set((s) => ({ docs: [copy, ...s.docs] }));
        return id;
      },

      deleteDoc: (docId) =>
        set((s) => ({ docs: s.docs.filter((d) => d.id !== docId) })),

      createPage: (docId, init) => {
        if (!get().docs.some((d) => d.id === docId)) return null;
        const pageId = freshId('pg');
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => {
            const page: DocPage = {
              id: pageId,
              name: init?.name ?? `Untitled page`,
              content: init?.content ?? '',
              orderIndex: d.pages.length + 1,
              dateUpdated: Date.now(),
            };
            return { ...d, pages: [...d.pages, page] };
          }),
        }));
        return pageId;
      },

      renamePage: (docId, pageId, name) =>
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => ({
            ...d,
            pages: d.pages.map((p) =>
              p.id === pageId ? { ...p, name, dateUpdated: Date.now() } : p,
            ),
          })),
        })),

      setPageContent: (docId, pageId, content) =>
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => ({
            ...d,
            pages: d.pages.map((p) =>
              p.id === pageId ? { ...p, content, dateUpdated: Date.now() } : p,
            ),
          })),
        })),

      duplicatePage: (docId, pageId) => {
        const doc = get().docs.find((d) => d.id === docId);
        const src = doc?.pages.find((p) => p.id === pageId);
        if (!doc || !src) return null;
        const newId = freshId('pg');
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => ({
            ...d,
            pages: touchPages([
              ...d.pages,
              { ...src, id: newId, name: `${src.name} (copy)`, dateUpdated: Date.now() },
            ]),
          })),
        }));
        return newId;
      },

      deletePage: (docId, pageId) =>
        set((s) => ({
          docs: mapDoc(s.docs, docId, (d) => {
            // A doc must keep at least one page.
            if (d.pages.length <= 1) return d;
            return { ...d, pages: touchPages(d.pages.filter((p) => p.id !== pageId)) };
          }),
        })),
    }),
    {
      name: DOCS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 1,
    },
  ),
);

// ---- hydration -------------------------------------------------------------

let rehydrated = false;

/**
 * Rehydrate the persisted docs store once on the client. Mount via any docs
 * surface (DocsSidebar / DocsHub / DocView); the guard makes it idempotent so
 * mounting it in several places is safe.
 */
export function useDocsHydration(): void {
  useEffect(() => {
    if (rehydrated) return;
    rehydrated = true;
    void useDocsStore.persist.rehydrate();
  }, []);
}

// ---- selectors / hooks -----------------------------------------------------

export function useDocs(): Doc[] {
  return useDocsStore(useShallow((s) => s.docs));
}

export function useDoc(docId: string): Doc | null {
  return useDocsStore((s) => s.docs.find((d) => d.id === docId) ?? null);
}

export function useDocPage(docId: string, pageId?: string): DocPage | null {
  return useDocsStore((s) => {
    const doc = s.docs.find((d) => d.id === docId);
    if (!doc || doc.pages.length === 0) return null;
    if (!pageId) return doc.pages[0] ?? null;
    return doc.pages.find((p) => p.id === pageId) ?? doc.pages[0] ?? null;
  });
}

/** Last-updated epoch ms for a doc (max page dateUpdated). */
export function docUpdatedAt(doc: Doc): number {
  return latestUpdated(doc.pages);
}
