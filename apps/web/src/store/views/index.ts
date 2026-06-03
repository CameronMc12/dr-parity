/**
 * Per-list views store. Persists, per listId, an ordered array of view instances.
 * Any list with no stored entry is templated from `DEFAULT_VIEW_CODES` on read,
 * so EVERY project shows the default tabs (List, Board, Calendar, Gantt, Table)
 * without seeding. Mirrors the workspace store's persist conventions: curried
 * `create<State>()(persist(...))`, versioned localStorage key, `skipHydration`
 * with a client hydrator, immutable Record-keyed-by-listId state.
 *
 * Public API:
 *   useListViews / useViewsActions    — convenience hooks (./hooks)
 *   resolveViewSegment                — pure route resolver (below)
 *   useViewsStore.persist             — persist controls (rehydrate)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View, ViewsState } from './types';
import {
  deriveViewId,
  defaultViewName,
  parseDerivedViewId,
  templateViews,
} from './template';

export const VIEWS_STORAGE_KEY = 'parity-views-v1';

/**
 * Referentially-stable cache for the templated default view set, keyed by listId.
 * `getListViews` is called on every render by `useListViews` (via `useShallow`);
 * returning a fresh `templateViews()` array each time defeats the shallow compare
 * and drives an infinite render loop. We cache the templated array per list so
 * repeated reads return the SAME reference and the SAME element objects until the
 * list is materialised with real stored views (addView/removeView/etc.), at which
 * point the cache entry is dropped.
 */
const templateCache = new Map<string, View[]>();

/** Memoised templated default views for a list. Stable across reads. */
function cachedTemplateViews(listId: string): View[] {
  let cached = templateCache.get(listId);
  if (!cached) {
    cached = templateViews(listId);
    templateCache.set(listId, cached);
  }
  return cached;
}

/** Drop a list's cached template so the next read reflects materialised state. */
function invalidateTemplateCache(listId: string): void {
  templateCache.delete(listId);
}

/** The stored OR templated views for a list, given the raw `views` record. */
function listViewsFrom(views: Record<string, View[]>, listId: string): View[] {
  const stored = views[listId];
  return stored && stored.length > 0 ? stored : cachedTemplateViews(listId);
}

export const useViewsStore = create<ViewsState>()(
  persist(
    (set, get) => ({
      views: {},

      getListViews: (listId) => listViewsFrom(get().views, listId),

      addView: (listId, code, name) => {
        const current = listViewsFrom(get().views, listId);
        const ordinal = current.filter((v) => v.code === code).length + 1;
        const view: View = {
          id: deriveViewId(listId, code, ordinal),
          code,
          name: name?.trim() || defaultViewName(code),
          listId,
        };
        // Materialise the templated set on first mutation so default views
        // survive alongside the new instance.
        invalidateTemplateCache(listId);
        set((state) => ({
          views: { ...state.views, [listId]: [...current, view] },
        }));
        return view;
      },

      removeView: (listId, viewId) => {
        const current = listViewsFrom(get().views, listId);
        const next = current.filter((v) => v.id !== viewId);
        // Keep at least one view; refuse to delete the last remaining tab.
        if (next.length === 0) return;
        invalidateTemplateCache(listId);
        set((state) => ({ views: { ...state.views, [listId]: next } }));
      },

      renameView: (listId, viewId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const current = listViewsFrom(get().views, listId);
        invalidateTemplateCache(listId);
        set((state) => ({
          views: {
            ...state.views,
            [listId]: current.map((v) => (v.id === viewId ? { ...v, name: trimmed } : v)),
          },
        }));
      },

      reorderViews: (listId, orderedIds) => {
        const current = listViewsFrom(get().views, listId);
        const byId = new Map(current.map((v) => [v.id, v]));
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((v): v is View => v != null);
        // Append any views missing from the order list to avoid silent drops.
        for (const v of current) {
          if (!orderedIds.includes(v.id)) reordered.push(v);
        }
        if (reordered.length !== current.length) return;
        invalidateTemplateCache(listId);
        set((state) => ({ views: { ...state.views, [listId]: reordered } }));
      },

      resolveSegment: (seg) => {
        // Extra instances encode their list+code in the id.
        const derived = parseDerivedViewId(seg);
        if (derived) return derived;
        // Otherwise the segment is a raw listId (a default-template instance);
        // the URL carries the code, so default it to the first default view.
        if (!seg) return null;
        return { listId: seg, code: 'l' };
      },
    }),
    {
      name: VIEWS_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/**
 * Pure route resolver: maps a URL view-id segment back to its list + code.
 * Default-template segments resolve to `{ listId: seg, code: 'l' }` (the route
 * supplies the real code); extra instances decode their derived id. Safe to call
 * outside React.
 */
export function resolveViewSegment(
  seg: string,
): { listId: string; code: string } | null {
  return useViewsStore.getState().resolveSegment(seg);
}

export type { View, ViewsState } from './types';
