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
import { resolveProfile } from '../engine/targets/webapp/profiles';

type CliArgs = {
  startUrl?: string;
  out?: string;
  maxDepth: number;
  maxTime: number;
  maxStates: number;
  routeBudget?: number;
  settleMs?: number;
  scrollCapture: boolean;
  keyboardHarness: boolean;
  dndHarness: boolean;
  hoverHarness: boolean;
  interactionDelayMs?: number;
  userDataDir: string;
  viewport: { width: number; height: number };
  dryRun: boolean;
  aggressive: boolean;
  captureJs: boolean;
  proxyServer?: string;
  bypassServiceWorker: boolean;
  blocklistPath?: string;
  profile?: string;
  noDiscoverers: boolean;
  scopePrefix?: string;
  sanityReset?: boolean;
  headless?: boolean;
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
  --route-budget=<n>      Max interactions (clicks/right-clicks) spent inside a
                          single route before moving on (default: 60). Raise it
                          for deeper per-route coverage of modal/overlay states.
  --settle-ms=<n>         Extra wait (ms) AFTER the load/idle/steady-state wait
                          but BEFORE each route's base DOM snapshot. Lets
                          data-driven views (ClickUp task grids) render backend
                          rows before capture. Default 0 (no extra wait).
  --scroll-capture        Scroll the primary grid/list container to the bottom
                          (then back to top) BEFORE the base snapshot to trigger
                          lazy/virtualized rows + lazy images. Default off.
  --no-keyboard           Disable the L5 keyboard harness (Cmd/Ctrl+K command
                          center, slash menu, curated safe hotkey sweep).
                          Default ON.
  --no-dnd                Disable the drag-and-drop harness (reversible drags
                          when a dnd-kit / react-beautiful-dnd / native-draggable
                          signature is present). Default ON.
  --no-hover              Disable the L4 hover-as-state harness (hover-triggered
                          tooltips / popovers). Default ON.
  --interaction-delay-ms=<n>
                          Inter-interaction throttle (ms) for the extended
                          harnesses to stay under rate limits. Default: env
                          DRPARITY_INTERACTION_DELAY_MS, then a 400-800ms jitter.
  --user-data-dir=<path>  Persistent Chrome profile (default: ~/.config/playwright-pinterest)
  --viewport=<wxh>        Viewport e.g. 1440x900 (default: 1440x900)
  --blocklist=<path>      Extra blocklist file (one phrase per line)
  --dry-run               List interactive elements on the start page, no clicks
  --aggressive            Wired but currently still safe (reserved for future)
  --full-js, --for-replay Capture FULL JS bundles (uncapped) for the replay
                          target. Source maps stay stripped. Default off.
  --proxy=<host:port>     Route Chromium through an external transport-capture
                          proxy (e.g. mitmdump) and disable QUIC. Opt-in; the
                          proxy CA must be trusted by the profile for TLS.
  --bypass-sw             Explicitly enforce service-worker bypass on capture.
  --profile=<name>        Webapp profile to apply (additive route discoverers).
                          Default: auto-resolve by host (falls back to "default"
                          which is bytewise-identical to pre-profile behaviour).
                          Known profiles: default, clickup.
  --no-discoverers        FOCUSED CRAWL. Disable the profile route-discoverers
                          (bootstrap-corpus + page sidebar expander) so the
                          frontier is the start URL plus whatever the in-page
                          interaction harnesses surface. Keeps a smoke/focus run
                          ON the start route instead of flooding it with stale
                          corpus seeds. Default off (discoverers run).
  --scope-prefix=<url>    FOCUSED CRAWL. Only enqueue routes whose normalised URL
                          starts with this prefix (the start URL is always
                          allowed). Confines the crawl to a sub-tree (e.g. a
                          single List view) so the harnesses fire. Default: none.
  --sanity-reset          Run sanityReset(page) once after the first authenticated
                          nav, returning the UI to a pristine default baseline
                          (no chat/home panel leak, no stray overlays) before
                          discovery + first capture. DEFAULT ON for focused runs
                          (--no-discoverers / --focus); off otherwise.
  --no-sanity-reset       Force-disable the sanity reset even in focused runs.
  --headless              Launch the persistent-profile Chrome headless. Default
                          off (headed), so behaviour is unchanged unless set.
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
    bypassServiceWorker: false,
    scrollCapture: false,
    keyboardHarness: true,
    dndHarness: true,
    hoverHarness: true,
    noDiscoverers: false,
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
    if (raw === '--bypass-sw') {
      out.bypassServiceWorker = true;
      continue;
    }
    if (raw === '--scroll-capture') {
      out.scrollCapture = true;
      continue;
    }
    if (raw === '--no-keyboard') {
      out.keyboardHarness = false;
      continue;
    }
    if (raw === '--no-dnd') {
      out.dndHarness = false;
      continue;
    }
    if (raw === '--no-hover') {
      out.hoverHarness = false;
      continue;
    }
    if (raw === '--no-discoverers' || raw === '--focus') {
      out.noDiscoverers = true;
      continue;
    }
    if (raw === '--sanity-reset') {
      out.sanityReset = true;
      continue;
    }
    if (raw === '--no-sanity-reset') {
      out.sanityReset = false;
      continue;
    }
    if (raw === '--headless') {
      out.headless = true;
      continue;
    }
    if (raw.startsWith('--scope-prefix=')) {
      out.scopePrefix = raw.slice('--scope-prefix='.length);
      continue;
    }
    if (raw.startsWith('--interaction-delay-ms=')) {
      const value = Number(raw.slice('--interaction-delay-ms='.length));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --interaction-delay-ms "${raw}". Expected a non-negative integer (ms).`);
      }
      out.interactionDelayMs = value;
      continue;
    }
    if (raw.startsWith('--proxy=')) {
      out.proxyServer = raw.slice('--proxy='.length);
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
    if (raw.startsWith('--route-budget=')) {
      const value = Number(raw.slice('--route-budget='.length));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --route-budget "${raw}". Expected a positive integer.`);
      }
      out.routeBudget = value;
      continue;
    }
    if (raw.startsWith('--settle-ms=')) {
      const value = Number(raw.slice('--settle-ms='.length));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --settle-ms "${raw}". Expected a non-negative integer (ms).`);
      }
      out.settleMs = value;
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
    if (raw.startsWith('--profile=')) {
      out.profile = raw.slice('--profile='.length);
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

  const profile = resolveProfile(url.host, args.profile);

  const opts: CrawlOptions = {
    startUrl: url.toString(),
    outDir,
    maxDepth: args.maxDepth,
    maxTime: args.maxTime,
    maxStates: args.maxStates,
    ...(args.routeBudget !== undefined ? { routeBudget: args.routeBudget } : {}),
    ...(args.settleMs !== undefined ? { settleMs: args.settleMs } : {}),
    scrollCapture: args.scrollCapture,
    keyboardHarness: args.keyboardHarness,
    dndHarness: args.dndHarness,
    hoverHarness: args.hoverHarness,
    ...(args.interactionDelayMs !== undefined
      ? { interactionDelayMs: args.interactionDelayMs }
      : {}),
    userDataDir: args.userDataDir,
    viewport: args.viewport,
    dryRun: args.dryRun,
    aggressive: args.aggressive,
    extraBlocklist,
    captureJs: args.captureJs,
    proxyServer: args.proxyServer,
    bypassServiceWorker: args.bypassServiceWorker,
    profile,
    noDiscoverers: args.noDiscoverers,
    ...(args.scopePrefix !== undefined ? { scopePrefix: args.scopePrefix } : {}),
    // Default ON for focused runs (--no-discoverers / --focus), unless explicitly
    // overridden by --sanity-reset / --no-sanity-reset.
    sanityReset: args.sanityReset ?? args.noDiscoverers,
    headless: args.headless,
  };

  console.log(`[crawl] startUrl    : ${opts.startUrl}`);
  console.log(`[crawl] outDir      : ${opts.outDir}`);
  console.log(`[crawl] viewport    : ${opts.viewport.width}x${opts.viewport.height}`);
  console.log(`[crawl] maxDepth    : ${opts.maxDepth}`);
  console.log(`[crawl] maxTime     : ${opts.maxTime}s`);
  console.log(`[crawl] maxStates   : ${opts.maxStates}`);
  console.log(`[crawl] routeBudget : ${opts.routeBudget ?? 'default (60)'}`);
  console.log(`[crawl] settleMs    : ${opts.settleMs ?? 0} (pre-capture data settle)`);
  console.log(`[crawl] scrollCap   : ${opts.scrollCapture} (pre-capture scroll pass)`);
  console.log(`[crawl] harnesses   : kbd=${opts.keyboardHarness} dnd=${opts.dndHarness} hover=${opts.hoverHarness}`);
  console.log(`[crawl] intDelayMs  : ${opts.interactionDelayMs ?? 'env/default (400-800 jitter)'}`);
  console.log(`[crawl] userDataDir : ${opts.userDataDir}`);
  console.log(`[crawl] headless    : ${opts.headless ?? false}`);
  console.log(`[crawl] dryRun      : ${opts.dryRun}`);
  console.log(`[crawl] aggressive  : ${opts.aggressive}`);
  console.log(`[crawl] captureJs   : ${opts.captureJs} (replay full-JS)`);
  console.log(`[crawl] proxy       : ${opts.proxyServer ?? 'none'}`);
  console.log(`[crawl] bypass-sw   : ${opts.bypassServiceWorker ?? false}`);
  console.log(`[crawl] blocklist   : ${extraBlocklist.length} extra phrases`);
  console.log(`[crawl] profile     : ${profile.name} (discoverers=${profile.discoverers?.length ?? 0})`);
  console.log(`[crawl] noDiscover  : ${opts.noDiscoverers} (focus mode)`);
  console.log(`[crawl] scopePrefix : ${opts.scopePrefix ?? 'none'}`);
  console.log(`[crawl] sanityReset : ${opts.sanityReset ?? false}`);

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
