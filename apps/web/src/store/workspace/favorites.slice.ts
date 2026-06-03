/**
 * Favorites slice. A flat list of nodeIds (space / folder / list / doc).
 */

import type { StateCreator } from 'zustand';
import type { WorkspaceState } from './types';

export interface FavoritesActions {
  toggleFavorite: (nodeId: string) => void;
}

export const createFavoritesSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  FavoritesActions
> = (set) => ({
  toggleFavorite: (nodeId) => {
    set((state) => ({
      favorites: state.favorites.includes(nodeId)
        ? state.favorites.filter((id) => id !== nodeId)
        : [...state.favorites, nodeId],
    }));
  },
});
