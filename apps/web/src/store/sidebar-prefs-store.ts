import { create } from 'zustand';

/**
 * Sidebar display preferences toggled from the header ellipsis menu. Kept in its
 * own transient store so the toggles persist across header re-renders without
 * writing to localStorage. Wiring these to actually filter the tree is optional.
 */
interface SidebarPrefsState {
  showAllSpaces: boolean;
  showArchived: boolean;
  setShowAllSpaces: (next: boolean) => void;
  setShowArchived: (next: boolean) => void;

  /** Home funnel-filter chips. */
  homeFilterUnread: boolean;
  homeFilterDms: boolean;
  setHomeFilterUnread: (next: boolean) => void;
  setHomeFilterDms: (next: boolean) => void;
}

export const useSidebarPrefsStore = create<SidebarPrefsState>((set) => ({
  showAllSpaces: false,
  showArchived: false,
  setShowAllSpaces: (next) => set({ showAllSpaces: next }),
  setShowArchived: (next) => set({ showArchived: next }),

  homeFilterUnread: false,
  homeFilterDms: false,
  setHomeFilterUnread: (next) => set({ homeFilterUnread: next }),
  setHomeFilterDms: (next) => set({ homeFilterDms: next }),
}));
