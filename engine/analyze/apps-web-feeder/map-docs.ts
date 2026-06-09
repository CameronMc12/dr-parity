/**
 * Map ClickUp export docs + doc pages into the apps/web DocNode tree and the
 * DocPages bodies.
 *
 * docs.json `parent` resolves the sidebar "location":
 *   type 4 -> space name, type 5 -> folder name, type 1 -> parent task name.
 * Other parent types (e.g. 15 = Onboarding Assistant memory) have no place in
 * the structural tree and are dropped from the sidebar (matching the prior
 * hand-built docs-tree, which also omitted them).
 *
 * The export carries neither the doc emoji nor the real sidebar `pageCount`
 * (the export's doc-pages count differs from ClickUp's displayed count). Both
 * are crawl/UI-derived, so they are PRESERVED from the prior docs-tree.json
 * when a matching doc id exists, and fall back to (null / export page count)
 * otherwise.
 */

import type {
  ExportBundle,
  ExportTask,
  TargetDocNode,
  TargetDocPages,
} from './types';

const PARENT_TYPE_TASK = 1;
const PARENT_TYPE_SPACE = 4;
const PARENT_TYPE_FOLDER = 5;

interface NameMaps {
  spaceName: Map<string, string>;
  folderName: Map<string, string>;
  taskName: Map<string, string>;
}

function buildNameMaps(bundle: ExportBundle): NameMaps {
  const spaceName = new Map<string, string>();
  const folderName = new Map<string, string>();
  const taskName = new Map<string, string>();

  for (const space of bundle.tree.spaces) {
    if (space.id) spaceName.set(space.id, space.name ?? '');
    for (const folder of space.folders ?? []) {
      if (folder.id) folderName.set(folder.id, folder.name ?? '');
    }
  }
  for (const task of bundle.tasks as ExportTask[]) {
    if (task.id) taskName.set(task.id, task.name ?? '');
  }
  return { spaceName, folderName, taskName };
}

/** Resolve the sidebar location string for a doc, or null when unplaceable. */
function resolveLocation(
  parent: { id: string; type: number } | undefined,
  maps: NameMaps,
): string | null {
  if (!parent) return null;
  switch (parent.type) {
    case PARENT_TYPE_SPACE:
      return maps.spaceName.get(parent.id) ?? null;
    case PARENT_TYPE_FOLDER:
      return maps.folderName.get(parent.id) ?? null;
    case PARENT_TYPE_TASK:
      return maps.taskName.get(parent.id) ?? null;
    default:
      return null;
  }
}

export interface DocsResult {
  tree: TargetDocNode[];
  pages: TargetDocPages[];
  /** doc ids dropped because their parent could not be placed in the tree. */
  dropped: string[];
}

export function mapDocs(
  bundle: ExportBundle,
  priorTree: TargetDocNode[] | null,
): DocsResult {
  const maps = buildNameMaps(bundle);

  const priorById = new Map<string, TargetDocNode>();
  for (const node of priorTree ?? []) priorById.set(node.id, node);

  const exportPageCount = new Map<string, number>();
  for (const dp of bundle.docPages) {
    exportPageCount.set(dp.docId, Array.isArray(dp.pages) ? dp.pages.length : 0);
  }

  const tree: TargetDocNode[] = [];
  const dropped: string[] = [];

  for (const doc of bundle.docs) {
    if (!doc.id) continue;
    const location = resolveLocation(doc.parent, maps);
    if (location == null) {
      dropped.push(doc.id);
      continue;
    }
    const prior = priorById.get(doc.id);
    tree.push({
      id: doc.id,
      name: doc.name ?? 'Untitled',
      location,
      // Export cannot reproduce emoji/displayed pageCount — preserve prior UI.
      emoji: prior?.emoji ?? null,
      pageCount: prior?.pageCount ?? exportPageCount.get(doc.id) ?? 0,
      updated: doc.date_updated ?? prior?.updated ?? 0,
    });
  }

  // Sort by updated descending to match ClickUp's "Recent" ordering.
  tree.sort((a, b) => b.updated - a.updated);

  const pages: TargetDocPages[] = bundle.docPages.map((dp) => ({
    docId: dp.docId,
    name: dp.name ?? 'Untitled',
    pages: (Array.isArray(dp.pages) ? dp.pages : [])
      .map((p) => ({
        id: p.id,
        name: p.name ?? 'Untitled',
        content: typeof p.content === 'string' ? p.content : '',
        orderIndex: p.order_index ?? 0,
        dateUpdated: p.date_updated ?? null,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex),
  }));

  return { tree, pages, dropped };
}
