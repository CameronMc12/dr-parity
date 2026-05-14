#!/usr/bin/env tsx
/**
 * rebuild-pro: orchestrates the full static-clone -> pro Astro pipeline.
 *
 * Usage:
 *   tsx scripts/rebuild-pro.ts <clone-dir> [options]
 *   tsx scripts/rebuild-pro.ts --help
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { buildPhases } from '../engine/orchestrator/phases';
import { runPhase } from '../engine/orchestrator/run-phase';
import { buildReport, printSummary, writeReport } from '../engine/orchestrator/report';
import { snapshotAfter, snapshotBefore } from '../engine/orchestrator/snapshot';
import type {
  OrchestratorContext,
  OrchestratorOptions,
  RebuildMode,
} from '../engine/orchestrator/types';

interface CliArgs {
  help: boolean;
  cloneDir: string | null;
  outDir: string | null;
  config: string | null;
  skip: Set<number>;
  keepGoing: boolean;
  force: boolean;
  mode: RebuildMode;
  scopeStylesMode: RebuildMode;
}

function parseMode(raw: string, flag: string): RebuildMode {
  if (raw === 'safe' || raw === 'aggressive') return raw;
  throw new Error(`Invalid ${flag} value: "${raw}". Expected "safe" or "aggressive".`);
}

const HELP = `Usage: tsx scripts/rebuild-pro.ts <clone-dir> [options]

Arguments:
  <clone-dir>           Captured clone directory (must contain index.html).

Options:
  --out=<dir>           Output Astro pro directory. Defaults to
                        <clone-dir>/../astro-pro/.
  --config=<path>       Passed through to extract-primitives as --config.
  --mode=<safe|aggressive>
                        Rebuild mode. Defaults to safe.
                          safe        Guaranteed 1:1 parity. Runs phases
                                      0-4, 7, 8, 9, 10. SKIPS phases 5
                                      (refactor-sections) and 6
                                      (scope-styles).
                          aggressive  Runs all 11 phases. May degrade
                                      parity but produces componentised
                                      sections and scoped per-component
                                      styles.
  --scope-styles-mode=<safe|aggressive>
                        Mode passed to phase 6 (scope-styles). Defaults to
                        safe (writes analysis/scope-styles-plan.json only;
                        no .astro files modified, no base.css emitted).
  --skip=<list>         Comma-separated phase numbers to skip (0..10).
  --keep-going          Continue running phases after a non-fatal failure.
  --force               Overwrite existing output directory.
  --help, -h            Show this help.

Pipeline phases:
  0  scaffold              (build-astro)
  1  extract-css
  2  extract-tokens
  3  extract-primitives
  4  iconify-svgs
  5  refactor-sections     (aggressive only)
  6  scope-styles          (aggressive only)
  7  extract-animations
  8  wire-layout           (inline: tokens + overrides + animations)
  9  build                 (npm install + npm run build)
  10 verify-parity         (non-fatal)

Outputs:
  <out>/src/styles/{tokens.css,overrides.css,base.css,token-map.json}
  <out>/src/lib/animations/
  <out>/src/components/{primitives,icons,*.astro}
  <out>/src/layouts/SiteLayout.astro
  <out>/dist/
  <out>/parity-report/
  <out>/dr-parity-run.json
`;

function parseSkipList(raw: string): Set<number> {
  const skip = new Set<number>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const num = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(num) || num < 0 || num > 10) {
      throw new Error(`Invalid phase number in --skip: "${trimmed}"`);
    }
    skip.add(num);
  }
  return skip;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    help: false,
    cloneDir: null,
    outDir: null,
    config: null,
    skip: new Set<number>(),
    keepGoing: false,
    force: false,
    mode: 'safe',
    scopeStylesMode: 'safe',
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') args.help = true;
    else if (raw === '--keep-going') args.keepGoing = true;
    else if (raw === '--force') args.force = true;
    else if (raw.startsWith('--out=')) args.outDir = raw.slice('--out='.length);
    else if (raw.startsWith('--config=')) args.config = raw.slice('--config='.length);
    else if (raw.startsWith('--skip=')) args.skip = parseSkipList(raw.slice('--skip='.length));
    else if (raw.startsWith('--scope-styles-mode=')) {
      args.scopeStylesMode = parseMode(
        raw.slice('--scope-styles-mode='.length),
        '--scope-styles-mode',
      );
    } else if (raw.startsWith('--mode=')) {
      args.mode = parseMode(raw.slice('--mode='.length), '--mode');
    } else if (raw.startsWith('--')) throw new Error(`Unknown option: ${raw}`);
    else if (args.cloneDir === null) args.cloneDir = raw;
    else throw new Error(`Unexpected positional argument: ${raw}`);
  }
  return args;
}

function absolutise(path: string, cwd: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

function validateCloneDir(cloneDir: string): void {
  if (!existsSync(cloneDir) || !statSync(cloneDir).isDirectory()) {
    throw new Error(`Clone directory not found: ${cloneDir}`);
  }
  const indexPath = join(cloneDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`Clone directory missing index.html: ${indexPath}`);
  }
}

function resolveRepoRoot(): string {
  // scripts/rebuild-pro.ts -> repo root is one level up.
  return resolve(dirname(new URL(import.meta.url).pathname), '..');
}

function buildOptions(args: CliArgs): OrchestratorOptions {
  if (!args.cloneDir) {
    throw new Error('Missing required argument: <clone-dir>');
  }
  const cwd = process.cwd();
  const cloneDir = absolutise(args.cloneDir, cwd);
  validateCloneDir(cloneDir);
  const defaultOut = resolve(cloneDir, '..', 'astro-pro');
  const outDir = args.outDir ? absolutise(args.outDir, cwd) : defaultOut;
  const analysisDir = resolve(cloneDir, '..', 'analysis');
  const primitivesConfig = args.config ? absolutise(args.config, cwd) : null;
  const repoRoot = resolveRepoRoot();
  return {
    cloneDir,
    outDir,
    analysisDir,
    primitivesConfig,
    skip: args.skip,
    keepGoing: args.keepGoing,
    force: args.force,
    repoRoot,
    mode: args.mode,
    scopeStylesMode: args.scopeStylesMode,
  };
}

async function main(): Promise<void> {
  let parsed: CliArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n\n${HELP}`);
    process.exit(2);
    return;
  }

  if (parsed.help || parsed.cloneDir === null) {
    process.stdout.write(HELP);
    process.exit(parsed.help ? 0 : 2);
    return;
  }

  let options: OrchestratorOptions;
  try {
    options = buildOptions(parsed);
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
    process.exit(2);
    return;
  }

  const ctx: OrchestratorContext = { ...options, results: [] };
  const phases = buildPhases(ctx);
  const startedAt = new Date();

  process.stdout.write(`rebuild-pro: ${ctx.cloneDir}\n`);
  process.stdout.write(`  out      : ${ctx.outDir}\n`);
  process.stdout.write(`  analysis : ${ctx.analysisDir}\n`);
  process.stdout.write(`  mode     : ${ctx.mode}\n`);
  if (ctx.skip.size > 0) {
    process.stdout.write(`  skipping : ${[...ctx.skip].sort((a, b) => a - b).join(',')}\n`);
  }

  let aborted = false;
  for (const phase of phases) {
    if (aborted) {
      ctx.results.push({
        id: phase.id,
        slug: phase.slug,
        label: phase.label,
        status: 'skipped',
        durationMs: 0,
        outputs: [],
      });
      continue;
    }
    const runsParityCheck =
      phase.parityCheck === true &&
      ctx.mode === 'aggressive' &&
      !ctx.skip.has(phase.id) &&
      (phase.requiresMode === undefined || phase.requiresMode === ctx.mode);
    const before = runsParityCheck ? await snapshotBefore(ctx, phase.slug) : null;
    const result = await runPhase(phase, ctx);
    ctx.results.push(result);
    if (runsParityCheck && result.status === 'success') {
      const parity = await snapshotAfter(ctx, before);
      if (parity.degraded && parity.delta !== null) {
        const pct = (parity.delta * 100).toFixed(2);
        const warn = `parity-degrading: diff worsened by ${pct}% after ${phase.slug}`;
        result.warning = result.warning ? `${result.warning}; ${warn}` : warn;
        process.stdout.write(`  ${warn}\n`);
      }
    }
    if (result.status === 'failed' && !ctx.keepGoing) {
      aborted = true;
    }
  }

  const finishedAt = new Date();
  printSummary(ctx.results);
  const report = buildReport(ctx, startedAt, finishedAt);
  let reportPath: string | null = null;
  if (existsSync(ctx.outDir)) {
    reportPath = writeReport(ctx, report);
    process.stdout.write(`\nRun report: ${reportPath}\n`);
  }

  const failed = ctx.results.some((r) => r.status === 'failed');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack ?? err.message : err}\n`);
  process.exit(1);
});
