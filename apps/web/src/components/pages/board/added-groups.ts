'use client';

/**
 * Board-local store for user-added status groups. ClickUp's Board lets you press
 * "+ Add group" to create a brand-new (empty) status column that cards can then
 * be dragged into. The workspace store derives its status set from existing
 * tasks, so a freshly-added EMPTY group has no task to infer from — we persist it
 * here, keyed by listId, and merge it into the rendered column set in BoardView.
 *
 * Each added group carries the `status` label + `statusColor` that any card
 * dropped into it should adopt. Once a real task lands on the status, the normal
 * `useStatusColumns` pipeline takes over, so an added group is only "extra" while
 * it is still empty — we filter merged duplicates by status label.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AddedGroup {
  /** Stable key (`added:<listId>:<n>`), distinct from `status:<label>` columns. */
  key: string;
  status: string;
  color: string;
  statusType: string;
}

interface AddedGroupsState {
  /** listId -> ordered list of user-added empty status groups. */
  byList: Record<string, AddedGroup[]>;
  addGroup: (listId: string, status: string, color: string, statusType?: string) => void;
  removeGroup: (listId: string, key: string) => void;
}

/** Palette ClickUp cycles through for new status columns. */
const NEW_GROUP_COLORS = ['#a875ff', '#f9d900', '#ff7fab', '#02bcd4', '#ff7800', '#1bbc9c'];

function nextColor(existing: AddedGroup[]): string {
  return NEW_GROUP_COLORS[existing.length % NEW_GROUP_COLORS.length] ?? '#a875ff';
}

export const useAddedGroups = create<AddedGroupsState>()(
  persist(
    (set) => ({
      byList: {},
      addGroup: (listId, status, color, statusType = 'custom') =>
        set((state) => {
          const list = state.byList[listId] ?? [];
          const label = status.trim();
          if (!label || list.some((g) => g.status.toLowerCase() === label.toLowerCase())) {
            return state;
          }
          const group: AddedGroup = {
            key: `added:${listId}:${Date.now()}`,
            status: label,
            color: color || nextColor(list),
            statusType,
          };
          return { byList: { ...state.byList, [listId]: [...list, group] } };
        }),
      removeGroup: (listId, key) =>
        set((state) => {
          const list = state.byList[listId];
          if (!list) return state;
          return { byList: { ...state.byList, [listId]: list.filter((g) => g.key !== key) } };
        }),
    }),
    { name: 'board-added-groups' },
  ),
);

export { NEW_GROUP_COLORS };
