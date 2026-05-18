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
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { astroAdapter } from '../engine/targets/astro';
import { reactAdapter } from '../engine/targets/react';
import type { TargetAdapter, TargetMultiBuildSummary } from '../engine/targets/types';
import { runPostEmitMulti } from '../engine/orchestrator/post-build/post-emit-multi';

type TargetName = 'astro' | 'react';

interface CliArgs {
  urls: string[];
  out: string;
  astroOut?: string;
  viewports: string;
  rateLimitMs: number;
  tour: boolean;
  emit: boolean;
  postEmit: boolean;
  force: boolean;
  skipFailed: boolean;
  target: TargetName;
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
  --target=<name>      Framework target: astro | react. Default: astro.
  --out=<dir>          Capture root. Default: docs/research/captures.
  --astro-out=<dir>    Project output directory. Despite the legacy name this
                       applies to whatever --target is set to. Default:
                       <out>/<host>/<target>-site-urls.
  --viewport=<list>    desktop|mobile|tablet|wide|all (default: desktop).
  --rate-limit-ms=N    Delay between page captures (default 2000).
  --no-tour            Skip scroll/hover tour during capture.
  --no-emit            Stop after per-page clones; do not emit project.
  --no-post-emit       Skip post-emit pipeline (only meaningful for astro).
  --force              Overwrite existing project output dir.
  --skip-failed        Skip URLs already marked failed in prior state.
  -h, --help           Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    urls: [],
    out: 'docs/research/captures',
    astroOut: undefined,
    viewports: 'desktop',
    rateLimitMs: 2000,
    tour: true,
    emit: true,
    postEmit: true,
    force: false,
    skipFailed: false,
    target: 'astro',
    help: false,
  };
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') { out.help = true; continue; }
    if (raw === '--no-tour') { out.tour = false; continue; }
    if (raw === '--no-emit') { out.emit = false; continue; }
    if (raw === '--no-post-emit') { out.postEmit = false; continue; }
    if (raw === '--force') { out.force = true; continue; }
    if (raw === '--skip-failed') { out.skipFailed = true; continue; }
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
      if (v !== 'astro' && v !== 'react') {
        throw new Error(`Invalid --target: ${v} (must be astro or react)`);
      }
      out.target = v;
      continue;
    }
    if (raw.startsWith('--')) throw new Error(`Unknown flag: ${raw}`);
  }
  return out;
}

function resolveAdapter(target: TargetName): TargetAdapter {
  const adapter = target === 'astro' ? astroAdapter : reactAdapter;
  if (typeof adapter.buildMulti !== 'function') {
    throw new Error(`Adapter "${target}" does not implement buildMulti`);
  }
  return adapter;
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
  outRoot: string,
  tour: boolean,
  viewports: string,
): Promise<string | null> {
  const host = hostnameOf(url);
  const hostParent = join(outRoot, host);

  const captureArgs = ['scripts/capture.ts', url, `--out=${outRoot}`, `--viewport=${viewports}`];
  if (!tour) captureArgs.push('--no-tour');

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

  const harCode = await runStep('parse:har', 'npx', ['tsx', 'scripts/parse-har.ts', captureDir]);
  if (harCode !== 0) return null;

  const traceCode = await runStep('parse:trace', 'npx', ['tsx', 'scripts/parse-trace.ts', captureDir]);
  if (traceCode !== 0) return null;

  const availableViewports = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(captureDir, name, 'parsed', 'document.html')));

  for (const vp of availableViewports) {
    await runStep('complete:assets', 'npx', [
      'tsx', 'scripts/complete-assets.ts', captureDir, `--viewport=${vp}`,
    ]);
  }

  const cloneCode = await runStep('clone', 'npx', [
    'tsx', 'scripts/clone.ts', captureDir, `--viewport=${viewports}`,
  ]);
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

async function main(): Promise<number> {
  let args: CliArgs;
  try { args = parseArgs(process.argv.slice(2)); }
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

  const outRoot = resolve(args.out);
  const host = hostnameOf(dedup[0]);
  const sPath = statePath(outRoot, host);
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
  console.log(`  capture root : ${outRoot}`);
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
      cloneDir = await captureAndCloneOne(url, outRoot, args.tour, args.viewports);
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

  // Site manifest
  const siteManifestPath = join(outRoot, host, 'urls-clone-manifest.json');
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

  const defaultProjectDir = `${args.target}-site-urls`;
  const projectOut = args.astroOut ? resolve(args.astroOut) : join(outRoot, host, defaultProjectDir);
  console.log(`\n=== Phase 2/2: ${args.target} emit (${state.completed.length} pages) ===`);
  console.log(`  target  : ${args.target}`);
  console.log(`  out dir : ${projectOut}`);

  const adapter = resolveAdapter(args.target);
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

  // The post-emit pipeline (centralise-content, edit-playbook, verify-render)
  // is Astro-specific. The React multi-page output ships a runnable Vite
  // project as-is; downstream verification for React will land in a
  // separate orchestrator pass.
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

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  },
);
