#!/usr/bin/env tsx
/**
 * Unified multi-target clone -> framework CLI.
 *
 * Dispatches to the requested `TargetAdapter` (Astro, React, or Webapp) via
 * dynamic import so that one target failing to load (e.g. while it's still
 * being scaffolded) does not break the other.
 *
 * Usage:
 *   tsx scripts/build.ts <clone-dir> --target=astro [--out=<dir>] [--name=<slug>] [--force]
 *   tsx scripts/build.ts <clone-dir> --target=react [--out=<dir>] [--name=<slug>] [--force]
 *   tsx scripts/build.ts <clone-dir> --target=webapp --crawl-dir=<path> [--out=<dir>]
 *   tsx scripts/build.ts --help
 *
 * Also supports `--clone-dir=<path>` and `--out-dir=<path>` as long-form
 * equivalents to the positional clone dir and `--out` flag.
 *
 * `--crawl-dir=<path>` is consumed exclusively by the webapp target. It
 * points at a crawler output directory (graph.json plus per-state DOM
 * snapshots) and lands on TargetBuildOptions.crawlDir. Other targets
 * ignore the flag entirely.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import type {
  TargetAdapter,
  TargetBuildOptions,
  TargetBuildSummary,
  TargetMultiBuildSummary,
} from '../engine/targets/types';

type TargetName = 'astro' | 'react' | 'webapp';

interface MultiCloneSpec {
  cloneDir: string;
  pathname: string;
}

interface ParsedArgs {
  help: boolean;
  cloneDir: string | null;
  multiCloneDirs: MultiCloneSpec[];
  outDir: string | null;
  name: string | null;
  target: string | null;
  force: boolean;
  crawlDir: string | null;
}

const HELP = `Usage:
  tsx scripts/build.ts <clone-dir> --target=<astro|react|webapp> [options]     # single-page
  tsx scripts/build.ts --target=webapp --crawl-dir=<path> --out=<dir>          # crawl-only (webapp)
  tsx scripts/build.ts --target=<astro|react> --clone-dir=<path>:<pathname> \\  # multi-page
                       --clone-dir=<path2>:<pathname2> --out-dir=<dir>

Arguments:
  <clone-dir>           Path to a captured clone directory containing
                        index.html and manifest.json. May also be supplied
                        as --clone-dir=<path>. For multi-page builds pass
                        --clone-dir=<path>:<pathname> two or more times.

Required:
  --target=<name>       One of: astro, react, webapp.

Options:
  --out=<dir>           Output directory. For single-page defaults to a
                        sibling '<target>-site/' next to <clone-dir>; for
                        multi-page it is required. May also be supplied as
                        --out-dir=<dir>.
  --name=<slug>         Project name written into package.json. Defaults to
                        the documentUrl host from manifest.json (or the
                        clone folder).
  --crawl-dir=<path>    Path to a crawler output directory (graph.json plus
                        per-state DOM snapshots). Consumed by the webapp
                        target only; ignored by astro and react. Lands on
                        TargetBuildOptions.crawlDir. When supplied to
                        --target=webapp WITHOUT a clone-dir, the build derives
                        its document head + documentUrl from the crawl's
                        root-state DOM and graph.json (--out is required).
  --force               Overwrite the output directory if it already exists.
  --help                Show this help text.

Multi-page mode is triggered when --clone-dir is supplied two or more times.
Each value must be path:pathname, e.g. './clone-home:/' or
'./clone-about:/about-us/'.

The script never modifies the clone directories.`;

const VALID_TARGETS: ReadonlySet<TargetName> = new Set(['astro', 'react', 'webapp']);

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    cloneDir: null,
    multiCloneDirs: [],
    outDir: null,
    name: null,
    target: null,
    force: false,
    crawlDir: null,
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      result.help = true;
    } else if (raw === '--force') {
      result.force = true;
    } else if (raw.startsWith('--clone-dir=')) {
      const value = raw.slice('--clone-dir='.length);
      // path:pathname syntax routes to multi-page; bare path falls through
      // to the legacy single-page slot.
      const colonIdx = value.indexOf(':');
      const looksLikePathnameSpec =
        colonIdx > 0 && value.slice(colonIdx + 1).startsWith('/');
      if (looksLikePathnameSpec) {
        const path = value.slice(0, colonIdx);
        const pathname = value.slice(colonIdx + 1);
        result.multiCloneDirs.push({ cloneDir: path, pathname });
      } else if (result.cloneDir === null) {
        result.cloneDir = value;
      } else {
        // Second bare --clone-dir without pathname suffix — treat as multi
        // and assign sequential pathnames "/", "/page-2", ... as fallback.
        result.multiCloneDirs.push({
          cloneDir: result.cloneDir,
          pathname: '/',
        });
        result.multiCloneDirs.push({
          cloneDir: value,
          pathname: `/page-${result.multiCloneDirs.length + 1}`,
        });
        result.cloneDir = null;
      }
    } else if (raw.startsWith('--out-dir=')) {
      result.outDir = raw.slice('--out-dir='.length);
    } else if (raw.startsWith('--out=')) {
      result.outDir = raw.slice('--out='.length);
    } else if (raw.startsWith('--name=')) {
      result.name = raw.slice('--name='.length);
    } else if (raw.startsWith('--target=')) {
      result.target = raw.slice('--target='.length);
    } else if (raw.startsWith('--crawl-dir=')) {
      result.crawlDir = raw.slice('--crawl-dir='.length);
    } else if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    } else if (result.cloneDir === null) {
      result.cloneDir = raw;
    } else {
      throw new Error(`Unexpected positional argument: ${raw}`);
    }
  }
  return result;
}

function assertValidTarget(value: string | null): asserts value is TargetName {
  if (value === null || value.length === 0) {
    throw new Error('Missing required flag: --target=<astro|react>');
  }
  if (!VALID_TARGETS.has(value as TargetName)) {
    throw new Error(
      `Invalid --target value "${value}". Must be one of: ${[...VALID_TARGETS].join(', ')}`,
    );
  }
}

function assertValidCloneDir(cloneDir: string): void {
  if (!existsSync(cloneDir)) {
    throw new Error(`Clone directory does not exist: ${cloneDir}`);
  }
  const stat = statSync(cloneDir);
  if (!stat.isDirectory()) {
    throw new Error(`Clone path is not a directory: ${cloneDir}`);
  }
  const indexPath = join(cloneDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(
      `Clone directory missing index.html (looked for ${indexPath}). Re-run the capture step first.`,
    );
  }
}

function assertWritableOutDir(outDir: string, force: boolean): void {
  if (!existsSync(outDir)) {
    const parent = dirname(outDir);
    if (!existsSync(parent)) {
      throw new Error(`Output parent directory does not exist: ${parent}`);
    }
    return;
  }
  const stat = statSync(outDir);
  if (!stat.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${outDir}`);
  }
  if (!force) {
    throw new Error(
      `Output directory already exists: ${outDir}. Pass --force to overwrite.`,
    );
  }
}

function deriveDefaultName(cloneDir: string): string {
  const manifestPath = join(cloneDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { documentUrl?: string };
      const url = manifest.documentUrl;
      if (typeof url === 'string' && url.length > 0) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          if (host.length > 0) return host.replace(/[^a-z0-9.-]/gi, '-');
        } catch {
          // fall through
        }
      }
    } catch {
      // fall through
    }
  }
  return basename(resolve(cloneDir, '..')) || 'cloned-site';
}

function defaultOutDir(cloneDir: string, target: TargetName): string {
  return join(dirname(resolve(cloneDir)), `${target}-site`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function printSummary(target: TargetName, summary: TargetBuildSummary): void {
  console.log(`\nWrote ${target} project: ${summary.outDir}`);
  console.log(
    `Components emitted: ${summary.componentsEmitted}, pages emitted: ${summary.pagesEmitted}`,
  );
  console.log(`Assets copied: ${summary.assetCount} files (${formatBytes(summary.assetBytes)})`);
}

async function loadAdapter(target: TargetName): Promise<TargetAdapter> {
  if (target === 'astro') {
    const mod = await import('../engine/targets/astro/index');
    return mod.astroAdapter;
  }
  if (target === 'webapp') {
    const mod = (await import('../engine/targets/webapp/index')) as { webappAdapter: TargetAdapter };
    if (!mod || typeof mod.webappAdapter?.build !== 'function') {
      throw new Error(
        'Webapp adapter not available — engine/targets/webapp/index.ts does not export webappAdapter yet.',
      );
    }
    return mod.webappAdapter;
  }
  // React adapter — import lazily so this script still works when the
  // React target hasn't been scaffolded yet.
  // TODO: drop the @ts-ignore once engine/targets/react/index.ts ships.
  // @ts-ignore — module is generated by the React target work-stream.
  const mod = (await import('../engine/targets/react/index')) as { reactAdapter: TargetAdapter };
  if (!mod || typeof mod.reactAdapter?.build !== 'function') {
    throw new Error(
      'React adapter not available — engine/targets/react/index.ts does not export reactAdapter yet.',
    );
  }
  return mod.reactAdapter;
}

export interface RunBuildArgs {
  argv: string[];
  /** Optional override for the target. When set, --target is ignored. */
  forcedTarget?: TargetName;
}

function printMultiSummary(target: TargetName, summary: TargetMultiBuildSummary): void {
  const pageExt = target === 'astro' ? '.astro' : '.html';
  console.log(`\nWrote ${target} project: ${summary.outDir}`);
  console.log(`Pages emitted: ${summary.pagesEmitted.length}`);
  for (const p of summary.pagesEmitted) console.log(`  - ${p}${pageExt}`);
  console.log(`Shared components: ${summary.sharedComponents.length}`);
  console.log(`Per-page components: ${summary.perPageComponents}`);
  console.log(`Assets copied: ${summary.assetCount} files (${formatBytes(summary.assetBytes)})`);
}

function assertValidCrawlDir(crawlDir: string): void {
  if (!existsSync(crawlDir)) {
    throw new Error(`Crawl directory does not exist: ${crawlDir}`);
  }
  if (!statSync(crawlDir).isDirectory()) {
    throw new Error(`Crawl path is not a directory: ${crawlDir}`);
  }
  if (!existsSync(join(crawlDir, 'graph.json'))) {
    throw new Error(
      `Crawl directory missing graph.json (looked in ${crawlDir}). Run the crawl step first.`,
    );
  }
}

/** Derive a default project name from the crawl graph's startUrl host. */
function deriveCrawlName(crawlDir: string): string {
  const graphPath = join(crawlDir, 'graph.json');
  if (existsSync(graphPath)) {
    try {
      const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as {
        startUrl?: string;
        nodes?: { url?: string }[];
      };
      const url = graph.startUrl ?? graph.nodes?.[0]?.url ?? '';
      if (url.length > 0) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          if (host.length > 0) return host.replace(/[^a-z0-9.-]/gi, '-');
        } catch {
          // fall through
        }
      }
    } catch {
      // fall through
    }
  }
  return basename(resolve(crawlDir)) || 'webapp-site';
}

/**
 * Crawl-only webapp build: no positional clone-dir. The webapp adapter sources
 * its document head + documentUrl from the crawl's root-state DOM and graph.json
 * instead of a clone index.html. `--out`/`--out-dir` is required because there
 * is no clone-dir sibling to default a `webapp-site/` folder next to.
 */
async function runWebappCrawlOnly(parsed: ParsedArgs): Promise<void> {
  const crawlDir = isAbsolute(parsed.crawlDir as string)
    ? (parsed.crawlDir as string)
    : resolve(parsed.crawlDir as string);

  try {
    assertValidCrawlDir(crawlDir);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  if (!parsed.outDir) {
    console.error('Crawl-only webapp build requires --out=<dir> (or --out-dir=<dir>).');
    process.exit(2);
    return;
  }
  const outDir = isAbsolute(parsed.outDir) ? parsed.outDir : resolve(parsed.outDir);

  try {
    assertWritableOutDir(outDir, parsed.force);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  const name = parsed.name ?? deriveCrawlName(crawlDir);

  try {
    const adapter = await loadAdapter('webapp');
    const buildOptions: TargetBuildOptions = {
      outDir,
      name,
      force: parsed.force,
      crawlDir,
    };
    const summary = await adapter.build(buildOptions);
    printSummary('webapp', summary);
  } catch (err) {
    console.error(`build (webapp, crawl-only) failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

export async function runBuild({ argv, forcedTarget }: RunBuildArgs): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    console.error(HELP);
    process.exit(2);
    return;
  }

  const isMulti = parsed.multiCloneDirs.length > 0;

  // Crawl-only webapp mode: --target=webapp --crawl-dir=<dir> with NO clone-dir.
  // The webapp target derives its document head + documentUrl from the crawl's
  // root-state DOM and graph.json, so a positional clone-dir is not required.
  const resolvedTarget = forcedTarget ?? parsed.target;
  const isWebappCrawlOnly =
    resolvedTarget === 'webapp' &&
    parsed.cloneDir === null &&
    !isMulti &&
    parsed.crawlDir !== null;

  if (parsed.help || (parsed.cloneDir === null && !isMulti && !isWebappCrawlOnly)) {
    console.log(HELP);
    process.exit(parsed.help ? 0 : 2);
    return;
  }

  const target: TargetName = forcedTarget ?? (() => {
    assertValidTarget(parsed.target);
    return parsed.target;
  })();

  if (isWebappCrawlOnly) {
    await runWebappCrawlOnly(parsed);
    return;
  }

  if (isMulti) {
    if (!parsed.outDir) {
      console.error('Multi-page build requires --out-dir=<dir>.');
      process.exit(2);
      return;
    }
    const outDir = isAbsolute(parsed.outDir) ? parsed.outDir : resolve(parsed.outDir);
    try {
      assertWritableOutDir(outDir, parsed.force);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(2);
      return;
    }
    for (const spec of parsed.multiCloneDirs) {
      try {
        assertValidCloneDir(resolve(spec.cloneDir));
      } catch (err) {
        console.error((err as Error).message);
        process.exit(2);
        return;
      }
    }
    const name =
      parsed.name ?? deriveDefaultName(resolve(parsed.multiCloneDirs[0].cloneDir));

    try {
      const adapter = await loadAdapter(target);
      if (typeof adapter.buildMulti !== 'function') {
        throw new Error(
          `Target "${target}" does not implement buildMulti — multi-page builds are not supported.`,
        );
      }
      const summary = await adapter.buildMulti({
        pages: parsed.multiCloneDirs.map((s) => ({
          cloneDir: resolve(s.cloneDir),
          pathname: s.pathname,
        })),
        outDir,
        name,
        force: parsed.force,
      });
      printMultiSummary(target, summary);
    } catch (err) {
      console.error(`build (${target}, multi) failed: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }

  const cloneDir = resolve(parsed.cloneDir as string);
  try {
    assertValidCloneDir(cloneDir);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  const outDir = parsed.outDir
    ? (isAbsolute(parsed.outDir) ? parsed.outDir : resolve(parsed.outDir))
    : defaultOutDir(cloneDir, target);

  try {
    assertWritableOutDir(outDir, parsed.force);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  const name = parsed.name ?? deriveDefaultName(cloneDir);

  try {
    const adapter = await loadAdapter(target);
    const buildOptions: TargetBuildOptions = {
      cloneDir,
      outDir,
      name,
      force: parsed.force,
      ...(parsed.crawlDir
        ? { crawlDir: isAbsolute(parsed.crawlDir) ? parsed.crawlDir : resolve(parsed.crawlDir) }
        : {}),
    };
    if (parsed.crawlDir && target !== 'webapp') {
      console.warn(
        `Warning: --crawl-dir is only consumed by --target=webapp; ignored for target "${target}".`,
      );
    }
    const summary = await adapter.build(buildOptions);
    printSummary(target, summary);
  } catch (err) {
    console.error(`build (${target}) failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Run only when invoked directly, not when imported by the shim.
const invokedDirectly = (() => {
  try {
    const entry = process.argv[1] ?? '';
    return entry.endsWith('/scripts/build.ts') || entry.endsWith('\\scripts\\build.ts');
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  runBuild({ argv: process.argv.slice(2) });
}
