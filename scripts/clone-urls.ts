#!/usr/bin/env tsx
/**
 * Explicit URL-list multi-page clone driver.
 *
 * Bypasses the autodiscovery crawler in clone-site.ts. Use this when:
 *   - the target site's nav is JS-rendered and the static crawler misses pages
 *   - you already know exactly which URLs you want cloned
 *   - you want repeatable, deterministic capture sets across runs
 *
 * Per URL: capture -> parse:har -> parse:trace -> complete:assets -> clone.
 * Then a single buildAstroMulti emits a unified Astro project, followed by
 * runPostEmitMulti for centralise-content + media-preserve + build + verify.
 *
 * Usage:
 *   tsx scripts/clone-urls.ts --urls=urls.txt [options]
 *   tsx scripts/clone-urls.ts --url=https://a/ --url=https://a/b [options]
 *
 * Options:
 *   --urls=<file>        Newline-separated URL list. Lines starting with # ignored.
 *   --url=<url>          Repeatable. Mixed with --urls= entries.
 *   --out=<dir>          Capture root. Default: docs/research/captures.
 *   --astro-out=<dir>    Astro project output. Default: <out>/<host>/astro-site-urls.
 *   --viewport=<list>    desktop|mobile|tablet|wide|all (default: desktop).
 *   --rate-limit-ms=N    Delay between page captures (default 2000).
 *   --no-tour            Skip scroll/hover tour during capture.
 *   --no-emit            Stop after per-page clones; do not emit Astro project.
 *   --no-post-emit       Skip post-emit pipeline (centralise + build + verify).
 *   --force              Overwrite existing Astro output dir.
 *   --skip-failed        On retry, ignore URLs that previously failed.
 *   -h, --help           Show this help.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import { runCapture } from './capture';
import { parseHarMain } from './parse-har';
import { parseTraceMain } from './parse-trace';
import { completeAssetsMain } from './complete-assets';
import { cloneMain } from './clone';

import { astroAdapter } from '../engine/targets/astro';
import { reactAdapter } from '../engine/targets/react';
import { webappAdapter } from '../engine/targets/webapp';
import type { TargetAdapter, TargetMultiBuildSummary } from '../engine/targets/types';
import { runPostEmitMulti } from '../engine/orchestrator/post-build/post-emit-multi';
import { runPostEmitMultiReact } from '../engine/orchestrator/post-build/post-emit-multi-react';
import { runPostEmitMultiWebapp } from '../engine/orchestrator/post-build/post-emit-multi-webapp';
import {
  loadCrawlGraph,
  inferStateGroups,
  type InferenceResult,
} from '../engine/targets/webapp/inference';
import {
  CANONICAL_ROOT,
  canonicalTimestamp,
  cloneOutDir,
  cloneSubdir,
  defaultTargetFromHost,
  siteDir,
} from '../engine/cli/canonical-paths';

const LEGACY_CAPTURE_ROOT = 'docs/research/captures';

type TargetName = 'astro' | 'react' | 'webapp';

interface CliArgs {
  urls: string[];
  out?: string;
  astroOut?: string;
  viewports: string;
  rateLimitMs: number;
  tour: boolean;
  emit: boolean;
  postEmit: boolean;
  force: boolean;
  skipFailed: boolean;
  target: TargetName;
  targetSlug?: string;
  legacyOutput: boolean;
  /**
   * Path to a webapp crawl directory (graph.json + states/ + screenshots).
   * When set with --target=webapp, threads the crawl graph and inferred
   * state through the webapp build and post-emit pipeline. Without this
   * the pixel-parity stretch phase reports skipped=no-crawlDir.
   */
  crawlDir?: string;
  help: boolean;
}

const HELP_TEXT = `
dr-parity clone-urls (explicit URL list, no crawler)

Usage:
  tsx scripts/clone-urls.ts --urls=urls.txt [options]
  tsx scripts/clone-urls.ts --url=https://a/ --url=https://a/b [options]

Options:
  --urls=<file>        Newline-separated URL list. Lines starting with # ignored.
  --url=<url>          Repeatable. Mixed with --urls= entries.
  --target=<name>      Framework target: astro | react | webapp. Default: astro.
  --target-slug=<slug> Override the canonical target slug (defaults to host).
  --out=<dir>          Output root override. Default (canonical):
                       clones/<target-slug>/<iso-timestamp>/. With
                       --legacy-output: docs/research/captures.
  --legacy-output      Use the legacy docs/research/captures layout.
  --astro-out=<dir>    Project output directory. Despite the legacy name this
                       applies to whatever --target is set to. Default
                       (canonical): <run-root>/sites/<target>. Legacy:
                       <out>/<host>/<target>-site-urls.
  --viewport=<list>    desktop|mobile|tablet|wide|all (default: desktop).
  --rate-limit-ms=N    Delay between page captures (default 2000).
  --no-tour            Skip scroll/hover tour during capture.
  --no-emit            Stop after per-page clones; do not emit project.
  --no-post-emit       Skip post-emit pipeline (only meaningful for astro).
  --force              Overwrite existing project output dir.
  --skip-failed        Skip URLs already marked failed in prior state.
  --crawl-dir=<dir>    Webapp crawl directory (graph.json + states + screenshots).
                       Required for pixel-parity stretch phase. Threads
                       inference into webapp post-emit. Ignored for non-webapp
                       targets.
  -h, --help           Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    urls: [],
    out: undefined,
    astroOut: undefined,
    viewports: 'desktop',
    rateLimitMs: 2000,
    tour: true,
    emit: true,
    postEmit: true,
    force: false,
    skipFailed: false,
    target: 'astro',
    targetSlug: undefined,
    legacyOutput: false,
    crawlDir: undefined,
    help: false,
  };
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') { out.help = true; continue; }
    if (raw === '--no-tour') { out.tour = false; continue; }
    if (raw === '--no-emit') { out.emit = false; continue; }
    if (raw === '--no-post-emit') { out.postEmit = false; continue; }
    if (raw === '--force') { out.force = true; continue; }
    if (raw === '--skip-failed') { out.skipFailed = true; continue; }
    if (raw === '--legacy-output') { out.legacyOutput = true; continue; }
    if (raw.startsWith('--target-slug=')) {
      out.targetSlug = raw.slice('--target-slug='.length).trim() || undefined;
      continue;
    }
    if (raw.startsWith('--urls=')) {
      const file = raw.slice('--urls='.length);
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) out.urls.push(trimmed);
      }
      continue;
    }
    if (raw.startsWith('--url=')) {
      out.urls.push(raw.slice('--url='.length).trim());
      continue;
    }
    if (raw.startsWith('--out=')) { out.out = raw.slice('--out='.length); continue; }
    if (raw.startsWith('--astro-out=')) { out.astroOut = raw.slice('--astro-out='.length); continue; }
    if (raw.startsWith('--viewport=')) { out.viewports = raw.slice('--viewport='.length); continue; }
    if (raw.startsWith('--rate-limit-ms=')) {
      const v = Number.parseInt(raw.slice('--rate-limit-ms='.length), 10);
      if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid --rate-limit-ms: ${raw}`);
      out.rateLimitMs = v;
      continue;
    }
    if (raw.startsWith('--target=')) {
      const v = raw.slice('--target='.length).trim();
      if (v !== 'astro' && v !== 'react' && v !== 'webapp') {
        throw new Error(`Invalid --target: ${v} (must be astro, react, or webapp)`);
      }
      out.target = v;
      continue;
    }
    if (raw.startsWith('--crawl-dir=')) {
      const v = raw.slice('--crawl-dir='.length).trim();
      if (!v) throw new Error('Empty --crawl-dir value');
      out.crawlDir = v;
      continue;
    }
    if (raw.startsWith('--')) throw new Error(`Unknown flag: ${raw}`);
  }
  return out;
}

function resolveAdapter(target: TargetName): TargetAdapter {
  if (target === 'astro') return astroAdapter;
  if (target === 'react') return reactAdapter;
  // Webapp is single-page-only by design (SPA with React Router emits
  // routes from its captured crawl graph); buildMulti is intentionally
  // absent. The webapp branch in main() drives the single-page adapter
  // contract and runs runPostEmitMultiWebapp afterwards.
  return webappAdapter;
}

async function runStage(
  label: string,
  argsForLog: readonly string[],
  fn: () => Promise<number> | number,
): Promise<number> {
  console.log(`\n[${label}] ${argsForLog.join(' ')}`);
  try {
    return await fn();
  } catch (err) {
    console.error(`[${label}] error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

function newestSubdir(parent: string): string {
  const subs = readdirSync(parent, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => !e.name.startsWith('.') && e.name !== 'astro-site' && !e.name.startsWith('astro-site'))
    .map((e) => {
      const full = join(parent, e.name);
      return { full, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (subs.length === 0) throw new Error(`No timestamped capture dirs under ${parent}`);
  return subs[0].full;
}

function pathnameOf(url: string): string {
  try { return new URL(url).pathname || '/'; } catch { return '/'; }
}

function hostnameOf(url: string): string {
  return new URL(url).hostname;
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureAndCloneOne(
  url: string,
  capturesRoot: string,
  tour: boolean,
  viewports: string,
): Promise<string | null> {
  const host = hostnameOf(url);
  const hostParent = join(capturesRoot, host);

  // Pass --legacy-output here because we want per-URL host/iso subdirs
  // under the supplied captures root. The captures root itself is canonical
  // (clones/<target>/<iso>/captures) when invoked from a canonical run.
  const captureCliArgs = [
    url,
    `--out=${capturesRoot}`,
    '--legacy-output',
    `--viewport=${viewports}`,
  ];
  if (!tour) captureCliArgs.push('--no-tour');

  const captureCode = await runStage('capture', captureCliArgs, async () => {
    const result = await runCapture(captureCliArgs);
    return result.viewports.length > 0 && result.viewports.every((r) => !r.ok) ? 1 : 0;
  });
  if (captureCode !== 0) return null;

  let captureDir: string;
  try {
    captureDir = newestSubdir(hostParent);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }
  console.log(`  capture dir: ${captureDir}`);

  const harCode = await runStage('parse:har', [captureDir], () => parseHarMain([captureDir]));
  if (harCode !== 0) return null;

  const traceCode = await runStage('parse:trace', [captureDir], () => parseTraceMain([captureDir]));
  if (traceCode !== 0) return null;

  const availableViewports = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(captureDir, name, 'parsed', 'document.html')));

  for (const vp of availableViewports) {
    const completeArgs = [captureDir, `--viewport=${vp}`];
    await runStage('complete:assets', completeArgs, () => completeAssetsMain(completeArgs));
  }

  const cloneCliArgs = [captureDir, `--viewport=${viewports}`];
  const cloneCode = await runStage('clone', cloneCliArgs, () => cloneMain(cloneCliArgs));
  if (cloneCode !== 0) return null;

  const desktopClone = join(captureDir, 'desktop', 'clone');
  if (existsSync(join(desktopClone, 'index.html'))) return desktopClone;
  for (const vp of availableViewports) {
    const candidate = join(captureDir, vp, 'clone');
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

interface ClonesState {
  startedAt: string;
  updatedAt: string;
  completed: { url: string; pathname: string; cloneDir: string }[];
  failed: string[];
}

function statePath(outRoot: string, host: string): string {
  return join(outRoot, host, '.clone-urls-state.json');
}

function loadState(path: string): ClonesState | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')) as ClonesState; }
  catch { return null; }
}

function saveState(path: string, state: ClonesState): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf8');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface RunLayout {
  /** Canonical run root. Same as capturesRoot under legacy mode. */
  runRoot: string;
  /** Parent dir under which per-URL captures live (with host/iso subdirs). */
  capturesRoot: string;
  /** Default project emit directory (sites/<target>). */
  defaultSiteDir: string;
}

function resolveRunLayout(args: CliArgs, host: string): RunLayout {
  const targetFramework = args.target;
  if (args.legacyOutput) {
    const captures = resolve(args.out ?? LEGACY_CAPTURE_ROOT);
    return {
      runRoot: captures,
      capturesRoot: captures,
      defaultSiteDir: join(captures, host, `${targetFramework}-site-urls`),
    };
  }
  const baseDir = args.out ? resolve(args.out) : resolve(CANONICAL_ROOT);
  const slug = args.targetSlug ?? defaultTargetFromHost(host);
  const stamp = canonicalTimestamp();
  const runRoot = resolve(cloneOutDir(slug, stamp, baseDir));
  return {
    runRoot,
    capturesRoot: resolve(cloneSubdir(slug, stamp, 'captures', baseDir)),
    defaultSiteDir: resolve(siteDir(slug, stamp, targetFramework, baseDir)),
  };
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let args: CliArgs;
  try { args = parseArgs(argv); }
  catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(HELP_TEXT);
    return 2;
  }
  if (args.help) { console.log(HELP_TEXT); return 0; }
  if (args.urls.length === 0) {
    console.error('No URLs provided. Use --urls=<file> or --url=<url>.');
    console.error(HELP_TEXT);
    return 2;
  }

  const dedup = Array.from(new Set(args.urls));
  if (dedup.length !== args.urls.length) {
    console.log(`(deduped ${args.urls.length - dedup.length} duplicate URLs)`);
  }

  const host = hostnameOf(dedup[0]);
  const layout = resolveRunLayout(args, host);
  // capturesRoot is the parent under which each URL gets host/iso subdirs
  // (captures script invoked with --legacy-output).
  const capturesRoot = layout.capturesRoot;
  mkdirSync(capturesRoot, { recursive: true });
  const sPath = statePath(capturesRoot, host);
  const prior = loadState(sPath);

  const state: ClonesState = prior ?? {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: [],
    failed: [],
  };

  const completedUrls = new Set(state.completed.map((p) => p.url));
  const failedUrls = new Set(state.failed);

  console.log(`\n=== Phase 1/2: Capture + Clone (${dedup.length} URLs) ===`);
  console.log(`  run root     : ${layout.runRoot}`);
  console.log(`  captures dir : ${capturesRoot}`);
  console.log(`  viewport     : ${args.viewports}`);
  console.log(`  rate limit   : ${args.rateLimitMs}ms`);
  if (prior) {
    console.log(`  resuming with ${state.completed.length} prior completions, ${state.failed.length} prior failures`);
  }

  for (let i = 0; i < dedup.length; i += 1) {
    const url = dedup[i];
    if (completedUrls.has(url)) {
      console.log(`\n--- [${i + 1}/${dedup.length}] ${url} [skip: completed] ---`);
      continue;
    }
    if (args.skipFailed && failedUrls.has(url)) {
      console.log(`\n--- [${i + 1}/${dedup.length}] ${url} [skip: prior failure] ---`);
      continue;
    }
    console.log(`\n--- [${i + 1}/${dedup.length}] ${url} ---`);

    let cloneDir: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      cloneDir = await captureAndCloneOne(url, capturesRoot, args.tour, args.viewports);
      if (cloneDir) break;
      if (attempt === 1) console.warn(`  attempt 1 failed, retrying once...`);
    }

    if (!cloneDir) {
      console.warn(`  FAILED: ${url}`);
      if (!failedUrls.has(url)) {
        state.failed.push(url);
        failedUrls.add(url);
      }
    } else {
      console.log(`  OK: ${url} -> ${cloneDir}`);
      state.completed.push({ url, pathname: pathnameOf(url), cloneDir });
      completedUrls.add(url);
      failedUrls.delete(url);
      state.failed = state.failed.filter((u) => u !== url);
    }
    saveState(sPath, state);

    if (i < dedup.length - 1) await delay(args.rateLimitMs);
  }

  console.log(`\nClones produced: ${state.completed.length}/${dedup.length}`);
  if (state.failed.length > 0) {
    console.log(`Failed URLs (${state.failed.length}):`);
    for (const u of state.failed) console.log(`  - ${u}`);
  }

  // Site manifest lives at the run root (canonical) or alongside the host
  // captures dir (legacy).
  const siteManifestPath = args.legacyOutput
    ? join(capturesRoot, host, 'urls-clone-manifest.json')
    : join(layout.runRoot, 'urls-clone-manifest.json');
  mkdirSync(resolve(siteManifestPath, '..'), { recursive: true });
  writeFileSync(
    siteManifestPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      urls: dedup,
      pages: state.completed,
      failed: state.failed,
    }, null, 2),
  );
  console.log(`Manifest: ${siteManifestPath}`);

  if (!args.emit) {
    console.log('--no-emit set; stopping.');
    return 0;
  }
  if (state.completed.length === 0) {
    console.error('No successful clones; cannot emit Astro project.');
    return 1;
  }

  const projectOut = args.astroOut ? resolve(args.astroOut) : layout.defaultSiteDir;
  console.log(`\n=== Phase 2/2: ${args.target} emit (${state.completed.length} pages) ===`);
  console.log(`  target  : ${args.target}`);
  console.log(`  out dir : ${projectOut}`);

  const adapter = resolveAdapter(args.target);

  // Webapp does not implement buildMulti; the emitted SPA produces its own
  // per-route components from the captured crawl graph. Drive the single
  // page adapter contract using the first captured clone as the seed, then
  // run the dedicated webapp post-emit pipeline.
  if (args.target === 'webapp') {
    const absCrawlDir = args.crawlDir ? resolve(args.crawlDir) : undefined;
    if (args.crawlDir) {
      console.log(`  crawl dir: ${absCrawlDir}`);
    }

    const seedPage = state.completed[0];
    const buildSummary = await adapter.build({
      cloneDir: seedPage.cloneDir,
      outDir: projectOut,
      name: host.replace(/[^a-z0-9.-]/gi, '-'),
      force: args.force,
      ...(absCrawlDir ? { crawlDir: absCrawlDir } : {}),
    });
    console.log(`\n${args.target} project: ${projectOut}`);
    console.log(`  components emitted: ${buildSummary.componentsEmitted}`);
    console.log(`  pages emitted     : ${buildSummary.pagesEmitted}`);
    console.log(`  assets: ${buildSummary.assetCount} files (${formatBytes(buildSummary.assetBytes)})`);
    if (state.completed.length > 1) {
      console.log(
        `  note: webapp seeded from ${seedPage.url}; the SPA emits routes from its captured crawl graph, so the other ${state.completed.length - 1} URLs are not consumed by the emit step.`,
      );
    }

    if (!args.postEmit) {
      console.log('\n--no-post-emit set; skipping webapp post-emit pipeline.');
      return 0;
    }

    // Thread crawl graph and inferred state into the post-emit pipeline so
    // the pixel-parity stretch phase can run. Without --crawl-dir the
    // stretch phase is skipped with reason "no crawlDir" by design.
    let inference: InferenceResult | undefined;
    if (absCrawlDir) {
      try {
        const loaded = await loadCrawlGraph(absCrawlDir);
        inference = await inferStateGroups(loaded.graph, loaded.getStateDom);
        const toggleCount = inference.routes.reduce(
          (sum, r) => sum + r.baseStateGroup.toggles.length,
          0,
        );
        console.log(
          `  inference: ${inference.routes.length} routes, ${toggleCount} toggles`,
        );
      } catch (err) {
        console.warn(
          `  warning: failed to load crawl graph at ${absCrawlDir}: ${err instanceof Error ? err.message : String(err)}`,
        );
        inference = undefined;
      }
    }

    console.log(`\n=== Post-emit pipeline (webapp) ===`);
    const webappPostEmit = await runPostEmitMultiWebapp({
      outDir: projectOut,
      ...(absCrawlDir ? { crawlDir: absCrawlDir } : {}),
      ...(inference ? { inference } : {}),
    });
    console.log(`\nPost-emit summary:`);
    for (const phase of webappPostEmit.phases) {
      const dur = phase.metrics.durationMs;
      console.log(
        `  ${phase.name.padEnd(24)} ${phase.status}${typeof dur === 'number' ? ` (${dur}ms)` : ''}`,
      );
      for (const err of phase.errors) console.log(`    - ${err}`);
    }
    return webappPostEmit.passed ? 0 : 1;
  }

  const summary = (await adapter.buildMulti!({
    pages: state.completed.map((p) => ({ cloneDir: p.cloneDir, pathname: p.pathname, url: p.url })),
    outDir: projectOut,
    name: host.replace(/[^a-z0-9.-]/gi, '-'),
    force: args.force,
  })) as TargetMultiBuildSummary;

  const pageExt = args.target === 'astro' ? '.astro' : '.html';
  console.log(`\n${args.target} project: ${projectOut}`);
  console.log(`  pages emitted    : ${summary.pagesEmitted.length}`);
  for (const p of summary.pagesEmitted) console.log(`    - ${p}${pageExt}`);
  console.log(`  shared components: ${summary.sharedComponents.length}`);
  console.log(`  per-page components: ${summary.perPageComponents}`);
  console.log(`  assets: ${summary.assetCount} files (${formatBytes(summary.assetBytes)})`);

  if (!args.postEmit) {
    console.log('\n--no-post-emit set; skipping centralise/build/verify.');
    return 0;
  }

  // Centralise-content, edit-playbook, and verify-render only fit astro's
  // single-import layout. The react path runs its own narrower post-emit
  // that extracts CSS and injects the preserved @media rules.
  if (args.target === 'react') {
    console.log(`\n=== Post-emit pipeline (react) ===`);
    const reactPostEmit = await runPostEmitMultiReact({
      outDir: projectOut,
      cloneDirs: state.completed.map((p) => p.cloneDir),
    });
    console.log(`\nPost-emit summary:`);
    console.log(`  css rules        : ${reactPostEmit.cssRulesCount}`);
    console.log(`  @media rules     : ${reactPostEmit.mediaRuleCount}`);
    console.log(`  pages patched    : ${reactPostEmit.pagesPatched}`);
    if (reactPostEmit.publicCssPath) {
      console.log(`  public sheet     : ${reactPostEmit.publicCssPath}`);
    }
    return 0;
  }

  if (args.target !== 'astro') {
    console.log(`\nSkipping post-emit pipeline: not implemented for target "${args.target}".`);
    return 0;
  }

  console.log(`\n=== Post-emit pipeline ===`);
  const postEmit = await runPostEmitMulti({
    outDir: projectOut,
    cloneDirs: state.completed.map((p) => p.cloneDir),
  });
  console.log(`\nPost-emit summary:`);
  console.log(`  css rules        : ${postEmit.cssRulesCount}`);
  console.log(`  @media rules     : ${postEmit.mediaRuleCount}`);
  console.log(`  centralised flds : ${postEmit.centralizedFields}`);
  console.log(`  built            : ${postEmit.built}`);
  if (postEmit.verifyReport) {
    console.log(
      `  verify-render    : ${postEmit.verifyReport.passed}/${postEmit.verifyReport.routesChecked} routes passed`,
    );
  }

  return 0;
}

const isDirect = process.argv[1] && process.argv[1].endsWith('clone-urls.ts');
if (isDirect) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    },
  );
}

export { main as cloneUrlsEntry };
