#!/usr/bin/env tsx
/**
 * Seed the backend store from a ClickUp export directory.
 *
 * Reads the export JSON (workspace, spaces, folders, lists, tasks, members,
 * custom fields, tree) into a flat StoreSnapshot and writes it to a `store.json`
 * the backend server loads at boot. JSON-backed today (no native deps); the same
 * snapshot file is forward-compatible with a future SQLite store.
 *
 * Usage:
 *   npm run backend:seed -- --export=<dir> [--out=<store.json>]
 *   npm run backend:seed            (uses the default export + .runs/backend/store.json)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { seedSnapshot } from '../engine/targets/webapp/backend/seed';

const DEFAULT_EXPORT = 'docs/research/clickup-export/2026-05-25T16-21-00-615Z';
const DEFAULT_OUT = '.runs/backend/store.json';

function parseArgs(argv: string[]): { exportDir: string; outPath: string } {
  let exportDir = DEFAULT_EXPORT;
  let outPath = DEFAULT_OUT;
  for (const raw of argv) {
    if (raw.startsWith('--export=')) exportDir = raw.slice('--export='.length);
    else if (raw.startsWith('--out=')) outPath = raw.slice('--out='.length);
    else if (!raw.startsWith('--')) exportDir = raw;
  }
  return {
    exportDir: isAbsolute(exportDir) ? exportDir : resolve(exportDir),
    outPath: isAbsolute(outPath) ? outPath : resolve(outPath),
  };
}

function main(): void {
  const { exportDir, outPath } = parseArgs(process.argv.slice(2));
  const snapshot = seedSnapshot(exportDir);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot), 'utf8');

  console.log(`Seeded backend store -> ${outPath}`);
  console.log(`  workspace: ${snapshot.workspaceId} (${(snapshot.workspace?.name as string) ?? '?'})`);
  console.log(`  members:   ${snapshot.members.length}`);
  console.log(`  spaces:    ${snapshot.spaces.length}`);
  console.log(`  folders:   ${snapshot.folders.length}`);
  console.log(`  lists:     ${snapshot.lists.length}`);
  console.log(`  tasks:     ${snapshot.tasks.length}`);
  console.log(`  customFld: ${snapshot.customFields.length} lists`);
}

main();
