/**
 * Dashboard store. Persisted (localStorage) layout state for each dashboard
 * view: an ordered array of cards on a 12-column grid, plus per-board options.
 * Keyed by viewId so every Dashboard view owns an independent layout.
 *
 * SSR-safe: hydration deferred to the client (skipHydration + a hydrator in the
 * provider tree). Card ids are minted from a persisted counter so they are
 * deterministic and stable across reloads.
 *
 * Public API:
 *   useDashboardStore        — raw Zustand hook (state + actions)
 *   hooks (./hooks)          — stable, memoised selector hooks for components
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CardConfig,
  CardFilters,
  CardType,
  Dashboard,
  DashboardCard,
  DashboardState,
} from './types';
import { CARD_DEFAULT_SIZE, CARD_DEFAULT_TITLE, defaultDashboard } from './defaults';

export const DASHBOARD_STORAGE_KEY = 'parity-dashboard-v1';

const GRID_COLS = 12;

/** Lowest free row at full width — drop new cards beneath everything. */
function nextRow(cards: DashboardCard[]): number {
  return cards.reduce((max, c) => Math.max(max, c.y + c.h), 0);
}

/** Clamp x so a w-wide card stays inside the 12-col grid. */
function clampX(x: number, w: number): number {
  return Math.max(0, Math.min(x, GRID_COLS - w));
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => {
      const mintId = (): string => {
        let minted = '';
        set((state) => {
          const n = state.cardCounter + 1;
          minted = `card-${n}`;
          return { cardCounter: n };
        });
        return minted;
      };

      const board = (viewId: string): Dashboard =>
        get().dashboards[viewId] ?? { cards: [], autoRefresh: true };

      const writeCards = (viewId: string, cards: DashboardCard[]) => {
        set((state) => ({
          dashboards: {
            ...state.dashboards,
            [viewId]: { ...board(viewId), cards },
          },
        }));
      };

      const mapCard = (
        viewId: string,
        id: string,
        fn: (card: DashboardCard) => DashboardCard,
      ) => {
        const cards = board(viewId).cards.map((c) => (c.id === id ? fn(c) : c));
        writeCards(viewId, cards);
      };

      return {
        dashboards: {},
        cardCounter: 0,

        ensureDashboard: (viewId) => {
          if (get().dashboards[viewId]) return;
          set((state) => ({
            dashboards: {
              ...state.dashboards,
              [viewId]: defaultDashboard(mintId),
            },
          }));
        },

        addCard: (viewId, type: CardType) => {
          get().ensureDashboard(viewId);
          const size = CARD_DEFAULT_SIZE[type];
          const cards = board(viewId).cards;
          const id = mintId();
          const next: DashboardCard = {
            id,
            type,
            title: CARD_DEFAULT_TITLE[type],
            x: 0,
            y: nextRow(cards),
            w: size.w,
            h: size.h,
            config: {},
          };
          writeCards(viewId, [...cards, next]);
          return id;
        },

        removeCard: (viewId, id) => {
          writeCards(viewId, board(viewId).cards.filter((c) => c.id !== id));
        },

        moveCard: (viewId, id, x, y) => {
          mapCard(viewId, id, (c) => ({
            ...c,
            x: clampX(x, c.w),
            y: Math.max(0, y),
          }));
        },

        resizeCard: (viewId, id, w, h) => {
          mapCard(viewId, id, (c) => {
            const nextW = Math.max(2, Math.min(w, GRID_COLS));
            return {
              ...c,
              w: nextW,
              h: Math.max(2, h),
              x: clampX(c.x, nextW),
            };
          });
        },

        updateCardConfig: (viewId, id, config: CardConfig) => {
          mapCard(viewId, id, (c) => ({
            ...c,
            config: { ...c.config, ...config },
          }));
        },

        renameCard: (viewId, id, title) => {
          mapCard(viewId, id, (c) => ({ ...c, title }));
        },

        duplicateCard: (viewId, id) => {
          const src = board(viewId).cards.find((c) => c.id === id);
          if (!src) return;
          const cards = board(viewId).cards;
          const copy: DashboardCard = {
            ...src,
            id: mintId(),
            title: `${src.title} copy`,
            x: 0,
            y: nextRow(cards),
            config: src.config ? { ...src.config } : undefined,
            filters: src.filters ? { ...src.filters } : undefined,
          };
          writeCards(viewId, [...cards, copy]);
        },

        setCardFilters: (viewId, id, filters: CardFilters) => {
          mapCard(viewId, id, (c) => ({ ...c, filters }));
        },

        setAutoRefresh: (viewId, on) => {
          get().ensureDashboard(viewId);
          set((state) => ({
            dashboards: {
              ...state.dashboards,
              [viewId]: { ...board(viewId), autoRefresh: on },
            },
          }));
        },

        refreshCard: (viewId, id) => {
          mapCard(viewId, id, (c) => ({
            ...c,
            refreshTick: (c.refreshTick ?? 0) + 1,
          }));
        },

        refreshAll: (viewId) => {
          const cards = board(viewId).cards.map((c) => ({
            ...c,
            refreshTick: (c.refreshTick ?? 0) + 1,
          }));
          writeCards(viewId, cards);
        },
      };
    },
    {
      name: DASHBOARD_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        dashboards: state.dashboards,
        cardCounter: state.cardCounter,
      }),
    },
  ),
);

export const DASHBOARD_GRID_COLS = GRID_COLS;

export type {
  CardType,
  CardConfig,
  CardFilters,
  CardMetric,
  CardGrouping,
  Dashboard,
  DashboardCard,
  DashboardState,
} from './types';
