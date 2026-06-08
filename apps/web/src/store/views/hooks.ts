/**
 * Convenience hooks for the per-scope views store. `useScopeViews` returns the
 * stored-or-templated ordered views for a scopeKey and is wrapped in `useShallow`
 * because the templating path allocates a fresh array each call — without it
 * useSyncExternalStore would loop. `useListViews` is a back-compat alias (a
 * list's scopeKey IS its listId). Action hooks return stable function refs.
 */

import { useShallow } from 'zustand/react/shallow';
import { useViewsStore } from './index';
import type { View } from './types';

/** Ordered views for a scope (stored override or default template). Never empty. */
export function useScopeViews(scopeKey: string): View[] {
  return useViewsStore(useShallow((s) => s.getScopeViews(scopeKey)));
}

/** Back-compat alias: a list's scopeKey is its listId. */
export function useListViews(listId: string): View[] {
  return useScopeViews(listId);
}

export function useAddView(): (scopeKey: string, code: string, name?: string) => View {
  return useViewsStore((s) => s.addView);
}

export function useRemoveView(): (scopeKey: string, viewId: string) => void {
  return useViewsStore((s) => s.removeView);
}

export function useRenameView(): (scopeKey: string, viewId: string, name: string) => void {
  return useViewsStore((s) => s.renameView);
}

export function useReorderViews(): (scopeKey: string, orderedIds: string[]) => void {
  return useViewsStore((s) => s.reorderViews);
}
