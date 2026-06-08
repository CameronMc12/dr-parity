import { create } from 'zustand';
import {
  GOALS,
  GOAL_FOLDERS,
  type Goal,
  type GoalFolder,
  type Target,
} from '@/data/goals-seed';

/**
 * Self-contained Goals state, shared by GoalsView + GoalsSidebar. Lives in the
 * goals dir so it does not touch the shared ui/shell stores.
 *
 * Holds the live folder + goal lists (so "+ New Goal" / "+ Add Goal Folder" and
 * per-target edits mutate local state), the selected folder filter, and the
 * per-folder collapse map.
 */

const OWNER = { initials: 'CM', color: 'rgb(122, 122, 122)' };

interface GoalsUiState {
  folders: GoalFolder[];
  goals: Goal[];
  /** null = "All Goals". */
  selectedFolderId: string | null;
  collapsed: Record<string, boolean>;

  selectFolder: (id: string | null) => void;
  toggleCollapse: (folderId: string) => void;
  addFolder: () => void;
  addGoal: (folderId: string) => void;
  setTarget: (goalId: string, targetId: string, next: Target) => void;
}

let folderSeq = GOAL_FOLDERS.length;
let goalSeq = GOALS.length;

export const useGoalsStore = create<GoalsUiState>((set) => ({
  folders: GOAL_FOLDERS,
  goals: GOALS,
  selectedFolderId: null,
  collapsed: {},

  selectFolder: (id) => set({ selectedFolderId: id }),

  toggleCollapse: (folderId) =>
    set((s) => ({ collapsed: { ...s.collapsed, [folderId]: !s.collapsed[folderId] } })),

  addFolder: () =>
    set((s) => {
      folderSeq += 1;
      const folder: GoalFolder = {
        id: `fld.new.${folderSeq}`,
        name: `New Folder ${folderSeq}`,
        color: 'rgb(130, 130, 130)',
      };
      return { folders: [...s.folders, folder] };
    }),

  addGoal: (folderId) =>
    set((s) => {
      goalSeq += 1;
      const goal: Goal = {
        id: `goal.new.${goalSeq}`,
        folderId,
        name: 'Untitled Goal',
        owner: OWNER,
        dueLabel: 'No due date',
        targets: [
          { id: `t.new.${goalSeq}`, type: 'number', name: 'New target', current: 0, target: 1 },
        ],
      };
      return { goals: [goal, ...s.goals] };
    }),

  setTarget: (goalId, targetId, next) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? { ...g, targets: g.targets.map((t) => (t.id === targetId ? next : t)) }
          : g,
      ),
    })),
}));
