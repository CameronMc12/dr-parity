'use client';

/**
 * Local UI store for the Dashboards experience. Tracks which dashboard the hub
 * is currently showing (null = the gallery landing). Kept self-contained in the
 * dashboards-hub dir so the sidebar and the hub — two separate React subtrees —
 * stay in sync without touching the global ui-store.
 */

import { create } from 'zustand';

interface DashboardsUiState {
  /** Selected dashboard id, or null when viewing the gallery. */
  openDashboardId: string | null;
  openDashboard: (id: string) => void;
  closeDashboard: () => void;
}

export const useDashboardsUi = create<DashboardsUiState>((set) => ({
  openDashboardId: null,
  openDashboard: (id) => set({ openDashboardId: id }),
  closeDashboard: () => set({ openDashboardId: null }),
}));
