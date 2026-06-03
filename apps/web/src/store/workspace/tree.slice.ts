/**
 * Tree (space / folder / list) slice. Operates on the nested WorkspaceTree.
 * Mutations clone the tree immutably so persisted snapshots and selectors stay
 * referentially honest.
 */

import type { StateCreator } from 'zustand';
import { nextId } from './ids';
import type {
  FolderNode,
  ListNode,
  SpaceNode,
  WorkspaceState,
  WorkspaceTree,
} from './types';

const DEFAULT_SPACE_COLOR = '#03A2FD';

export interface TreeActions {
  createSpace: (name: string, color?: string) => SpaceNode;
  createFolder: (spaceId: string, name: string) => FolderNode | null;
  createList: (
    parent: { spaceId: string; folderId?: string },
    name: string,
  ) => ListNode | null;
  renameNode: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleExpanded: (nodeId: string) => void;
}

function cloneTree(tree: WorkspaceTree): WorkspaceTree {
  return structuredClone(tree);
}

export const createTreeSlice: StateCreator<WorkspaceState, [], [], TreeActions> = (
  set,
  get,
) => ({
  createSpace: (name, color = DEFAULT_SPACE_COLOR) => {
    const id = nextId('space', set, get);
    const space: SpaceNode = { id, name, color, folderlessLists: [], folders: [] };
    set((state) => ({
      tree: { spaces: [...state.tree.spaces, space] },
      expanded: { ...state.expanded, [id]: true },
    }));
    return space;
  },

  createFolder: (spaceId, name) => {
    const id = nextId('folder', set, get);
    const folder: FolderNode = { id, name, lists: [] };
    let ok = false;
    set((state) => {
      const tree = cloneTree(state.tree);
      const space = tree.spaces.find((s) => s.id === spaceId);
      if (!space) return {};
      space.folders.push(folder);
      ok = true;
      return { tree };
    });
    return ok ? folder : null;
  },

  createList: (parent, name) => {
    const id = nextId('list', set, get);
    const list: ListNode = { id, name, count: 0 };
    let ok = false;
    set((state) => {
      const tree = cloneTree(state.tree);
      const space = tree.spaces.find((s) => s.id === parent.spaceId);
      if (!space) return {};
      if (parent.folderId) {
        const folder = space.folders.find((f) => f.id === parent.folderId);
        if (!folder) return {};
        folder.lists.push(list);
      } else {
        space.folderlessLists.push(list);
      }
      ok = true;
      return { tree };
    });
    return ok ? list : null;
  },

  renameNode: (nodeId, name) => {
    set((state) => {
      const tree = cloneTree(state.tree);
      for (const space of tree.spaces) {
        if (space.id === nodeId) {
          space.name = name;
          return { tree };
        }
        for (const folder of space.folders) {
          if (folder.id === nodeId) {
            folder.name = name;
            return { tree };
          }
          const list = folder.lists.find((l) => l.id === nodeId);
          if (list) {
            list.name = name;
            return { tree };
          }
        }
        const fl = space.folderlessLists.find((l) => l.id === nodeId);
        if (fl) {
          fl.name = name;
          return { tree };
        }
      }
      return {};
    });
  },

  deleteNode: (nodeId) => {
    set((state) => {
      const tree = cloneTree(state.tree);
      tree.spaces = tree.spaces.filter((s) => s.id !== nodeId);
      for (const space of tree.spaces) {
        space.folders = space.folders.filter((f) => f.id !== nodeId);
        space.folderlessLists = space.folderlessLists.filter((l) => l.id !== nodeId);
        for (const folder of space.folders) {
          folder.lists = folder.lists.filter((l) => l.id !== nodeId);
        }
      }
      return { tree };
    });
  },

  toggleExpanded: (nodeId) => {
    set((state) => ({
      expanded: { ...state.expanded, [nodeId]: !state.expanded[nodeId] },
    }));
  },
});
