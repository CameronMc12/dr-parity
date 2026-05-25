#!/usr/bin/env tsx
/**
 * Phase 2 webapp crawler CLI.
 *
 * Launches a persistent-profile Chrome session, navigates to <startUrl>,
 * and BFS-explores reachable UI states (clicks, right-clicks). Produces a
 * state graph plus per-state DOM/screenshot/meta artifacts under <out>.
 *
 * Usage:
 *   tsx scripts/crawl-webapp.ts <startUrl> [options]
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runCrawler } from '../engine/targets/webapp/crawler';
import type { CrawlOptions } from '../engine/targets/webapp/crawler';

type CliArgs = {
  startUrl?: string;
  out?: string;
  maxDepth: number;
  maxTime: number;
  maxStates: number;
  userDataDir: string;
  viewport: { width: number; height: number };
  dryRun: boolean;
  aggressive: boolean;
  captureJs: boolean;
  blocklistPath?: string;
  help: boolean;
};

const HELP = `
dr-parity webapp crawler

Usage:
  tsx scripts/crawl-webapp.ts <startUrl> [options]

Options:
  --out=<dir>             Output directory (default: docs/research/crawl/<host>/<iso>)
  --max-depth=<n>         Max BFS depth (default: 6)
  --max-time=<seconds>    Max crawl duration in seconds (default: 600)
  --max-states=<n>        Max unique states (default: 500)
  --user-data-dir=<path>  Persistent Chrome profile (default: ~/.config/playwright-pinterest)
  --viewport=<wxh>        Viewport e.g. 1440x900 (default: 1440x900)
  --blocklist=<path>      Extra blocklist file (one phrase per line)
  --dry-run               List interactive elements on the start page, no clicks
  --aggressive            Wired but currently still safe (reserved for future)
  --full-js, --for-replay Capture FULL JS bundles (uncapped) for the replay
                          target. Source maps stay stripped. Default off.
  -h, --help              Show this help
`.trim();

function defaultUserDataDir(): string {
  return join(homedir(), '.config', 'playwright-pinterest');
}

function parseViewport(value: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid --viewport "${value}". Expected e.g. 1440x900`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    startUrl: undefined,
    maxDepth: 6,
    maxTime: 600,
    maxStates: 500,
    userDataDir: defaultUserDataDir(),
    viewport: { width: 1440, height: 900 },
    dryRun: false,
    aggressive: false,
    captureJs: false,
    help: false,
  };

  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (raw === '--aggressive') {
      out.aggressive = true;
      continue;
    }
    if (raw === '--full-js' || raw === '--for-replay') {
      out.captureJs = true;
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
      continue;
    }
    if (raw.startsWith('--max-depth=')) {
      out.maxDepth = Number(raw.slice('--max-depth='.length));
      continue;
    }
    if (raw.startsWith('--max-time=')) {
      out.maxTime = Number(raw.slice('--max-time='.length));
      continue;
    }
    if (raw.startsWith('--max-states=')) {
      out.maxStates = Number(raw.slice('--max-states='.length));
      continue;
    }
    if (raw.startsWith('--user-data-dir=')) {
      out.userDataDir = raw.slice('--user-data-dir='.length);
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      out.viewport = parseViewport(raw.slice('--viewport='.length));
      continue;
    }
    if (raw.startsWith('--blocklist=')) {
      out.blocklistPath = raw.slice('--blocklist='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    positional.push(raw);
  }

  out.startUrl = positional[0];
  return out;
}

function validateUrl(input: string | undefined): URL {
  if (!input) throw new Error('Missing <startUrl>. Run with --help for usage.');
  try {
    return new URL(input);
  } catch {
    throw new Error(`Invalid URL: "${input}"`);
  }
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function loadBlocklist(path: string | undefined): string[] {
  if (!path) return [];
  if (!existsSync(path)) throw new Error(`Blocklist file not found: ${path}`);
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const url = validateUrl(args.startUrl);
  const outDir =
    args.out ?? join('docs', 'research', 'crawl', url.hostname, isoStamp());
  mkdirSync(outDir, { recursive: true });

  const extraBlocklist = loadBlocklist(args.blocklistPath);

  const opts: CrawlOptions = {
    startUrl: url.toString(),
    outDir,
    maxDepth: args.maxDepth,
    maxTime: args.maxTime,
    maxStates: args.maxStates,
    userDataDir: args.userDataDir,
    viewport: args.viewport,
    dryRun: args.dryRun,
    aggressive: args.aggressive,
    extraBlocklist,
    captureJs: args.captureJs,
  };

  console.log(`[crawl] startUrl    : ${opts.startUrl}`);
  console.log(`[crawl] outDir      : ${opts.outDir}`);
  console.log(`[crawl] viewport    : ${opts.viewport.width}x${opts.viewport.height}`);
  console.log(`[crawl] maxDepth    : ${opts.maxDepth}`);
  console.log(`[crawl] maxTime     : ${opts.maxTime}s`);
  console.log(`[crawl] maxStates   : ${opts.maxStates}`);
  console.log(`[crawl] userDataDir : ${opts.userDataDir}`);
  console.log(`[crawl] dryRun      : ${opts.dryRun}`);
  console.log(`[crawl] aggressive  : ${opts.aggressive}`);
  console.log(`[crawl] captureJs   : ${opts.captureJs} (replay full-JS)`);
  console.log(`[crawl] blocklist   : ${extraBlocklist.length} extra phrases`);

  const summary = await runCrawler(opts);

  console.log('[crawl] done');
  console.log(`  states     : ${summary.stateCount}`);
  console.log(`  edges      : ${summary.edgeCount}`);
  console.log(`  durationMs : ${summary.durationMs}`);
  console.log(`  blocked    : ${summary.blocked}`);
  console.log(`  errors     : ${summary.errors}`);
  console.log(`  signatures : ${summary.signaturesFound.join(', ') || 'none'}`);
  console.log(`  reached    : ${summary.reachedLimit}`);
}

main().catch((err) => {
  console.error('[crawl] fatal:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
