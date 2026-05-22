#!/usr/bin/env tsx
/**
 * End-to-end clone pipeline.
 *
 * Runs: capture -> parse:har -> parse:trace -> clone.
 *
 * Usage:
 *   tsx scripts/run-clone.ts <url> [--viewport=desktop,...] [--out=<dir>] [--no-tour] [--no-preview]
 *   tsx scripts/run-clone.ts --manifest-only --capture-dir=<dir> [--viewport=desktop,...]
 *
 * --manifest-only re-emits the clone manifest (and the parity summary it
 * feeds) from an existing capture directory without running capture again.
 * The parse:har and parse:trace stages still run lazily, but only for
 * viewports that do not already have parsed/document.html on disk. This is
 * the fast path for re-verifying a fixture after a code change.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CANONICAL_ROOT,
  canonicalTimestamp,
  cloneOutDir,
  cloneSubdir,
  defaultTargetFromHost,
} from '../engine/cli/canonical-paths';
import { runCapture } from './capture';
import { parseHarMain } from './parse-har';
import { parseTraceMain } from './parse-trace';
import { completeAssetsMain } from './complete-assets';
import { cloneMain } from './clone';

const LEGACY_CAPTURE_ROOT = 'docs/research/captures';

type CliArgs = {
  url?: string;
  viewports?: string;
  out?: string;
  target?: string;
  tour: boolean;
  preview: boolean;
  legacyOutput: boolean;
  /** Skip capture and rebuild the clone manifest from existing parsed data. */
  manifestOnly: boolean;
  /** Required when manifestOnly is set; ignored otherwise. */
  captureDir?: string;
  help: boolean;
};

const HELP_TEXT = `
dr-parity clone-site (end-to-end)

Usage:
  tsx scripts/run-clone.ts <url> [options]
  tsx scripts/run-clone.ts --manifest-only --capture-dir=<dir> [options]

Options:
  --viewport=<list>      Viewport selection. One of:
                           all                  (default, all 4 viewports)
                           desktop|mobile|
                           tablet|wide          (single viewport, ~4x faster)
                           <name>,<name>,...    (comma-separated subset)
  --target=<slug>        Override the canonical target slug (defaults to host without TLD).
  --out=<dir>            Output root override. Default (canonical): clones/<target>/<iso>/.
                         With --legacy-output: docs/research/captures.
  --legacy-output        Use the legacy docs/research/captures layout.
  --no-tour              Skip the scroll/hover tour during capture.
  --no-preview           Suppress the printed preview command at the end.
  --manifest-only        Skip the capture stage and rebuild the clone manifest
                         from an existing capture directory. Requires
                         --capture-dir=<dir>. parse:har and parse:trace run
                         lazily, only for viewports that lack parsed data.
  --capture-dir=<dir>    Required when --manifest-only is set. Points at an
                         existing dated capture directory containing per
                         viewport subdirs (with parsed/document.html).
  -h, --help             Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    url: undefined,
    viewports: undefined,
    out: undefined,
    target: undefined,
    tour: true,
    preview: true,
    legacyOutput: false,
    manifestOnly: false,
    captureDir: undefined,
    help: false,
  };
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--no-tour') {
      out.tour = false;
      continue;
    }
    if (raw === '--no-preview') {
      out.preview = false;
      continue;
    }
    if (raw === '--legacy-output') {
      out.legacyOutput = true;
      continue;
    }
    if (raw === '--manifest-only') {
      out.manifestOnly = true;
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      out.viewports = raw.slice('--viewport='.length);
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
      continue;
    }
    if (raw.startsWith('--target=')) {
      out.target = raw.slice('--target='.length).trim() || undefined;
      continue;
    }
    if (raw.startsWith('--capture-dir=')) {
      out.captureDir = raw.slice('--capture-dir='.length).trim() || undefined;
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

interface RunLayout {
  /** Capture output directory (where viewports land). */
  captureDir: string;
  /** Canonical run root (parent of `captures/`). Same as captureDir under legacy. */
  runRoot: string;
}

/**
 * Resolve the on-disk layout for this run.
 *
 * Canonical: `clones/<target>/<iso>/captures/`.
 * Legacy: `docs/research/captures/<host>/<iso>/`.
 */
function resolveRunLayout(args: CliArgs, host: string): RunLayout {
  const stamp = canonicalTimestamp();
  if (args.legacyOutput) {
    const outRoot = resolve(args.out ?? LEGACY_CAPTURE_ROOT);
    const captureDir = join(outRoot, host, stamp);
    return { captureDir, runRoot: captureDir };
  }
  const baseDir = args.out ? resolve(args.out) : resolve(CANONICAL_ROOT);
  const target = args.target ?? defaultTargetFromHost(host);
  return {
    captureDir: resolve(cloneSubdir(target, stamp, 'captures', baseDir)),
    runRoot: resolve(cloneOutDir(target, stamp, baseDir)),
  };
}

/**
 * Run an in-process pipeline stage. Logs the label and the args so the
 * unified .runs/ stream sees one continuous event stream (no subprocess
 * stdout/stderr to wrangle).
 */
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

function newestSubdir(parent: string): string {
  if (!existsSync(parent)) {
    throw new Error(`Capture parent dir not found: ${parent}`);
  }
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

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface RunCloneStagePhase {
  label: string;
  ms: number;
  status: 'ok' | 'warn' | 'fail';
  exitCode: number;
}

export interface RunCloneResult {
  exitCode: number;
  /** Actual dated capture directory containing per-viewport subdirs. */
  captureRoot?: string;
  /** Canonical run root (parent of `captures/`). Same as captureRoot under legacy. */
  runRoot?: string;
  /** Per-phase timing and status records, in execution order. */
  phases: RunCloneStagePhase[];
  /** Viewports that produced a clone (after the clone stage runs). */
  viewports: string[];
}

/**
 * Decide which viewports under `captureDir` already have parsed/document.html.
 * Used by --manifest-only to skip parse stages that have nothing new to do.
 */
function viewportsNeedingParse(captureDir: string, requested?: string[]): {
  needs: string[];
  ready: string[];
} {
  if (!existsSync(captureDir)) return { needs: requested ?? [], ready: [] };
  const allDirs = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const candidates = requested && requested.length > 0
    ? requested.filter((v) => allDirs.includes(v))
    : allDirs;
  const ready: string[] = [];
  const needs: string[] = [];
  for (const vp of candidates) {
    const parsedDoc = join(captureDir, vp, 'parsed', 'document.html');
    if (existsSync(parsedDoc)) ready.push(vp);
    else needs.push(vp);
  }
  return { needs, ready };
}

/**
 * Manifest only flow.
 *
 * Skips capture entirely. Runs parse:har / parse:trace lazily, only when
 * at least one selected viewport is missing parsed/document.html. Then runs
 * complete:assets and clone for the requested viewports against the same
 * capture directory.
 */
async function runManifestOnly(
  args: CliArgs,
  phases: RunCloneStagePhase[],
): Promise<RunCloneResult> {
  const captureDir = resolve(args.captureDir!);
  if (!existsSync(captureDir) || !statSync(captureDir).isDirectory()) {
    console.error(`--capture-dir does not exist or is not a directory: ${captureDir}`);
    return { exitCode: 2, phases, viewports: [] };
  }

  const requestedViewports = args.viewports
    ? args.viewports.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const { needs, ready } = viewportsNeedingParse(captureDir, requestedViewports);
  if (needs.length === 0 && ready.length === 0) {
    console.error(`No viewports found under ${captureDir}.`);
    return { exitCode: 2, phases, viewports: [] };
  }

  console.log(`\n[manifest-only] capture dir: ${captureDir}`);
  console.log(`[manifest-only] viewports ready: ${ready.join(', ') || '<none>'}`);
  console.log(`[manifest-only] viewports needing parse: ${needs.join(', ') || '<none>'}`);

  if (needs.length > 0) {
    const t1 = Date.now();
    const harCode = await runStage(
      'parse:har',
      [captureDir],
      () => parseHarMain([captureDir]),
    );
    phases.push({
      label: 'parse:har',
      ms: Date.now() - t1,
      status: harCode === 0 ? 'ok' : 'fail',
      exitCode: harCode,
    });
    if (harCode !== 0) {
      return { exitCode: harCode, captureRoot: captureDir, runRoot: captureDir, phases, viewports: [] };
    }

    const t2 = Date.now();
    const traceCode = await runStage(
      'parse:trace',
      [captureDir],
      () => parseTraceMain([captureDir]),
    );
    phases.push({
      label: 'parse:trace',
      ms: Date.now() - t2,
      status: traceCode === 0 ? 'ok' : 'fail',
      exitCode: traceCode,
    });
    if (traceCode !== 0) {
      return { exitCode: traceCode, captureRoot: captureDir, runRoot: captureDir, phases, viewports: [] };
    }
  } else {
    console.log('[manifest-only] all selected viewports already parsed; skipping parse stages.');
  }

  const viewportList = requestedViewports && requestedViewports.length > 0
    ? requestedViewports
    : readdirSync(captureDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => existsSync(join(captureDir, name, 'parsed', 'document.html')));

  const t2b = Date.now();
  let completeStatus: 'ok' | 'warn' = 'ok';
  let lastCompleteCode = 0;
  for (const vp of viewportList) {
    const completeCliArgs = [captureDir, `--viewport=${vp}`];
    const completeCode = await runStage(
      'complete:assets',
      completeCliArgs,
      () => completeAssetsMain(completeCliArgs),
    );
    if (completeCode !== 0) {
      console.warn(`complete:assets exited non-zero for ${vp} (continuing)`);
      completeStatus = 'warn';
      lastCompleteCode = completeCode;
    }
  }
  phases.push({
    label: 'complete:assets',
    ms: Date.now() - t2b,
    status: completeStatus,
    exitCode: lastCompleteCode,
  });

  const cloneCliArgs = [captureDir];
  if (args.viewports) cloneCliArgs.push(`--viewport=${args.viewports}`);
  const t3 = Date.now();
  const cloneCode = await runStage('clone', cloneCliArgs, () => cloneMain(cloneCliArgs));
  phases.push({
    label: 'clone',
    ms: Date.now() - t3,
    status: cloneCode === 0 ? 'ok' : 'fail',
    exitCode: cloneCode,
  });
  if (cloneCode !== 0) {
    return {
      exitCode: cloneCode,
      captureRoot: captureDir,
      runRoot: captureDir,
      phases,
      viewports: [],
    };
  }

  console.log('\nPhase timings (manifest-only):');
  for (const p of phases) console.log(`  ${p.label.padEnd(12)} ${fmtMs(p.ms)}`);

  const producedViewports = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(captureDir, name, 'clone', 'index.html')));

  if (args.preview && producedViewports.length > 0) {
    console.log('\nClone manifest refreshed. Preview with:');
    for (const vp of producedViewports) {
      console.log(`  npx serve "${join(captureDir, vp, 'clone')}"`);
    }
  }

  return {
    exitCode: 0,
    captureRoot: captureDir,
    runRoot: captureDir,
    phases,
    viewports: producedViewports,
  };
}

async function main(argv: string[] = process.argv.slice(2)): Promise<RunCloneResult> {
  const phases: RunCloneStagePhase[] = [];
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(HELP_TEXT);
    return { exitCode: 2, phases, viewports: [] };
  }
  if (args.help) {
    console.log(HELP_TEXT);
    return { exitCode: 0, phases, viewports: [] };
  }

  // --manifest-only short-circuits the capture stage entirely.
  if (args.manifestOnly) {
    if (!args.captureDir) {
      console.error('--manifest-only requires --capture-dir=<dir>.');
      console.error(HELP_TEXT);
      return { exitCode: 2, phases, viewports: [] };
    }
    return runManifestOnly(args, phases);
  }

  if (!args.url) {
    console.error('Missing <url> positional argument.');
    console.error(HELP_TEXT);
    return { exitCode: 2, phases, viewports: [] };
  }

  let host: string;
  try {
    host = hostnameOf(args.url);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return { exitCode: 2, phases, viewports: [] };
  }

  const layout = resolveRunLayout(args, host);
  const captureDir = layout.captureDir;

  // Capture writes its viewports directly into `captureDir`. The capture
  // script's `--out` is the exact directory under canonical layout.
  const captureCliArgs: string[] = [args.url, `--out=${captureDir}`];
  if (args.legacyOutput) {
    // Under legacy layout, capture's --out is the parent root; restore that
    // behaviour by passing the legacy parent and letting capture derive
    // host/stamp itself.
    captureCliArgs[1] = `--out=${resolve(args.out ?? LEGACY_CAPTURE_ROOT)}`;
    captureCliArgs.push('--legacy-output');
  }
  if (args.viewports) captureCliArgs.push(`--viewport=${args.viewports}`);
  if (!args.tour) captureCliArgs.push('--no-tour');

  const t0 = Date.now();
  const captureCode = await runStage('capture', captureCliArgs, async () => {
    const result = await runCapture(captureCliArgs);
    return result.viewports.length > 0 && result.viewports.every((r) => !r.ok) ? 1 : 0;
  });
  phases.push({
    label: 'capture',
    ms: Date.now() - t0,
    status: captureCode === 0 ? 'ok' : 'fail',
    exitCode: captureCode,
  });
  if (captureCode !== 0) {
    console.error(`capture failed (exit ${captureCode})`);
    return { exitCode: captureCode, runRoot: layout.runRoot, phases, viewports: [] };
  }

  // Under legacy layout the capture script appends host/stamp, so recover
  // the actual capture dir by scanning for the newest subdir.
  let resolvedCaptureDir = captureDir;
  if (args.legacyOutput) {
    const legacyParent = join(resolve(args.out ?? LEGACY_CAPTURE_ROOT), host);
    try {
      resolvedCaptureDir = newestSubdir(legacyParent);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return { exitCode: 1, runRoot: layout.runRoot, phases, viewports: [] };
    }
  }
  console.log(`\nCapture dir: ${resolvedCaptureDir}`);
  console.log(`Run root  : ${layout.runRoot}`);

  const t1 = Date.now();
  const harCode = await runStage(
    'parse:har',
    [resolvedCaptureDir],
    () => parseHarMain([resolvedCaptureDir]),
  );
  phases.push({
    label: 'parse:har',
    ms: Date.now() - t1,
    status: harCode === 0 ? 'ok' : 'fail',
    exitCode: harCode,
  });
  if (harCode !== 0) {
    return {
      exitCode: harCode,
      captureRoot: resolvedCaptureDir,
      runRoot: layout.runRoot,
      phases,
      viewports: [],
    };
  }

  const t2 = Date.now();
  const traceCode = await runStage(
    'parse:trace',
    [resolvedCaptureDir],
    () => parseTraceMain([resolvedCaptureDir]),
  );
  phases.push({
    label: 'parse:trace',
    ms: Date.now() - t2,
    status: traceCode === 0 ? 'ok' : 'fail',
    exitCode: traceCode,
  });
  if (traceCode !== 0) {
    return {
      exitCode: traceCode,
      captureRoot: resolvedCaptureDir,
      runRoot: layout.runRoot,
      phases,
      viewports: [],
    };
  }

  const viewportList = args.viewports
    ? args.viewports.split(',').map((s) => s.trim()).filter(Boolean)
    : readdirSync(resolvedCaptureDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => existsSync(join(resolvedCaptureDir, name, 'parsed', 'document.html')));

  const t2b = Date.now();
  let completeStatus: 'ok' | 'warn' = 'ok';
  let lastCompleteCode = 0;
  for (const vp of viewportList) {
    const completeCliArgs = [resolvedCaptureDir, `--viewport=${vp}`];
    const completeCode = await runStage(
      'complete:assets',
      completeCliArgs,
      () => completeAssetsMain(completeCliArgs),
    );
    if (completeCode !== 0) {
      console.warn(`complete:assets exited non-zero for ${vp} (continuing)`);
      completeStatus = 'warn';
      lastCompleteCode = completeCode;
    }
  }
  phases.push({
    label: 'complete:assets',
    ms: Date.now() - t2b,
    status: completeStatus,
    exitCode: lastCompleteCode,
  });

  const cloneCliArgs = [resolvedCaptureDir];
  if (args.viewports) cloneCliArgs.push(`--viewport=${args.viewports}`);
  const t3 = Date.now();
  const cloneCode = await runStage('clone', cloneCliArgs, () => cloneMain(cloneCliArgs));
  phases.push({
    label: 'clone',
    ms: Date.now() - t3,
    status: cloneCode === 0 ? 'ok' : 'fail',
    exitCode: cloneCode,
  });
  if (cloneCode !== 0) {
    return {
      exitCode: cloneCode,
      captureRoot: resolvedCaptureDir,
      runRoot: layout.runRoot,
      phases,
      viewports: [],
    };
  }

  console.log('\nPhase timings:');
  for (const p of phases) console.log(`  ${p.label.padEnd(12)} ${fmtMs(p.ms)}`);

  const producedViewports = readdirSync(resolvedCaptureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(resolvedCaptureDir, name, 'clone', 'index.html')));

  if (args.preview && producedViewports.length > 0) {
    console.log('\nClone ready. Preview with:');
    for (const vp of producedViewports) {
      console.log(`  npx serve "${join(resolvedCaptureDir, vp, 'clone')}"`);
    }
  }

  return {
    exitCode: 0,
    captureRoot: resolvedCaptureDir,
    runRoot: layout.runRoot,
    phases,
    viewports: producedViewports,
  };
}

const isDirect = process.argv[1] && process.argv[1].endsWith('run-clone.ts');
if (isDirect) {
  main().then(
    (result) => process.exit(result.exitCode),
    (err) => {
      console.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    }
  );
}

export { main as runCloneEntry };
