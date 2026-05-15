#!/usr/bin/env tsx
/**
 * rebuild-pro: orchestrates the full static-clone -> pro Astro pipeline.
 *
 * Usage:
 *   tsx scripts/rebuild-pro.ts <clone-dir> [options]
 *   tsx scripts/rebuild-pro.ts --help
 *
 * MEDIA-AGENT: phase 14 (media-preserve) runs in BOTH safe and aggressive
 * modes; it emits responsive.css and folds the @media block into base.css
 * via a marker so the layout's existing base.css import picks it up.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { buildPhases } from '../engine/orchestrator/phases';
import { runPhase } from '../engine/orchestrator/run-phase';
import { buildReport, printSummary, writeReport } from '../engine/orchestrator/report';
import { snapshotAfter, snapshotBefore } from '../engine/orchestrator/snapshot';
import type {
  OrchestratorContext,
  OrchestratorOptions,
  RebuildMode,
} from '../engine/orchestrator/types';
// VERIFY-AGENT: emit-only recovery (no recapture; emit + build + verify only).
import { runEmitOnly } from '../engine/orchestrator/post-build/emit-only';

interface CliArgs {
  help: boolean;
  cloneDir: string | null;
  url: string | null;
  site: boolean;
  outDir: string | null;
  config: string | null;
  skip: Set<number>;
  keepGoing: boolean;
  force: boolean;
  mode: RebuildMode;
  scopeStylesMode: RebuildMode;
  maxPages: number | null;
  maxDepth: number | null;
  // CRAWLER-AGENT: path-prefix support (Fix #4)
  pathPrefix: string | null;
  pathPrefixExplicit: boolean;
  // VERIFY-AGENT: emit-only recovery (Fix #12)
  emitOnly: boolean;
  emitOnlyCaptureRoot: string | null;
  emitOnlyName: string | null;
}

function parseMode(raw: string, flag: string): RebuildMode {
  if (raw === 'safe' || raw === 'aggressive') return raw;
  throw new Error(`Invalid ${flag} value: "${raw}". Expected "safe" or "aggressive".`);
}

const HELP = `Usage: tsx scripts/rebuild-pro.ts <clone-dir> [options]
       tsx scripts/rebuild-pro.ts --url=<url> [--site] [options]

Arguments:
  <clone-dir>           Captured clone directory (must contain index.html).

Options:
  --url=<url>           Run the full capture+clone pipeline on <url> first,
                        then rebuild. Required when no <clone-dir> positional
                        is supplied. If --site is also set, runs the
                        autonomous multi-page crawl via clone-site.ts and
                        skips the per-phase rebuild loop (clone-site does
                        emission directly).
  --site                Crawl the whole site (used with --url). Hands off to
                        scripts/clone-site.ts.
  --max-pages=N         (--site only) Hard cap on discovered pages. Default 50.
                        Passed through to clone-site.ts.
  --max-depth=N         (--site only) Crawl depth from the entry URL.
                        Default 3. Passed through to clone-site.ts.
  --path-prefix=<p>     (--site only) Restrict crawl to URLs whose pathname
                        starts with <p> (e.g. /en for multi-lingual sites).
                        Auto-derived from a non-root seed path unless an
                        explicit value (including empty) is provided.
                        Passed through to clone-site.ts.
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
  --skip=<list>         Comma-separated phase numbers to skip (0..11).
  --keep-going          Continue running phases after a non-fatal failure.
  --force               Overwrite existing output directory.
  --emit-only           VERIFY-AGENT: re-emit + build + verify-render on an
                        already-captured project. Skips capture/clone entirely.
                        Requires --emit-only-capture-root=<dir> and --out=<dir>.
                        Useful when capture succeeded but emit/build failed,
                        or when the crawl was killed mid-flight.
  --emit-only-capture-root=<dir>
                        Capture tree to re-emit from. Either a single host
                        directory (e.g. .../captures/fluid.glass) or its
                        parent. All viewport/clone/index.html children are
                        discovered automatically.
  --emit-only-name=<slug>
                        Project name for the emit-only run. Defaults to the
                        basename of --out.
  --help, -h            Show this help.

Pipeline phases:
  0  scaffold              (build-astro)
  1  extract-css
  2  extract-tokens
  3  extract-primitives
  4  iconify-svgs
  14 media-preserve        (@media rules → responsive.css + base.css marker)
  5  refactor-sections     (aggressive only)
  6  scope-styles          (aggressive only)
  7  extract-animations
  8  wire-layout           (inline: tokens + overrides + animations)
  12 centralize-content    (inline: src/content/site.ts + section rewrites)
  9  build                 (npm install + npm run build)
  10 verify-parity         (non-fatal)
  11 edit-playbook         (non-fatal — writes EDIT.md)
  13 verify-render         (non-fatal — boots dev server, smoke-tests routes)

Outputs:
  <out>/src/styles/{tokens.css,overrides.css,base.css,token-map.json}
  <out>/src/lib/animations/
  <out>/src/components/{primitives,icons,*.astro}
  <out>/src/layouts/SiteLayout.astro
  <out>/dist/
  <out>/parity-report/
  <out>/EDIT.md
  <out>/dr-parity-run.json
`;

function parseSkipList(raw: string): Set<number> {
  const skip = new Set<number>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const num = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(num) || num < 0 || num > 11) {
      throw new Error(`Invalid phase number in --skip: "${trimmed}"`);
    }
    skip.add(num);
  }
  return skip;
}

function parseNonNegativeInt(raw: string, flag: string): number {
  const v = Number.parseInt(raw, 10);
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(`Invalid ${flag} value: "${raw}". Expected a non-negative integer.`);
  }
  return v;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    help: false,
    cloneDir: null,
    url: null,
    site: false,
    outDir: null,
    config: null,
    skip: new Set<number>(),
    keepGoing: false,
    force: false,
    mode: 'safe',
    scopeStylesMode: 'safe',
    maxPages: null,
    maxDepth: null,
    pathPrefix: null,
    pathPrefixExplicit: false,
    emitOnly: false,
    emitOnlyCaptureRoot: null,
    emitOnlyName: null,
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') args.help = true;
    else if (raw === '--keep-going') args.keepGoing = true;
    else if (raw === '--force') args.force = true;
    else if (raw === '--emit-only') args.emitOnly = true;
    else if (raw.startsWith('--emit-only-capture-root=')) {
      args.emitOnlyCaptureRoot = raw.slice('--emit-only-capture-root='.length);
    } else if (raw.startsWith('--emit-only-name=')) {
      args.emitOnlyName = raw.slice('--emit-only-name='.length);
    }
    else if (raw === '--site') args.site = true;
    else if (raw.startsWith('--url=')) args.url = raw.slice('--url='.length);
    else if (raw.startsWith('--out=')) args.outDir = raw.slice('--out='.length);
    else if (raw.startsWith('--config=')) args.config = raw.slice('--config='.length);
    else if (raw.startsWith('--skip=')) args.skip = parseSkipList(raw.slice('--skip='.length));
    else if (raw.startsWith('--max-pages=')) {
      args.maxPages = parseNonNegativeInt(raw.slice('--max-pages='.length), '--max-pages');
    } else if (raw.startsWith('--max-depth=')) {
      args.maxDepth = parseNonNegativeInt(raw.slice('--max-depth='.length), '--max-depth');
    } else if (raw.startsWith('--path-prefix=')) {
      // CRAWLER-AGENT: path-prefix flag (Fix #4)
      args.pathPrefix = raw.slice('--path-prefix='.length);
      args.pathPrefixExplicit = true;
    } else if (raw.startsWith('--scope-styles-mode=')) {
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

function spawnAsync(cmd: string, cmdArgs: string[]): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit' });
    child.on('exit', (code) => resolveExit(code ?? 0));
    child.on('error', (err) => {
      process.stderr.write(`spawn error: ${err.message}\n`);
      resolveExit(1);
    });
  });
}

function newestCloneDir(captureRoot: string, host: string): string {
  const hostDir = join(captureRoot, host);
  const subs = readdirSync(hostDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ full: join(hostDir, e.name), mtime: statSync(join(hostDir, e.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (subs.length === 0) throw new Error(`No captures under ${hostDir}`);
  // Find a viewport clone inside.
  const ts = subs[0].full;
  const desktop = join(ts, 'desktop', 'clone');
  if (existsSync(join(desktop, 'index.html'))) return desktop;
  const vps = readdirSync(ts, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(ts, e.name, 'clone'))
    .filter((p) => existsSync(join(p, 'index.html')));
  if (vps.length === 0) throw new Error(`No clone found under ${ts}`);
  return vps[0];
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

  if (parsed.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }

  // VERIFY-AGENT: --emit-only short-circuits the full pipeline.
  if (parsed.emitOnly) {
    if (!parsed.emitOnlyCaptureRoot) {
      process.stderr.write(
        'Error: --emit-only requires --emit-only-capture-root=<dir>\n',
      );
      process.exit(2);
      return;
    }
    if (!parsed.outDir) {
      process.stderr.write('Error: --emit-only requires --out=<dir>\n');
      process.exit(2);
      return;
    }
    const emitCwd = process.cwd();
    const emitCaptureRoot = absolutise(parsed.emitOnlyCaptureRoot, emitCwd);
    const emitOutDir = absolutise(parsed.outDir, emitCwd);
    const emitName =
      parsed.emitOnlyName ?? emitOutDir.split('/').filter(Boolean).pop() ?? 'rebuild-pro';
    try {
      const result = await runEmitOnly({
        captureRoot: emitCaptureRoot,
        outDir: emitOutDir,
        name: emitName,
        force: parsed.force,
      });
      process.stdout.write(`\nemit-only complete: ${result.outDir}\n`);
      if (result.verifyReport) {
        process.stdout.write(
          `  verify-render: ${result.verifyReport.passed}/${result.verifyReport.routesChecked} routes passed\n`,
        );
      }
      process.exit(result.built ? 0 : 1);
      return;
    } catch (err) {
      process.stderr.write(
        `emit-only failed: ${err instanceof Error ? err.message : err}\n`,
      );
      process.exit(1);
      return;
    }
  }

  if (
    (parsed.maxPages !== null ||
      parsed.maxDepth !== null ||
      parsed.pathPrefixExplicit) &&
    !parsed.site
  ) {
    process.stderr.write(
      'Warning: --max-pages, --max-depth, and --path-prefix are only used with --site; ignoring.\n',
    );
  }

  // --site: hand off to clone-site.ts (autonomous multi-page).
  if (parsed.site) {
    if (!parsed.url) {
      process.stderr.write('Error: --site requires --url=<entry-url>\n');
      process.exit(2);
      return;
    }
    const cloneSiteArgs = ['tsx', 'scripts/clone-site.ts', parsed.url];
    if (parsed.outDir) cloneSiteArgs.push(`--astro-out=${parsed.outDir}`);
    if (parsed.force) cloneSiteArgs.push('--force');
    if (parsed.maxPages !== null) cloneSiteArgs.push(`--max-pages=${parsed.maxPages}`);
    if (parsed.maxDepth !== null) cloneSiteArgs.push(`--max-depth=${parsed.maxDepth}`);
    // CRAWLER-AGENT: forward --path-prefix to clone-site (Fix #4). Pass it
    // through ONLY when the user set it explicitly; otherwise let clone-site
    // do its own auto-detection from the seed URL.
    if (parsed.pathPrefixExplicit) {
      cloneSiteArgs.push(`--path-prefix=${parsed.pathPrefix ?? ''}`);
    }
    const code = await spawnAsync('npx', cloneSiteArgs);
    process.exit(code);
    return;
  }

  // --url (single page): run capture+clone, then continue with phases.
  if (parsed.url && parsed.cloneDir === null) {
    process.stdout.write(`rebuild-pro: running single-page clone for ${parsed.url}\n`);
    const code = await spawnAsync('npx', ['tsx', 'scripts/run-clone.ts', parsed.url]);
    if (code !== 0) {
      process.stderr.write(`run-clone failed (exit ${code})\n`);
      process.exit(code);
      return;
    }
    try {
      const host = new URL(parsed.url).hostname;
      const captureRoot = resolve('docs/research/captures');
      parsed.cloneDir = newestCloneDir(captureRoot, host);
      process.stdout.write(`rebuild-pro: clone dir = ${parsed.cloneDir}\n`);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
      return;
    }
  }

  if (parsed.cloneDir === null) {
    process.stdout.write(HELP);
    process.exit(2);
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
