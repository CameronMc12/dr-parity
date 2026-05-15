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

type CliArgs = {
  url?: string;
  viewports?: string;
  out: string;
  tour: boolean;
  preview: boolean;
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
  --out=<dir>        Output root for captures. Default: docs/research/captures
  --no-tour          Skip the scroll/hover tour during capture.
  --no-preview       Suppress the printed preview command at the end.
  -h, --help         Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    url: undefined,
    viewports: undefined,
    out: 'docs/research/captures',
    tour: true,
    preview: true,
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
    if (raw.startsWith('--viewport=')) {
      out.viewports = raw.slice('--viewport='.length);
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
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

  const outRoot = resolve(args.out);
  const hostParent = join(outRoot, host);

  const captureArgs = ['scripts/capture.ts', args.url, `--out=${outRoot}`];
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

  let captureDir: string;
  try {
    captureDir = newestSubdir(hostParent);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`\nCapture dir: ${captureDir}`);

  const t1 = Date.now();
  const harCode = await runStep('parse:har', 'npx', ['tsx', 'scripts/parse-har.ts', captureDir]);
  phases.push({ label: 'parse:har', ms: Date.now() - t1 });
  if (harCode !== 0) return harCode;

  const t2 = Date.now();
  const traceCode = await runStep('parse:trace', 'npx', [
    'tsx',
    'scripts/parse-trace.ts',
    captureDir,
  ]);
  phases.push({ label: 'parse:trace', ms: Date.now() - t2 });
  if (traceCode !== 0) return traceCode;

  const viewportList = args.viewports
    ? args.viewports.split(',').map((s) => s.trim()).filter(Boolean)
    : readdirSync(captureDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => existsSync(join(captureDir, name, 'parsed', 'document.html')));

  const t2b = Date.now();
  for (const vp of viewportList) {
    const completeCode = await runStep('complete:assets', 'npx', [
      'tsx',
      'scripts/complete-assets.ts',
      captureDir,
      `--viewport=${vp}`,
    ]);
    if (completeCode !== 0) {
      console.warn(`complete:assets exited non-zero for ${vp} (continuing)`);
    }
  }
  phases.push({ label: 'complete:assets', ms: Date.now() - t2b });

  const cloneArgs = ['tsx', 'scripts/clone.ts', captureDir];
  if (args.viewports) cloneArgs.push(`--viewport=${args.viewports}`);
  const t3 = Date.now();
  const cloneCode = await runStep('clone', 'npx', cloneArgs);
  phases.push({ label: 'clone', ms: Date.now() - t3 });
  if (cloneCode !== 0) return cloneCode;

  console.log('\nPhase timings:');
  for (const p of phases) console.log(`  ${p.label.padEnd(12)} ${fmtMs(p.ms)}`);

  if (args.preview) {
    const viewports = readdirSync(captureDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => existsSync(join(captureDir, name, 'clone', 'index.html')));
    if (viewports.length > 0) {
      console.log('\nClone ready. Preview with:');
      for (const vp of viewports) {
        console.log(`  npx serve "${join(captureDir, vp, 'clone')}"`);
      }
    }
  }

  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  }
);
