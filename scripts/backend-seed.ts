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
import { seedEventStore } from '../engine/targets/webapp/backend/cqrs/seed-from-export';

const DEFAULT_EXPORT = 'docs/research/clickup-export/2026-05-25T16-21-00-615Z';
const DEFAULT_OUT = '.runs/backend/store.json';
const DEFAULT_EVENTS = '.runs/backend/events.db';

function parseArgs(argv: string[]): { exportDir: string; outPath: string; eventsPath: string } {
  let exportDir = DEFAULT_EXPORT;
  let outPath = DEFAULT_OUT;
  let eventsPath = DEFAULT_EVENTS;
  for (const raw of argv) {
    if (raw.startsWith('--export=')) exportDir = raw.slice('--export='.length);
    else if (raw.startsWith('--out=')) outPath = raw.slice('--out='.length);
    else if (raw.startsWith('--events=')) eventsPath = raw.slice('--events='.length);
    else if (!raw.startsWith('--')) exportDir = raw;
  }
  return {
    exportDir: isAbsolute(exportDir) ? exportDir : resolve(exportDir),
    outPath: isAbsolute(outPath) ? outPath : resolve(outPath),
    eventsPath: isAbsolute(eventsPath) ? eventsPath : resolve(eventsPath),
  };
}

function main(): void {
  const { exportDir, outPath, eventsPath } = parseArgs(process.argv.slice(2));

  // 1. Reference-data snapshot (workspace/members/spaces/lists/customFields/tree
  //    + the original rich export tasks). The event-backed store overlays its
  //    live projection on top of these rows.
  const snapshot = seedSnapshot(exportDir);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot), 'utf8');

  // 2. Event store: one TaskCreated per export task, then rebuild the projection.
  //    Reads are served from this projection so a later write is reflected.
  const seeded = seedEventStore(exportDir, eventsPath, true);

  console.log(`Seeded backend store -> ${outPath}`);
  console.log(`  workspace: ${snapshot.workspaceId} (${(snapshot.workspace?.name as string) ?? '?'})`);
  console.log(`  members:   ${snapshot.members.length}`);
  console.log(`  spaces:    ${snapshot.spaces.length}`);
  console.log(`  folders:   ${snapshot.folders.length}`);
  console.log(`  lists:     ${snapshot.lists.length}`);
  console.log(`  tasks:     ${snapshot.tasks.length}`);
  console.log(`  customFld: ${snapshot.customFields.length} lists`);
  console.log(`Seeded event store -> ${seeded.eventsDbPath}`);
  console.log(`  appended:  ${seeded.appended} TaskCreated events`);
  console.log(`  projected: ${seeded.projected} tasks across ${seeded.lists} lists`);
}

main();
