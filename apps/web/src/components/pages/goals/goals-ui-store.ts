import { create } from 'zustand';
import { GOALS, type Goal, type GoalOwner } from '@/data/goals-seed';

/**
 * Self-contained Goals state. Lives in the goals dir so it never touches the
 * shared ui/shell stores. Holds the live goal grid plus the three landing
 * toggles (sort / folders / archived) shown in the toolbar.
 */

const OWNER: GoalOwner = { initials: 'C', color: 'rgb(89, 93, 102)' };

function nowLabel(): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  // "Jun 8, 5:08 PM" -> "Jun 8 at 5:08 pm"
  return fmt
    .format(new Date())
    .replace(',', ' at')
    .replace(/\s?([AP])M$/, (_m, p: string) => ` ${p.toLowerCase()}m`);
}

interface GoalsUiState {
  goals: Goal[];
  showFolders: boolean;
  showArchived: boolean;

  addGoal: () => void;
  toggleFolders: () => void;
  toggleArchived: () => void;
}

let goalSeq = GOALS.length;

export const useGoalsStore = create<GoalsUiState>((set) => ({
  goals: GOALS,
  showFolders: false,
  showArchived: false,

  addGoal: () =>
    set((s) => {
      goalSeq += 1;
      const goal: Goal = {
        id: `goal.new.${goalSeq}`,
        name: 'New Goal',
        percent: 0,
        targetCount: 0,
        owner: OWNER,
        dateLabel: nowLabel(),
      };
      return { goals: [goal, ...s.goals] };
    }),

  toggleFolders: () => set((s) => ({ showFolders: !s.showFolders })),
  toggleArchived: () => set((s) => ({ showArchived: !s.showArchived })),
}));
