/**
 * Filesystem IO for the apps/web feeder: defensive JSON loading, export-bundle
 * assembly, backup of existing target files, and stable JSON writing.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import type {
  ExportBundle,
  ExportDoc,
  ExportDocPages,
  ExportMemberEntry,
  ExportSpace,
  ExportTask,
  ExportTree,
  ExportWorkspace,
} from './types';

/** Read + parse a JSON file, asserting its top-level kind. Fails loud. */
function readJson<T>(path: string, expect: 'array' | 'object'): T {
  if (!existsSync(path)) {
    throw new Error(`Missing required export file: ${path}`);
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`);
  }
  const isArray = Array.isArray(parsed);
  if (expect === 'array' && !isArray) {
    throw new Error(`Expected a JSON array in ${path}, got ${typeof parsed}`);
  }
  if (expect === 'object' && (isArray || parsed === null || typeof parsed !== 'object')) {
    throw new Error(`Expected a JSON object in ${path}, got ${isArray ? 'array' : typeof parsed}`);
  }
  return parsed as T;
}

/** Load + validate the full ClickUp export bundle the mappers consume. */
export function loadExportBundle(dir: string): ExportBundle {
  if (!existsSync(dir)) {
    throw new Error(`Export directory does not exist: ${dir}`);
  }
  const workspace = readJson<ExportWorkspace>(join(dir, 'workspace.json'), 'object');
  const members = readJson<ExportMemberEntry[]>(join(dir, 'members.json'), 'array');
  const tasks = readJson<ExportTask[]>(join(dir, 'tasks.json'), 'array');
  const tree = readJson<ExportTree>(join(dir, 'tree.json'), 'object');
  const spaces = readJson<ExportSpace[]>(join(dir, 'spaces.json'), 'array');
  const docs = readJson<ExportDoc[]>(join(dir, 'docs.json'), 'array');
  const docPages = readJson<ExportDocPages[]>(join(dir, 'doc-pages.json'), 'array');

  if (!Array.isArray(tree.spaces)) {
    throw new Error(`tree.json is missing a "spaces" array in ${dir}`);
  }
  if (!Array.isArray(workspace.members)) {
    throw new Error(`workspace.json is missing a "members" array in ${dir}`);
  }

  return { dir, workspace, members, tasks, tree, spaces, docs, docPages };
}

/** Read a prior target JSON file (for merge-preserve), or null if absent. */
export function readExistingJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Pretty-print JSON with a trailing newline (matches repo convention). */
export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Back up every existing file in `outDir` into a timestamped subdir so a
 * regeneration is reversible. Returns the backup dir, or null if outDir was
 * empty / absent (nothing to preserve).
 */
export function backupOutDir(outDir: string, stamp: string): string | null {
  if (!existsSync(outDir)) return null;
  const entries = readdirSync(outDir, { withFileTypes: true }).filter(
    (e) => e.isFile() && !e.name.startsWith('.'),
  );
  if (entries.length === 0) return null;

  const backupDir = join(outDir, `.backup-${stamp}`);
  mkdirSync(backupDir, { recursive: true });
  for (const entry of entries) {
    copyFileSync(join(outDir, entry.name), join(backupDir, entry.name));
  }
  return backupDir;
}

/** Ensure an output directory exists. */
export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * Scan a crawl directory's `states/<id>/state.json` files for objects matching
 * a predicate. Defensive: skips unreadable/malformed states, never throws.
 * Returns the first non-null result of `pick`, or null when nothing matched.
 */
export function scanCrawlStates<T>(
  crawlDir: string,
  pick: (state: unknown, statePath: string) => T | null,
): T | null {
  const statesDir = join(crawlDir, 'states');
  if (!existsSync(statesDir)) return null;
  let dirs: string[];
  try {
    dirs = readdirSync(statesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
  for (const name of dirs) {
    const statePath = join(statesDir, name, 'state.json');
    if (!existsSync(statePath)) continue;
    let state: unknown;
    try {
      state = JSON.parse(readFileSync(statePath, 'utf8'));
    } catch {
      continue;
    }
    try {
      const hit = pick(state, statePath);
      if (hit != null) return hit;
    } catch {
      // ignore picker failures on a single state
    }
  }
  return null;
}

/**
 * Iterate a crawl `network.jsonl` line by line, parsing each JSON line
 * defensively. Malformed lines are skipped. `onEntry` may short-circuit by
 * returning a non-undefined value, which is then returned.
 */
export function scanNetworkJsonl<T>(
  crawlDir: string,
  onEntry: (entry: unknown) => T | undefined,
): T | undefined {
  const path = join(crawlDir, 'network.jsonl');
  if (!existsSync(path)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const hit = onEntry(entry);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Short list of regular file names in a dir (for reporting). */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

export { basename };
