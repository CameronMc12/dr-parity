import { create } from 'zustand';

/**
 * Transient docs-hub state. The hub's left rail lives in the global sidebar
 * column while the table lives in the main content area, so the selected
 * collection (All Docs / My Docs / …) and any session-only row deletions are
 * shared through this store rather than prop-drilled across the shell boundary.
 */
interface DocsHubState {
  /** Active rail collection id. Only "all" is populated from the seed. */
  activeSection: string;
  setActiveSection: (id: string) => void;

  /** Doc ids removed via the row context menu this session. */
  removedIds: string[];
  removeDoc: (id: string) => void;
}

export const useDocsHubStore = create<DocsHubState>((set) => ({
  activeSection: 'all',
  setActiveSection: (id) => set({ activeSection: id }),

  removedIds: [],
  removeDoc: (id) =>
    set((s) => (s.removedIds.includes(id) ? s : { removedIds: [...s.removedIds, id] })),
}));
