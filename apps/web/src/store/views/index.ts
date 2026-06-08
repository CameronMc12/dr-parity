/**
 * Per-scope views store. Persists, per scopeKey, an ordered array of view
 * instances. A scopeKey is `scopeKey(scope)` from view-scope.ts — the raw listId
 * for a single-list scope (so list behaviour is byte-identical to before), or
 * `space:<id>` / `folder:<id>` for a space/folder scope. Any scope with no stored
 * entry is templated from `DEFAULT_VIEW_CODES` on read, so EVERY list, space, and
 * folder shows the default tabs (List, Board, Calendar, Gantt, Table) without
 * seeding. Mirrors the workspace store's persist conventions: curried
 * `create<State>()(persist(...))`, versioned localStorage key, `skipHydration`
 * with a client hydrator, immutable Record-keyed-by-scopeKey state.
 *
 * Public API:
 *   useScopeViews / useViewsActions   — convenience hooks (./hooks)
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
 * Referentially-stable cache for the templated default view set, keyed by
 * scopeKey. `getScopeViews` is called on every render by `useScopeViews` (via
 * `useShallow`); returning a fresh `templateViews()` array each time defeats the
 * shallow compare and drives an infinite render loop. We cache the templated
 * array per scope so repeated reads return the SAME reference and the SAME
 * element objects until the scope is materialised with real stored views
 * (addView/removeView/etc.), at which point the cache entry is dropped.
 */
const templateCache = new Map<string, View[]>();

/** Memoised templated default views for a scope. Stable across reads. */
function cachedTemplateViews(scopeKey: string): View[] {
  let cached = templateCache.get(scopeKey);
  if (!cached) {
    cached = templateViews(scopeKey);
    templateCache.set(scopeKey, cached);
  }
  return cached;
}

/** Drop a scope's cached template so the next read reflects materialised state. */
function invalidateTemplateCache(scopeKey: string): void {
  templateCache.delete(scopeKey);
}

/** The stored OR templated views for a scope, given the raw `views` record. */
function scopeViewsFrom(views: Record<string, View[]>, scopeKey: string): View[] {
  const stored = views[scopeKey];
  return stored && stored.length > 0 ? stored : cachedTemplateViews(scopeKey);
}

export const useViewsStore = create<ViewsState>()(
  persist(
    (set, get) => ({
      views: {},

      getScopeViews: (scopeKey) => scopeViewsFrom(get().views, scopeKey),

      // Back-compat alias: a list's scopeKey is its listId.
      getListViews: (listId) => scopeViewsFrom(get().views, listId),

      addView: (scopeKey, code, name) => {
        const current = scopeViewsFrom(get().views, scopeKey);
        const ordinal = current.filter((v) => v.code === code).length + 1;
        const view: View = {
          id: deriveViewId(scopeKey, code, ordinal),
          code,
          name: name?.trim() || defaultViewName(code),
          scopeKey,
          listId: scopeKey,
        };
        // Materialise the templated set on first mutation so default views
        // survive alongside the new instance.
        invalidateTemplateCache(scopeKey);
        set((state) => ({
          views: { ...state.views, [scopeKey]: [...current, view] },
        }));
        return view;
      },

      removeView: (scopeKey, viewId) => {
        const current = scopeViewsFrom(get().views, scopeKey);
        const next = current.filter((v) => v.id !== viewId);
        // Keep at least one view; refuse to delete the last remaining tab.
        if (next.length === 0) return;
        invalidateTemplateCache(scopeKey);
        set((state) => ({ views: { ...state.views, [scopeKey]: next } }));
      },

      renameView: (scopeKey, viewId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const current = scopeViewsFrom(get().views, scopeKey);
        invalidateTemplateCache(scopeKey);
        set((state) => ({
          views: {
            ...state.views,
            [scopeKey]: current.map((v) => (v.id === viewId ? { ...v, name: trimmed } : v)),
          },
        }));
      },

      reorderViews: (scopeKey, orderedIds) => {
        const current = scopeViewsFrom(get().views, scopeKey);
        const byId = new Map(current.map((v) => [v.id, v]));
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((v): v is View => v != null);
        // Append any views missing from the order list to avoid silent drops.
        for (const v of current) {
          if (!orderedIds.includes(v.id)) reordered.push(v);
        }
        if (reordered.length !== current.length) return;
        invalidateTemplateCache(scopeKey);
        set((state) => ({ views: { ...state.views, [scopeKey]: reordered } }));
      },

      resolveSegment: (seg) => {
        // Extra instances encode their scopeKey+code in the id.
        const derived = parseDerivedViewId(seg);
        if (derived) return derived;
        // Otherwise the segment is a raw scopeKey (a default-template instance);
        // the URL carries the code, so default it to the first default view.
        if (!seg) return null;
        return { scopeKey: seg, code: 'l' };
      },
    }),
    {
      name: VIEWS_STORAGE_KEY,
      version: 2,
      skipHydration: true,
      // v1 → v2: drop persisted views for the channel-backed list ids so
      // channel-list-seed re-applies the full Channel view set on hydrate. Other
      // lists' persisted views are preserved.
      migrate: (persisted, fromVersion) => {
        const prev = (persisted ?? {}) as Partial<{ views: Record<string, View[]> }>;
        if (fromVersion >= 2) return prev;
        const channelBackedListIds = [
          '901523542898',
          '901523547043',
          '901523546368',
          '901523546362',
        ];
        const views = { ...(prev.views ?? {}) };
        for (const listId of channelBackedListIds) delete views[listId];
        return { ...prev, views };
      },
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/**
 * Pure route resolver: maps a URL view-id segment back to its scopeKey + code.
 * Default-template segments resolve to `{ scopeKey: seg, code: 'l' }` (the route
 * supplies the real code); extra instances decode their derived id. Safe to call
 * outside React.
 */
export function resolveViewSegment(
  seg: string,
): { scopeKey: string; code: string } | null {
  return useViewsStore.getState().resolveSegment(seg);
}

export type { View, ViewsState } from './types';
