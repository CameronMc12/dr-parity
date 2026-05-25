#!/usr/bin/env tsx
/**
 * Replay target CLI. Emits a self-contained static site that serves a captured
 * SPA's REAL bootstrap HTML + JS bundle offline and answers every network call
 * from the recorded traffic, so the original app boots and renders functionally
 * without its live backend.
 *
 * Usage:
 *   tsx scripts/build-replay.ts --crawl-dir=<path> [--out=<dir>] [--force]
 *                               [--unrecorded=empty-200|bypass] [--name=<slug>]
 *   tsx scripts/build-replay.ts --help
 *
 * The crawl directory must contain network.jsonl (with the original navigation
 * document HTML + JS/CSS/font/image bodies), and optionally websocket.jsonl,
 * graph.json, and storage-state.json.
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { emitReplay } from '../engine/targets/webapp/replay/index';
import type { UnrecordedMode } from '../engine/targets/webapp/replay/types';

interface ParsedArgs {
  help: boolean;
  crawlDir: string | null;
  outDir: string | null;
  force: boolean;
  unrecorded: UnrecordedMode;
  name: string | null;
  bridgeExport: string | null;
}

const HELP = `Usage:
  tsx scripts/build-replay.ts --crawl-dir=<path> [options]

Required:
  --crawl-dir=<path>            Crawl directory with network.jsonl (original
                                navigation HTML + JS/CSS/asset bodies), and
                                optionally websocket.jsonl, graph.json,
                                storage-state.json.

Options:
  --out=<dir>                   Output directory. Defaults to a sibling
                                'replay-site/' next to the crawl directory.
  --unrecorded=<mode>           How unrecorded requests are answered.
                                'empty-200' (default) returns {} as 200 JSON so
                                the app stays alive; 'bypass' hits the network.
  --name=<slug>                 Project name in replay-manifest.json.
  --bridge-export=<dir>         ADDITIVE. Path to a ClickUp export directory.
                                When set, the build merges synthetic
                                INTERNAL-shape recordings for every list/space in
                                the export, so the replay renders lists the crawl
                                never captured. Absent: behaviour is unchanged.
  --force                       Overwrite the output directory if it exists.
  --help                        Show this help text.`;

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    crawlDir: null,
    outDir: null,
    force: false,
    unrecorded: 'empty-200',
    name: null,
    bridgeExport: null,
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      result.help = true;
    } else if (raw === '--force') {
      result.force = true;
    } else if (raw.startsWith('--crawl-dir=')) {
      result.crawlDir = raw.slice('--crawl-dir='.length);
    } else if (raw.startsWith('--out=')) {
      result.outDir = raw.slice('--out='.length);
    } else if (raw.startsWith('--out-dir=')) {
      result.outDir = raw.slice('--out-dir='.length);
    } else if (raw.startsWith('--unrecorded=')) {
      const value = raw.slice('--unrecorded='.length);
      if (value !== 'empty-200' && value !== 'bypass') {
        throw new Error(`Invalid --unrecorded value "${value}". Use empty-200 or bypass.`);
      }
      result.unrecorded = value;
    } else if (raw.startsWith('--name=')) {
      result.name = raw.slice('--name='.length);
    } else if (raw.startsWith('--bridge-export=')) {
      result.bridgeExport = raw.slice('--bridge-export='.length);
    } else if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    } else if (result.crawlDir === null) {
      result.crawlDir = raw;
    } else {
      throw new Error(`Unexpected positional argument: ${raw}`);
    }
  }
  return result;
}

function assertValidCrawlDir(crawlDir: string): void {
  if (!existsSync(crawlDir)) {
    throw new Error(`Crawl directory does not exist: ${crawlDir}`);
  }
  if (!statSync(crawlDir).isDirectory()) {
    throw new Error(`Crawl path is not a directory: ${crawlDir}`);
  }
  const networkPath = join(crawlDir, 'network.jsonl');
  if (!existsSync(networkPath)) {
    throw new Error(`Crawl directory missing network.jsonl (looked for ${networkPath}).`);
  }
}

function defaultOutDir(crawlDir: string): string {
  return join(dirname(resolve(crawlDir)), 'replay-site');
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(HELP);
    process.exit(2);
    return;
  }

  if (parsed.help || parsed.crawlDir === null) {
    console.log(HELP);
    process.exit(parsed.help ? 0 : 2);
    return;
  }

  const crawlDir = resolve(parsed.crawlDir);
  try {
    assertValidCrawlDir(crawlDir);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  const outDir = parsed.outDir
    ? isAbsolute(parsed.outDir)
      ? parsed.outDir
      : resolve(parsed.outDir)
    : defaultOutDir(crawlDir);

  try {
    const bridgeExportDir = parsed.bridgeExport
      ? isAbsolute(parsed.bridgeExport)
        ? parsed.bridgeExport
        : resolve(parsed.bridgeExport)
      : null;

    const result = await emitReplay({
      crawlDir,
      outDir,
      force: parsed.force,
      unrecordedMode: parsed.unrecorded,
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(bridgeExportDir ? { bridgeExportDir } : {}),
    });

    const m = result.manifest;
    console.log(`\nWrote replay project: ${result.outDir}`);
    console.log(`Bootstrap document: ${m.bootstrapUrl}`);
    console.log(`Assets localized: ${m.assetCount}`);
    console.log(`Backfilled ${m.backfilledCount} CDN assets, ${m.backfillFailedCount} failed`);
    console.log(`Recordings: ${m.recordingCount}`);
    console.log(
      `Bridge recordings: ${m.bridgeRecordingCount} (${m.bridgeListCount} lists from export)`,
    );
    console.log(`WS connections: ${m.wsConnectionCount} (${m.wsFrameCount} frames)`);
    console.log(`Storage seeded: ${m.storageSeeded ? 'yes' : 'no'}`);
    console.log(
      `IndexedDB seeded: ${m.idbSeeded ? 'yes' : 'no'} (${m.idbDatabases} databases, ${m.idbRecords} records)`,
    );
    console.log(`Unrecorded mode: ${m.unrecordedMode}`);
    if (m.warnings.length > 0) {
      console.log(`Warnings: ${m.warnings.length}`);
      for (const w of m.warnings.slice(0, 8)) console.log(`  - ${w}`);
    }
    console.log(`\nServe it:\n  ${result.serveCommand}`);
  } catch (err) {
    console.error(`build:replay failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
