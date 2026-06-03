import { create } from 'zustand';
import type { IconBarItemId } from '@/types/workspace';

interface ShellState {
  activeIcon: IconBarItemId;
  sidebarOpen: boolean;
  sidebarWidth: number;

  setActiveIcon: (id: IconBarItemId) => void;
  setRouteShell: (id: IconBarItemId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeIcon: 'home',
  sidebarOpen: true,
  sidebarWidth: 256, // matches --cu-sidebar-width, measured from live clone

  setActiveIcon: (id) =>
    set((state) => {
      if (state.activeIcon === id && state.sidebarOpen) {
        // clicking active icon collapses sidebar
        return { sidebarOpen: false };
      }
      return { activeIcon: id, sidebarOpen: true };
    }),

  setRouteShell: (id) => set({ activeIcon: id, sidebarOpen: true }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
