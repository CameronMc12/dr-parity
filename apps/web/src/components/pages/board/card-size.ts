'use client';

/**
 * Board-local card-size setting (ClickUp `board__card-size__{small|medium|large}`).
 * Persisted per list so the choice survives view switches. Kept out of the shared
 * ViewConfig because card size is a board-only concept.
 */

import { create } from 'zustand';
import type { CardSize } from './tokens';

interface CardSizeState {
  byList: Record<string, CardSize>;
  setCardSize: (listId: string, size: CardSize) => void;
}

export const useBoardCardSize = create<CardSizeState>((set) => ({
  byList: {},
  setCardSize: (listId, size) =>
    set((s) => ({ byList: { ...s.byList, [listId]: size } })),
}));

/** Read the saved size for a list, defaulting to ClickUp's `medium`. */
export function useCardSize(listId: string): CardSize {
  return useBoardCardSize((s) => s.byList[listId] ?? 'medium');
}
