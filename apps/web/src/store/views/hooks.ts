/**
 * Convenience hooks for the per-list views store. `useListViews` returns the
 * stored-or-templated ordered views for a list and is wrapped in `useShallow`
 * because the templating path allocates a fresh array each call — without it
 * useSyncExternalStore would loop. Action hooks return stable function refs.
 */

import { useShallow } from 'zustand/react/shallow';
import { useViewsStore } from './index';
import type { View } from './types';

/** Ordered views for a list (stored override or default template). Never empty. */
export function useListViews(listId: string): View[] {
  return useViewsStore(useShallow((s) => s.getListViews(listId)));
}

export function useAddView(): (listId: string, code: string, name?: string) => View {
  return useViewsStore((s) => s.addView);
}

export function useRemoveView(): (listId: string, viewId: string) => void {
  return useViewsStore((s) => s.removeView);
}

export function useRenameView(): (listId: string, viewId: string, name: string) => void {
  return useViewsStore((s) => s.renameView);
}

export function useReorderViews(): (listId: string, orderedIds: string[]) => void {
  return useViewsStore((s) => s.reorderViews);
}
