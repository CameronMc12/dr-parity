/**
 * Feeder orchestration: load the export, map every entity, back up the target
 * dir, and write the regenerated apps/web data files. Pure of CLI concerns —
 * the script in scripts/ parses argv and calls runFeeder().
 */

import { join } from 'node:path';
import {
  backupOutDir,
  ensureDir,
  listFiles,
  loadExportBundle,
  readExistingJson,
  writeJson,
} from './io';
import { mapMembers } from './map-members';
import { mapTasks } from './map-tasks';
import { mapTree } from './map-tree';
import { mapDocs } from './map-docs';
import type { TargetDocNode } from './types';

export interface FeederOptions {
  exportDir: string;
  crawlDir: string;
  outDir: string;
}

export interface FeederReport {
  outDir: string;
  backupDir: string | null;
  written: string[];
  skipped: { file: string; reason: string }[];
  counts: {
    members: number;
    tasks: number;
    spaces: number;
    folders: number;
    lists: number;
    docs: number;
    docPages: number;
    droppedDocs: number;
  };
}

/** Files the feeder owns and regenerates. */
const REGENERATED = [
  'members-seed.json',
  'tasks-seed.json',
  'workspace-tree.json',
  'docs-tree.json',
  'doc-pages.json',
] as const;

/**
 * Files the export cannot cleanly reproduce. Left untouched and reported as
 * skipped so working hand-tuned data is never blanked out.
 */
const PRESERVED: { file: string; reason: string }[] = [
  { file: 'home-dashboard.ts', reason: 'RECENTS/MY_WORK widgets are crawl/UI-derived; no clean export source' },
  { file: 'sidebar-sections.ts', reason: 'sidebar pinned/expanded layout is UI state; no export source' },
  { file: 'status-order.ts', reason: 'hand-tuned status orderindex map; not 1:1 reproducible from export' },
  { file: 'status-set.ts', reason: 'hand-tuned status palette/order; not 1:1 reproducible from export' },
  { file: 'workspace-tree.ts', reason: 'TS wrapper + VIEW_TO_LIST map; regenerated json is consumed via it' },
  { file: 'docs-tree.ts', reason: 'TS wrapper that re-exports docs-tree.json' },
];

export function runFeeder(options: FeederOptions): FeederReport {
  const { exportDir, crawlDir, outDir } = options;

  const bundle = loadExportBundle(exportDir);
  ensureDir(outDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = backupOutDir(outDir, stamp);

  // Preserve emoji + pageCount from any prior docs-tree in the target dir.
  const priorDocsTree = readExistingJson<TargetDocNode[]>(join(outDir, 'docs-tree.json'));

  const members = mapMembers(bundle.members);
  const tasks = mapTasks(bundle.tasks);
  const tree = mapTree(bundle.tree, bundle.spaces);
  const docs = mapDocs(bundle, priorDocsTree);

  writeJson(join(outDir, 'members-seed.json'), members);
  writeJson(join(outDir, 'tasks-seed.json'), tasks);
  writeJson(join(outDir, 'workspace-tree.json'), tree);
  writeJson(join(outDir, 'docs-tree.json'), docs.tree);
  writeJson(join(outDir, 'doc-pages.json'), docs.pages);

  const folders = tree.spaces.reduce((n, s) => n + s.folders.length, 0);
  const lists = tree.spaces.reduce(
    (n, s) => n + s.folderlessLists.length + s.folders.reduce((m, f) => m + f.lists.length, 0),
    0,
  );

  // crawlDir is accepted for forward-compat (emoji/widget enrichment) but the
  // current pass only validates its presence — record it for the report.
  const skipped = [...PRESERVED];
  if (!listFiles(crawlDir).length && !listFiles(join(crawlDir, 'states')).length) {
    skipped.push({ file: '(crawl enrichment)', reason: `crawl dir not found or empty: ${crawlDir}` });
  }

  return {
    outDir,
    backupDir,
    written: [...REGENERATED],
    skipped,
    counts: {
      members: members.length,
      tasks: tasks.length,
      spaces: tree.spaces.length,
      folders,
      lists,
      docs: docs.tree.length,
      docPages: docs.pages.reduce((n, d) => n + d.pages.length, 0),
      droppedDocs: docs.dropped.length,
    },
  };
}
