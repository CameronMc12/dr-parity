/**
 * Build the apps/web workspace tree from the export's structural `tree.json`
 * (which nests spaces -> folders/folderlessLists -> lists, each list carrying
 * its tasks) plus `spaces.json` for per-space colors. List `count` is the
 * number of tasks the export recorded under that list.
 */

import type {
  ExportSpace,
  ExportTree,
  TargetFolderNode,
  TargetListNode,
  TargetSpaceNode,
  TargetWorkspaceTree,
} from './types';

const DEFAULT_SPACE_COLOR = '#7b68ee';

function mapList(list: { id: string; name: string; tasks?: { id: string }[] }): TargetListNode {
  return {
    id: list.id,
    name: list.name ?? 'Untitled',
    count: Array.isArray(list.tasks) ? list.tasks.length : 0,
  };
}

export function mapTree(tree: ExportTree, spaces: ExportSpace[]): TargetWorkspaceTree {
  if (!Array.isArray(tree.spaces)) {
    throw new Error('tree.json has no spaces array');
  }
  const colorById = new Map<string, string>();
  for (const s of spaces) colorById.set(s.id, s.color);

  const mappedSpaces: TargetSpaceNode[] = tree.spaces.map((space) => {
    if (!space.id) throw new Error('tree.json contains a space with no id');

    const folderlessLists: TargetListNode[] = Array.isArray(space.folderlessLists)
      ? space.folderlessLists.map(mapList)
      : [];

    const folders: TargetFolderNode[] = Array.isArray(space.folders)
      ? space.folders.map((folder) => ({
          id: folder.id,
          name: folder.name ?? 'Untitled',
          lists: Array.isArray(folder.lists) ? folder.lists.map(mapList) : [],
        }))
      : [];

    return {
      id: space.id,
      name: space.name ?? 'Untitled',
      color: colorById.get(space.id) ?? DEFAULT_SPACE_COLOR,
      folderlessLists,
      folders,
    };
  });

  return { spaces: mappedSpaces };
}
