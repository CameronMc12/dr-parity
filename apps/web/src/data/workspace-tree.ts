import treeJson from './workspace-tree.json';

export interface ListNode {
  id: string;
  name: string;
  count: number;
}

export interface FolderNode {
  id: string;
  name: string;
  lists: ListNode[];
}

export interface SpaceNode {
  id: string;
  name: string;
  color: string;
  folderlessLists: ListNode[];
  folders: FolderNode[];
}

interface WorkspaceTree {
  spaces: SpaceNode[];
}

export const WORKSPACE_TREE = treeJson as WorkspaceTree;

/**
 * View URLs use an opaque viewId (e.g. `/v/l/2kyr6013-2255`) rather than the
 * raw listId. ClickUp does not expose the view->list map in the structural
 * export, so the mappings observed in the crawl are recorded here. Add more
 * entries as additional views are captured.
 */
export const VIEW_TO_LIST: Record<string, string> = {
  // AB Content Management (Software Development > Sprint Team)
  '2kyr6013-2255': '901523547043', // List view
  '2kyr6013-2235': '901523547043', // Board (Priorities)
  '2kyr6013-2155': '901523547043', // Subtasks
  '2kyr6013-1455': '901523547043', // Task
};

export interface ResolvedPath {
  space: SpaceNode;
  folder?: FolderNode;
  list: ListNode;
}

/** Resolve a listId to its space/folder ancestor path. */
export function resolveListPath(listId: string): ResolvedPath | null {
  for (const space of WORKSPACE_TREE.spaces) {
    const folderless = space.folderlessLists.find((l) => l.id === listId);
    if (folderless) return { space, list: folderless };

    for (const folder of space.folders) {
      const list = folder.lists.find((l) => l.id === listId);
      if (list) return { space, folder, list };
    }
  }
  return null;
}

/**
 * Resolve the active path from a pathname like
 * `/90152566819/v/l/2kyr6013-2255`. Accepts a viewId (mapped via
 * VIEW_TO_LIST) or a raw listId appearing after the view-type segment.
 */
export function resolvePathFromUrl(pathname: string): ResolvedPath | null {
  const match = pathname.match(/\/v\/[a-z]+\/([^/]+)/i);
  const token = match?.[1];
  if (!token) return null;

  const listId = VIEW_TO_LIST[token] ?? token;
  return resolveListPath(listId);
}
