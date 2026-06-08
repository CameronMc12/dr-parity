import { create } from 'zustand';

/**
 * Transient UI store for global, ephemeral overlays. Kept separate from the
 * persisted workspace store so opening a modal never writes to localStorage.
 * Currently drives the global Create-Task modal.
 */
interface UiState {
  createTaskOpen: boolean;
  /** Pre-selected list for the create-task form (e.g. opened from a list view). */
  defaultListId: string | null;
  openCreateTask: (listId?: string) => void;
  closeCreateTask: () => void;

  /** Task whose detail modal is open, or null when no task modal is shown. */
  openTaskId: string | null;
  openTask: (taskId: string) => void;
  closeTask: () => void;

  /** Multi-select set for List-view bulk actions (transient, clears on reload). */
  selectedTaskIds: string[];
  toggleTaskSelected: (taskId: string) => void;
  setTasksSelected: (taskIds: string[], selected: boolean) => void;
  clearSelection: () => void;

  /** Whether the centered Settings modal overlay is open. */
  settingsOpen: boolean;
  /** Active settings section key (e.g. 'profile', 'notifications'). */
  settingsSection: string;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  setSettingsSection: (section: string) => void;

  /** Whether the centered Invite-members modal overlay is open. */
  inviteOpen: boolean;
  openInvite: () => void;
  closeInvite: () => void;

  /** Whether the centered ⌘K global-search command palette is open. */
  searchOpen: boolean;
  /** Live query text for the command palette (kept here so ⌘K can preseed it). */
  searchQuery: string;
  openSearch: (query?: string) => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;

  /** Whether the right-docked Brain / Max AI assistant panel is open. */
  aiPanelOpen: boolean;
  /** Context label for the AI panel (a space/project name), or null when generic. */
  aiPanelScope: string | null;
  openAiPanel: (scope?: string) => void;
  closeAiPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  createTaskOpen: false,
  defaultListId: null,
  openCreateTask: (listId) => set({ createTaskOpen: true, defaultListId: listId ?? null }),
  closeCreateTask: () => set({ createTaskOpen: false, defaultListId: null }),

  openTaskId: null,
  openTask: (taskId) => set({ openTaskId: taskId }),
  closeTask: () => set({ openTaskId: null }),

  selectedTaskIds: [],
  toggleTaskSelected: (taskId) =>
    set((s) => ({
      selectedTaskIds: s.selectedTaskIds.includes(taskId)
        ? s.selectedTaskIds.filter((id) => id !== taskId)
        : [...s.selectedTaskIds, taskId],
    })),
  setTasksSelected: (taskIds, selected) =>
    set((s) => {
      const next = new Set(s.selectedTaskIds);
      for (const id of taskIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return { selectedTaskIds: [...next] };
    }),
  clearSelection: () => set({ selectedTaskIds: [] }),

  settingsOpen: false,
  settingsSection: 'profile',
  openSettings: (section) =>
    set({ settingsOpen: true, settingsSection: section ?? 'profile' }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsSection: (section) => set({ settingsSection: section }),

  inviteOpen: false,
  openInvite: () => set({ inviteOpen: true }),
  closeInvite: () => set({ inviteOpen: false }),

  searchOpen: false,
  searchQuery: '',
  openSearch: (query) => set({ searchOpen: true, searchQuery: query ?? '' }),
  closeSearch: () => set({ searchOpen: false, searchQuery: '' }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  aiPanelOpen: false,
  aiPanelScope: null,
  openAiPanel: (scope) => set({ aiPanelOpen: true, aiPanelScope: scope ?? null }),
  closeAiPanel: () => set({ aiPanelOpen: false }),
}));
