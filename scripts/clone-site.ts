#!/usr/bin/env tsx
/**
 * Autonomous multi-page site clone CLI.
 *
 * Flow:
 *   1. Crawl <entry-url> (Playwright + discoverPages, depth 3, max 50 pages,
 *      robots.txt aware, 2s rate limit).
 *   2. For each discovered URL: capture -> parse:har -> parse:trace -> clone.
 *   3. Emit a single Astro project with shared components extracted ONCE.
 *
 * Usage:
 *   tsx scripts/clone-site.ts <entry-url> [options]
 *
 * Options:
 *   --max-pages=N        Hard cap on discovered pages (default 50).
 *   --max-depth=N        Crawl depth (default 3).
 *   --rate-limit-ms=N    Minimum delay between page captures (default 2000).
 *   --no-robots          Skip robots.txt enforcement.
 *   --out=<dir>          Capture root. Default: docs/research/captures.
 *   --astro-out=<dir>    Astro project output. Default: <captureRoot>/astro-site.
 *   --no-tour            Skip the scroll/hover tour during capture.
 *   --no-emit            Stop after clones; do not emit Astro project.
 *   --force              Overwrite existing Astro output dir.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { crawlSite } from '../engine/extract/site-crawler';
import { buildAstroMulti } from '../engine/targets/astro/build-multi';
import { runPostEmitMulti } from '../engine/orchestrator/post-build/post-emit-multi';

// CRAWLER-AGENT: path-prefix support (Fix #4)
interface CliArgs {
  url?: string;
  maxPages: number;
  maxDepth: number;
  rateLimitMs: number;
  respectRobots: boolean;
  out: string;
  astroOut?: string;
  tour: boolean;
  emit: boolean;
  force: boolean;
  viewports?: string;
  /** User-supplied --path-prefix value. Undefined = not set; '' = explicit disable. */
  pathPrefix?: string;
  pathPrefixExplicit: boolean;
  /** CAPTURE-AGENT: resume from .crawl-state.json (Fix #7). */
  resume: boolean;
  help: boolean;
}

const HELP_TEXT = `
dr-parity clone-site (autonomous multi-page)

Usage:
  tsx scripts/clone-site.ts <entry-url> [options]

Options:
  --max-pages=N        Hard cap on discovered pages (default 50).
  --max-depth=N        Crawl depth (default 3).
  --rate-limit-ms=N    Min ms between captures (default 2000).
  --no-robots          Ignore robots.txt disallows.
  --out=<dir>          Capture root. Default: docs/research/captures.
  --astro-out=<dir>    Astro project output. Default: <captureRoot>/astro-site.
  --no-tour            Skip scroll/hover tour during capture.
  --no-emit            Stop after clones; do not emit Astro project.
  --force              Overwrite existing Astro output dir.
  --viewport=<list>    Viewport selection. One of:
                         all                  (default, all 4 viewports)
                         desktop|mobile|
                         tablet|wide          (single viewport, ~4x faster)
                         <name>,<name>,...    (comma-separated subset)
  --resume             Resume from the previous run's .crawl-state.json:
                       skip already-completed URLs and process the pending
                       ones. No effect if no state file is found.
  --path-prefix=<p>    Only crawl URLs whose pathname starts with <p>.
                       Example: --path-prefix=/en restricts crawling to the
                       English section of a multi-lingual site. If omitted and
                       the entry URL has a non-root path (e.g. /en), the prefix
                       is auto-derived from that path. Pass --path-prefix= (empty)
                       to disable auto-detection and crawl the whole origin.
  -h, --help           Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    url: undefined,
    maxPages: 50,
    maxDepth: 3,
    rateLimitMs: 2000,
    respectRobots: true,
    out: 'docs/research/captures',
    astroOut: undefined,
    tour: true,
    emit: true,
    force: false,
    pathPrefix: undefined,
    pathPrefixExplicit: false,
    resume: false,
    help: false,
  };
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--no-robots') {
      out.respectRobots = false;
      continue;
    }
    if (raw === '--no-tour') {
      out.tour = false;
      continue;
    }
    if (raw === '--no-emit') {
      out.emit = false;
      continue;
    }
    if (raw === '--force') {
      out.force = true;
      continue;
    }
    // CAPTURE-AGENT: --resume flag (Fix #7)
    if (raw === '--resume') {
      out.resume = true;
      continue;
    }
    if (raw.startsWith('--max-pages=')) {
      out.maxPages = parseIntFlag(raw, '--max-pages=');
      continue;
    }
    if (raw.startsWith('--max-depth=')) {
      out.maxDepth = parseIntFlag(raw, '--max-depth=');
      continue;
    }
    if (raw.startsWith('--rate-limit-ms=')) {
      out.rateLimitMs = parseIntFlag(raw, '--rate-limit-ms=');
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
      continue;
    }
    if (raw.startsWith('--astro-out=')) {
      out.astroOut = raw.slice('--astro-out='.length);
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      out.viewports = raw.slice('--viewport='.length);
      continue;
    }
    // CRAWLER-AGENT: --path-prefix flag (Fix #4)
    if (raw.startsWith('--path-prefix=')) {
      out.pathPrefix = raw.slice('--path-prefix='.length);
      out.pathPrefixExplicit = true;
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    positional.push(raw);
  }
  out.url = positional[0];
  return out;
}

function parseIntFlag(raw: string, prefix: string): number {
  const v = Number.parseInt(raw.slice(prefix.length), 10);
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(`Invalid value for ${prefix.replace(/=$/, '')}: ${raw}`);
  }
  return v;
}

function runStep(label: string, cmd: string, cmdArgs: string[]): Promise<number> {
  return new Promise((resolveStep) => {
    console.log(`\n[${label}] ${cmd} ${cmdArgs.join(' ')}`);
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit' });
    child.on('exit', (code) => resolveStep(code ?? 0));
    child.on('error', (err) => {
      console.error(`[${label}] spawn error: ${err.message}`);
      resolveStep(1);
    });
  });
}

function newestSubdir(parent: string): string {
  const subs = readdirSync(parent, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = join(parent, e.name);
      return { full, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (subs.length === 0) {
    throw new Error(`No timestamped capture dirs under ${parent}`);
  }
  return subs[0].full;
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * CRAWLER-AGENT: resolve the effective --path-prefix (Fix #4).
 *
 * Precedence:
 *   1. `--path-prefix=<value>` explicit → use as-is (including empty string,
 *      which disables filtering even when the seed URL has a non-root path).
 *   2. No flag passed AND seed URL has a meaningful first path segment
 *      (e.g. `/en`, `/docs`) → auto-derive that segment as the prefix.
 *   3. Otherwise → no prefix.
 */
function resolvePathPrefix(
  args: CliArgs,
): { value: string; autoDetected: boolean } {
  if (args.pathPrefixExplicit) {
    const explicit = (args.pathPrefix ?? '').trim();
    return { value: normalizeCliPrefix(explicit), autoDetected: false };
  }
  if (!args.url) return { value: '', autoDetected: false };
  const seedPath = pathnameOf(args.url);
  const firstSegment = seedPath.split('/').filter(Boolean)[0];
  if (!firstSegment) return { value: '', autoDetected: false };
  // Skip auto-detect when the first segment looks like a file (has an extension).
  if (firstSegment.includes('.')) return { value: '', autoDetected: false };
  return { value: '/' + firstSegment, autoDetected: true };
}

function normalizeCliPrefix(raw: string): string {
  if (!raw || raw === '/') return '';
  let p = raw;
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function hostnameOf(url: string): string {
  return new URL(url).hostname;
}

async function captureAndCloneOne(
  url: string,
  outRoot: string,
  tour: boolean,
  viewports: string | undefined,
): Promise<string | null> {
  const host = hostnameOf(url);
  const hostParent = join(outRoot, host);

  const captureArgs = ['scripts/capture.ts', url, `--out=${outRoot}`];
  if (!tour) captureArgs.push('--no-tour');
  if (viewports) captureArgs.push(`--viewport=${viewports}`);

  const captureCode = await runStep('capture', 'npx', ['tsx', ...captureArgs]);
  if (captureCode !== 0) return null;

  let captureDir: string;
  try {
    captureDir = newestSubdir(hostParent);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }
  console.log(`  capture dir: ${captureDir}`);

  const harCode = await runStep('parse:har', 'npx', [
    'tsx',
    'scripts/parse-har.ts',
    captureDir,
  ]);
  if (harCode !== 0) return null;

  const traceCode = await runStep('parse:trace', 'npx', [
    'tsx',
    'scripts/parse-trace.ts',
    captureDir,
  ]);
  if (traceCode !== 0) return null;

  // Complete assets per viewport (best-effort).
  const availableViewports = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) =>
      existsSync(join(captureDir, name, 'parsed', 'document.html')),
    );
  for (const vp of availableViewports) {
    await runStep('complete:assets', 'npx', [
      'tsx',
      'scripts/complete-assets.ts',
      captureDir,
      `--viewport=${vp}`,
    ]);
  }

  const cloneArgs2 = ['tsx', 'scripts/clone.ts', captureDir];
  if (viewports) cloneArgs2.push(`--viewport=${viewports}`);
  const cloneCode = await runStep('clone', 'npx', cloneArgs2);
  if (cloneCode !== 0) return null;

  // Pick desktop viewport clone if it exists, else first available.
  const desktopClone = join(captureDir, 'desktop', 'clone');
  if (existsSync(join(desktopClone, 'index.html'))) return desktopClone;
  for (const vp of availableViewports) {
    const candidate = join(captureDir, vp, 'clone');
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

// CAPTURE-AGENT: Fix #7 — incremental save + resume.
//
// We persist a `.crawl-state.json` file at the per-host root after EVERY
// page completes (success or failure). If the run is killed (30-min budget,
// crash, Ctrl-C), the next invocation with --resume can skip everything
// already completed and process the still-pending URLs.
interface CrawlState {
  entryUrl: string;
  startedAt: string;
  updatedAt: string;
  completedUrls: string[];
  failedUrls: string[];
  pendingUrls: string[];
  /** Per-completed-URL record so we can rebuild the manifest on resume. */
  pages: { url: string; pathname: string; cloneDir: string }[];
}

function crawlStatePath(outRoot: string, host: string): string {
  return join(outRoot, host, '.crawl-state.json');
}

function loadCrawlState(path: string): CrawlState | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as CrawlState;
  } catch (err) {
    console.warn(
      `[resume] failed to read ${path}: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

function saveCrawlState(path: string, state: CrawlState): void {
  state.updatedAt = new Date().toISOString();
  try {
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn(
      `[resume] failed to write ${path}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(HELP_TEXT);
    return 2;
  }
  if (args.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (!args.url) {
    console.error('Missing <entry-url>.');
    console.error(HELP_TEXT);
    return 2;
  }

  const outRoot = resolve(args.out);

  // CRAWLER-AGENT: auto-derive --path-prefix from a non-root seed path (Fix #4).
  const resolvedPathPrefix = resolvePathPrefix(args);

  console.log(`\n=== Phase 1/3: Crawl ===`);
  console.log(`  entry       : ${args.url}`);
  console.log(`  max pages   : ${args.maxPages}`);
  console.log(`  max depth   : ${args.maxDepth}`);
  console.log(`  rate limit  : ${args.rateLimitMs}ms`);
  console.log(`  robots.txt  : ${args.respectRobots ? 'respect' : 'ignore'}`);
  if (resolvedPathPrefix.value) {
    const tag = resolvedPathPrefix.autoDetected ? '(auto-detected)' : '(explicit)';
    console.log(`  path prefix : ${resolvedPathPrefix.value} ${tag}`);
  } else if (args.pathPrefixExplicit) {
    console.log(`  path prefix : (disabled by --path-prefix=)`);
  } else {
    console.log(`  path prefix : (none — crawling whole origin)`);
  }

  const crawl = await crawlSite({
    entryUrl: args.url,
    maxPages: args.maxPages,
    maxDepth: args.maxDepth,
    rateLimitMs: args.rateLimitMs,
    respectRobots: args.respectRobots,
    pathPrefix: resolvedPathPrefix.value || undefined,
    onProgress: ({ url, depth, total }) =>
      console.log(`  [${total}] d=${depth}  ${url}`),
  });

  console.log(`\nDiscovered ${crawl.urls.length} URL(s):`);
  for (const u of crawl.urls) console.log(`  - ${u}`);
  if (crawl.truncatedAt) {
    console.log(`  (truncated at ${crawl.truncatedAt})`);
  }
  if (crawl.skipped.length > 0) {
    console.log(`Skipped ${crawl.skipped.length} URL(s) during crawl.`);
  }

  if (crawl.urls.length === 0) {
    console.error('No URLs discovered. Aborting.');
    return 1;
  }

  console.log(`\n=== Phase 2/3: Capture + Clone (${crawl.urls.length} pages) ===`);

  // CAPTURE-AGENT: Fix #7 — load or initialise crawl state.
  const host = hostnameOf(args.url);
  const statePath = crawlStatePath(outRoot, host);
  const prior = args.resume ? loadCrawlState(statePath) : null;

  const state: CrawlState = prior
    ? {
        ...prior,
        // Refresh pending list against what we just crawled; preserves any
        // URLs that disappeared from the crawl (we still won't redo them).
        pendingUrls: crawl.urls.filter(
          (u) => !prior.completedUrls.includes(u) && !prior.failedUrls.includes(u),
        ),
      }
    : {
        entryUrl: args.url,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedUrls: [],
        failedUrls: [],
        pendingUrls: [...crawl.urls],
        pages: [],
      };

  if (prior) {
    console.log(
      `  [resume] prior run: ${prior.completedUrls.length} completed, ` +
        `${prior.failedUrls.length} failed; ${state.pendingUrls.length} pending.`,
    );
  }

  const pageRecords: { url: string; pathname: string; cloneDir: string }[] = [...state.pages];
  // Initial persistence so a kill before the first page still leaves state on disk.
  saveCrawlState(statePath, state);

  for (let i = 0; i < crawl.urls.length; i += 1) {
    const url = crawl.urls[i];
    if (state.completedUrls.includes(url)) {
      console.log(`\n--- Page ${i + 1}/${crawl.urls.length}: ${url} [skip: already completed] ---`);
      continue;
    }
    if (state.failedUrls.includes(url) && args.resume) {
      console.log(`\n--- Page ${i + 1}/${crawl.urls.length}: ${url} [skip: prior failure] ---`);
      continue;
    }
    console.log(`\n--- Page ${i + 1}/${crawl.urls.length}: ${url} ---`);
    const cloneDir = await captureAndCloneOne(url, outRoot, args.tour, args.viewports);

    state.pendingUrls = state.pendingUrls.filter((u) => u !== url);
    if (!cloneDir) {
      console.warn(`  page failed: ${url}`);
      if (!state.failedUrls.includes(url)) state.failedUrls.push(url);
      saveCrawlState(statePath, state);
      continue;
    }
    const record = { url, pathname: pathnameOf(url), cloneDir };
    pageRecords.push(record);
    if (!state.completedUrls.includes(url)) state.completedUrls.push(url);
    state.pages.push(record);
    // Persist after EVERY page so an interrupted run is still resumable.
    saveCrawlState(statePath, state);
  }

  console.log(`\nClones produced: ${pageRecords.length}/${crawl.urls.length}`);

  // Write a site-clone manifest next to the capture root.
  const siteManifestPath = join(outRoot, host, 'site-clone-manifest.json');
  writeFileSync(
    siteManifestPath,
    JSON.stringify(
      {
        entryUrl: args.url,
        crawledAt: new Date().toISOString(),
        discovered: crawl.urls,
        truncatedAt: crawl.truncatedAt,
        skipped: crawl.skipped,
        pages: pageRecords,
      },
      null,
      2,
    ),
  );
  console.log(`Site manifest: ${siteManifestPath}`);

  if (!args.emit) {
    console.log('--no-emit set; skipping Astro emit.');
    return 0;
  }

  if (pageRecords.length === 0) {
    console.error('No successful clones; cannot emit Astro project.');
    return 1;
  }

  console.log(`\n=== Phase 3/3: Astro emit ===`);
  const astroOut = args.astroOut
    ? resolve(args.astroOut)
    : join(outRoot, host, 'astro-site');

  const summary = await buildAstroMulti({
    pages: pageRecords.map((p) => ({
      cloneDir: p.cloneDir,
      pathname: p.pathname,
      url: p.url,
    })),
    outDir: astroOut,
    name: host.replace(/[^a-z0-9.-]/gi, '-'),
    force: args.force,
  });

  console.log(`\nAstro project: ${astroOut}`);
  console.log(`  pages emitted    : ${summary.pagesEmitted.length}`);
  for (const p of summary.pagesEmitted) console.log(`    - ${p}.astro`);
  console.log(`  shared components: ${summary.sharedComponents.length}`);
  for (const c of summary.sharedComponents) console.log(`    - ${c}`);
  console.log(`  per-page components: ${summary.perPageComponents}`);
  console.log(
    `  assets: ${summary.assetCount} files (${formatBytes(summary.assetBytes)})`,
  );

  // Post-emit phase pipeline: extract-css → media-preserve (Phase 14) →
  // centralise-content (Phase 12) → npm install + build (Phase 9) →
  // edit-playbook (Phase 11) → verify-render (Phase 13). Mirrors the
  // single-page rebuild-pro pipeline for the subset of phases that apply
  // to multi-page output.
  console.log(`\n=== Phase 4/4: Post-emit (multi-page) ===`);
  const postEmit = await runPostEmitMulti({
    outDir: astroOut,
    cloneDirs: pageRecords.map((p) => p.cloneDir),
  });
  console.log(`\nPost-emit summary:`);
  console.log(`  css rules        : ${postEmit.cssRulesCount}`);
  console.log(`  @media rules     : ${postEmit.mediaRuleCount}`);
  console.log(`  centralised flds : ${postEmit.centralizedFields}`);
  console.log(`  built            : ${postEmit.built}`);
  if (postEmit.verifyReport) {
    console.log(
      `  verify-render    : ${postEmit.verifyReport.passed}/${postEmit.verifyReport.routesChecked} routes passed` +
        (postEmit.verifyReport.failed > 0
          ? ` (${postEmit.verifyReport.failed} failed)`
          : ''),
    );
  }

  return 0;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  },
);
