#!/usr/bin/env tsx
/**
 * End-to-end clone pipeline.
 *
 * Runs: capture -> parse:har -> parse:trace -> clone.
 *
 * Usage:
 *   tsx scripts/run-clone.ts <url> [--viewport=desktop,...] [--out=<dir>] [--no-tour] [--no-preview]
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  CANONICAL_ROOT,
  canonicalTimestamp,
  cloneOutDir,
  cloneSubdir,
  defaultTargetFromHost,
} from '../engine/cli/canonical-paths';

const LEGACY_CAPTURE_ROOT = 'docs/research/captures';

type CliArgs = {
  url?: string;
  viewports?: string;
  out?: string;
  target?: string;
  tour: boolean;
  preview: boolean;
  legacyOutput: boolean;
  help: boolean;
};

const HELP_TEXT = `
dr-parity clone-site (end-to-end)

Usage:
  tsx scripts/run-clone.ts <url> [options]

Options:
  --viewport=<list>  Viewport selection. One of:
                       all                    (default, all 4 viewports)
                       desktop|mobile|
                       tablet|wide            (single viewport, ~4x faster)
                       <name>,<name>,...      (comma-separated subset)
  --target=<slug>    Override the canonical target slug (defaults to host without TLD).
  --out=<dir>        Output root override. Default (canonical): clones/<target>/<iso>/.
                     With --legacy-output: docs/research/captures.
  --legacy-output    Use the legacy docs/research/captures layout.
  --no-tour          Skip the scroll/hover tour during capture.
  --no-preview       Suppress the printed preview command at the end.
  -h, --help         Show this help.
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

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
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
    console.error('Missing <url> positional argument.');
    console.error(HELP_TEXT);
    return 2;
  }

  let host: string;
  try {
    host = hostnameOf(args.url);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  const layout = resolveRunLayout(args, host);
  const captureDir = layout.captureDir;

  // Capture writes its viewports directly into `captureDir`. The capture
  // script's `--out` is the exact directory under canonical layout.
  const captureArgs: string[] = ['scripts/capture.ts', args.url, `--out=${captureDir}`];
  if (args.legacyOutput) {
    // Under legacy layout, capture's --out is the parent root; restore that
    // behaviour by passing the legacy parent and letting capture derive
    // host/stamp itself.
    captureArgs[2] = `--out=${resolve(args.out ?? LEGACY_CAPTURE_ROOT)}`;
    captureArgs.push('--legacy-output');
  }
  if (args.viewports) captureArgs.push(`--viewport=${args.viewports}`);
  if (!args.tour) captureArgs.push('--no-tour');

  const phases: { label: string; ms: number }[] = [];

  const t0 = Date.now();
  const captureCode = await runStep('capture', 'npx', ['tsx', ...captureArgs]);
  phases.push({ label: 'capture', ms: Date.now() - t0 });
  if (captureCode !== 0) {
    console.error(`capture failed (exit ${captureCode})`);
    return captureCode;
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
      return 1;
    }
  }
  console.log(`\nCapture dir: ${resolvedCaptureDir}`);
  console.log(`Run root  : ${layout.runRoot}`);

  const t1 = Date.now();
  const harCode = await runStep('parse:har', 'npx', ['tsx', 'scripts/parse-har.ts', resolvedCaptureDir]);
  phases.push({ label: 'parse:har', ms: Date.now() - t1 });
  if (harCode !== 0) return harCode;

  const t2 = Date.now();
  const traceCode = await runStep('parse:trace', 'npx', [
    'tsx',
    'scripts/parse-trace.ts',
    resolvedCaptureDir,
  ]);
  phases.push({ label: 'parse:trace', ms: Date.now() - t2 });
  if (traceCode !== 0) return traceCode;

  const viewportList = args.viewports
    ? args.viewports.split(',').map((s) => s.trim()).filter(Boolean)
    : readdirSync(resolvedCaptureDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => existsSync(join(resolvedCaptureDir, name, 'parsed', 'document.html')));

  const t2b = Date.now();
  for (const vp of viewportList) {
    const completeCode = await runStep('complete:assets', 'npx', [
      'tsx',
      'scripts/complete-assets.ts',
      resolvedCaptureDir,
      `--viewport=${vp}`,
    ]);
    if (completeCode !== 0) {
      console.warn(`complete:assets exited non-zero for ${vp} (continuing)`);
    }
  }
  phases.push({ label: 'complete:assets', ms: Date.now() - t2b });

  const cloneArgs = ['tsx', 'scripts/clone.ts', resolvedCaptureDir];
  if (args.viewports) cloneArgs.push(`--viewport=${args.viewports}`);
  const t3 = Date.now();
  const cloneCode = await runStep('clone', 'npx', cloneArgs);
  phases.push({ label: 'clone', ms: Date.now() - t3 });
  if (cloneCode !== 0) return cloneCode;

  console.log('\nPhase timings:');
  for (const p of phases) console.log(`  ${p.label.padEnd(12)} ${fmtMs(p.ms)}`);

  if (args.preview) {
    const viewports = readdirSync(resolvedCaptureDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => existsSync(join(resolvedCaptureDir, name, 'clone', 'index.html')));
    if (viewports.length > 0) {
      console.log('\nClone ready. Preview with:');
      for (const vp of viewports) {
        console.log(`  npx serve "${join(resolvedCaptureDir, vp, 'clone')}"`);
      }
    }
  }

  return 0;
}

const isDirect = process.argv[1] && process.argv[1].endsWith('run-clone.ts');
if (isDirect) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    }
  );
}

export { main as runCloneEntry };
