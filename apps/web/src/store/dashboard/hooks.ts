/**
 * Dashboard selector hooks. Thin wrappers around useDashboardStore that return
 * stable references so components never loop.
 *
 * Array/object selectors MUST be wrapped in `useShallow` — otherwise
 * useSyncExternalStore sees a fresh reference every render and throws
 * "Maximum update depth exceeded". Primitive selectors need no wrapper.
 *
 * Components are expected to call `useEnsureDashboard(viewId)` once on mount so
 * a default board is seeded before the card list is read.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from './index';
import type { DashboardCard } from './types';

const EMPTY_CARDS: DashboardCard[] = [];

let rehydrated = false;

/**
 * Seed a default dashboard for `viewId` once on mount (idempotent). Also drives
 * the one-time client rehydration of the persisted store (skipHydration: true),
 * so the Dashboard view is self-contained and needs no separate hydrator mount.
 */
export function useEnsureDashboard(viewId: string): void {
  const ensureDashboard = useDashboardStore((s) => s.ensureDashboard);
  useEffect(() => {
    async function init() {
      if (!rehydrated) {
        rehydrated = true;
        await useDashboardStore.persist.rehydrate();
      }
      ensureDashboard(viewId);
    }
    void init();
  }, [viewId, ensureDashboard]);
}

/** Ordered cards for a dashboard. Stable across renders via useShallow. */
export function useDashboardCards(viewId: string): DashboardCard[] {
  return useDashboardStore(
    useShallow((s) => s.dashboards[viewId]?.cards ?? EMPTY_CARDS),
  );
}

/** A single card by id, or null. */
export function useDashboardCard(
  viewId: string,
  id: string,
): DashboardCard | null {
  return useDashboardStore(
    (s) => s.dashboards[viewId]?.cards.find((c) => c.id === id) ?? null,
  );
}

export function useAutoRefresh(viewId: string): boolean {
  return useDashboardStore((s) => s.dashboards[viewId]?.autoRefresh ?? true);
}

/** All dashboard mutation actions in one stable object. */
export function useDashboardActions() {
  return useDashboardStore(
    useShallow((s) => ({
      addCard: s.addCard,
      removeCard: s.removeCard,
      moveCard: s.moveCard,
      resizeCard: s.resizeCard,
      updateCardConfig: s.updateCardConfig,
      renameCard: s.renameCard,
      duplicateCard: s.duplicateCard,
      setCardFilters: s.setCardFilters,
      setAutoRefresh: s.setAutoRefresh,
      refreshCard: s.refreshCard,
      refreshAll: s.refreshAll,
    })),
  );
}
