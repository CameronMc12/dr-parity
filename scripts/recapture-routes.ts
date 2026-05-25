#!/usr/bin/env tsx
/**
 * Per-route fresh-navigation capture pass for an existing crawl directory.
 *
 * Reads `<crawl-dir>/graph.json`, identifies every unique URL pathname the
 * BFS crawler reached, navigates each one fresh with the persistent
 * Chrome profile, waits for network idle + shell-settle, then writes the
 * full document HTML to `<crawl-dir>/routes/<slug>.html`. Also writes a
 * `routes.json` manifest the inference pass picks up automatically.
 *
 * Why use this instead of a full re-crawl: the BFS crawler interleaves
 * captures with interactions, so each state's `dom.html` reflects the
 * mid-interaction view (often an overlay open, a modal showing, etc.).
 * The fresh capture pass produces a clean canonical baseline for each
 * route in O(routes) time — typically 10-30 seconds vs 6+ minutes for a
 * full re-crawl.
 *
 * Usage:
 *   tsx scripts/recapture-routes.ts --crawl-dir=<path> [options]
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { recaptureRoutes } from '../engine/targets/webapp/crawler';

interface CliArgs {
  crawlDir?: string;
  userDataDir: string;
  viewport: { width: number; height: number };
  shellSettleMs: number;
  routes?: string[];
  extraRoutes?: string[];
  help: boolean;
}

const HELP = `
dr-parity per-route fresh-navigation capture

Usage:
  tsx scripts/recapture-routes.ts --crawl-dir=<path> [options]

Options:
  --crawl-dir=<path>      REQUIRED. Existing crawl directory with graph.json.
  --user-data-dir=<path>  Persistent Chrome profile (default: ~/.config/playwright-pinterest)
  --viewport=<wxh>        Viewport (default: 1440x900)
  --shell-settle-ms=<n>   Extra wait (ms) for lazy-mounted shells (default: 2000)
  --routes=<paths>        Comma-separated route paths to capture (default: all in graph)
  --extra-routes=<paths>  Comma-separated route paths/URLs NOT in the graph to capture
                          AND inject as synthetic state nodes (so build emits them).
                          Use this when the crawler missed routes you know exist.
  -h, --help              Show help
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
    crawlDir: undefined,
    userDataDir: defaultUserDataDir(),
    viewport: { width: 1440, height: 900 },
    shellSettleMs: 2000,
    routes: undefined,
    help: false,
  };

  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw.startsWith('--crawl-dir=')) {
      out.crawlDir = raw.slice('--crawl-dir='.length);
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
    if (raw.startsWith('--shell-settle-ms=')) {
      const v = Number(raw.slice('--shell-settle-ms='.length));
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`Invalid --shell-settle-ms "${raw}"`);
      }
      out.shellSettleMs = v;
      continue;
    }
    if (raw.startsWith('--routes=')) {
      const csv = raw.slice('--routes='.length);
      out.routes = csv.split(',').map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (raw.startsWith('--extra-routes=')) {
      const csv = raw.slice('--extra-routes='.length);
      out.extraRoutes = csv.split(',').map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
  }

  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.crawlDir) {
    console.error('Missing required --crawl-dir');
    console.error(HELP);
    process.exit(2);
  }
  const absCrawlDir = resolve(args.crawlDir!);
  if (!existsSync(absCrawlDir)) {
    console.error(`Crawl directory not found: ${absCrawlDir}`);
    process.exit(2);
  }

  console.log(`[recapture] crawlDir    : ${absCrawlDir}`);
  console.log(`[recapture] userDataDir : ${args.userDataDir}`);
  console.log(`[recapture] viewport    : ${args.viewport.width}x${args.viewport.height}`);
  console.log(`[recapture] shellSettle : ${args.shellSettleMs}ms`);
  if (args.routes) {
    console.log(`[recapture] routes      : ${args.routes.join(', ')}`);
  }
  if (args.extraRoutes) {
    console.log(`[recapture] extraRoutes : ${args.extraRoutes.join(', ')}`);
  }

  const result = await recaptureRoutes({
    crawlDir: absCrawlDir,
    userDataDir: args.userDataDir,
    viewport: args.viewport,
    shellSettleMs: args.shellSettleMs,
    routePaths: args.routes,
    extraRoutes: args.extraRoutes,
  });

  console.log('[recapture] done');
  console.log(`  captured : ${result.capturedCount}`);
  console.log(`  failed   : ${result.failedCount}`);
  for (const r of result.routes) {
    console.log(`  - ${r.path}  ->  ${r.htmlPath}  (${r.title || '<no title>'})`);
  }
}

main().catch((err) => {
  console.error('[recapture] fatal:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
