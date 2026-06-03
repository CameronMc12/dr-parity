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
}));
