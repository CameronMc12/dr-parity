/**
 * emit-only: re-run Astro emission + build + render verification on an
 * existing capture directory, without re-capturing pages.
 *
 * Use when:
 *   - capture succeeded but the emit step crashed or was killed
 *   - you want to iterate on the emitter against a frozen capture set
 *   - you killed the crawl mid-flight and want to salvage what landed
 *
 * The capture tree is expected to look like:
 *   <captureRoot>/<host>/<timestamp>/<viewport>/clone/index.html
 *   <captureRoot>/<host>/<timestamp>/<viewport>/clone/manifest.json
 *
 * Each captured page gets its pathname from the URL stored in manifest.json
 * (or, when missing, from a CLI-supplied map).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { buildAstroMulti, type MultiPageInput } from '../../astro/build-multi';
import { verifyRender, type VerifyRenderReport } from '../../verify/render';

export interface EmitOnlyOptions {
  /** Capture root containing one or more timestamped page captures. */
  captureRoot: string;
  /** Output Astro project directory. */
  outDir: string;
  /** Project name (used for Astro scaffold). */
  name: string;
  /** Overwrite the output directory if present. */
  force?: boolean;
  /** Viewport subdirectory to source. Defaults to "desktop". */
  viewport?: string;
  /** Skip the build + verify-render steps (emit-only). */
  emitOnly?: boolean;
  /** Skip the verify-render step. */
  skipVerify?: boolean;
  /** Optional explicit page overrides, used when manifest.json is absent. */
  pages?: MultiPageInput[];
  /** Optional progress log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

export interface EmitOnlyResult {
  outDir: string;
  pagesEmitted: string[];
  sharedComponents: string[];
  perPageComponents: number;
  assetCount: number;
  assetBytes: number;
  built: boolean;
  buildExitCode: number | null;
  verifyReport: VerifyRenderReport | null;
}

interface DiscoveredPage {
  cloneDir: string;
  pathname: string;
  url?: string;
}

interface ManifestShape {
  url?: string;
  pathname?: string;
}

function safeReadManifest(cloneDir: string): ManifestShape | null {
  const manifestPath = join(cloneDir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as ManifestShape;
    return parsed;
  } catch {
    return null;
  }
}

function urlToPathname(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname || '/';
    return p === '' ? '/' : p;
  } catch {
    if (rawUrl.startsWith('/')) return rawUrl;
    return '/' + rawUrl;
  }
}

/**
 * Walk a capture root and return every clone directory containing an
 * index.html under the requested viewport.
 */
export function discoverCapturedPages(
  captureRoot: string,
  viewport: string,
): DiscoveredPage[] {
  if (!existsSync(captureRoot) || !statSync(captureRoot).isDirectory()) {
    throw new Error(`captureRoot not found or not a directory: ${captureRoot}`);
  }
  const results: DiscoveredPage[] = [];
  // captureRoot may itself be a single host dir, or a parent containing many.
  // Detect by checking whether children look like timestamps.
  const topEntries = readdirSync(captureRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory());
  const looksLikeHostDir = topEntries.some((e) => /^\d{4}-\d{2}-\d{2}T/.test(e.name));
  const hostDirs = looksLikeHostDir
    ? [captureRoot]
    : topEntries.map((e) => join(captureRoot, e.name));

  for (const hostDir of hostDirs) {
    let timestampEntries: { name: string }[];
    try {
      timestampEntries = readdirSync(hostDir, { withFileTypes: true })
        .filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    for (const tsEntry of timestampEntries) {
      const cloneDir = join(hostDir, tsEntry.name, viewport, 'clone');
      if (!existsSync(join(cloneDir, 'index.html'))) continue;
      const manifest = safeReadManifest(cloneDir);
      const url = manifest?.url;
      const pathname = manifest?.pathname
        ?? (url ? urlToPathname(url) : '/');
      results.push({ cloneDir, pathname, url });
    }
  }
  // Dedup by pathname, keep newest (last by sort order).
  const byPath = new Map<string, DiscoveredPage>();
  for (const page of results.sort((a, b) => a.cloneDir.localeCompare(b.cloneDir))) {
    byPath.set(page.pathname, page);
  }
  return [...byPath.values()].sort((a, b) => {
    if (a.pathname === '/') return -1;
    if (b.pathname === '/') return 1;
    return a.pathname.localeCompare(b.pathname);
  });
}

function spawnInDir(
  cmd: string,
  args: string[],
  cwd: string,
  log: (line: string) => void,
): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
    child.stderr?.on('data', (c: Buffer) => log(c.toString('utf8').replace(/\s+$/, '')));
    child.on('error', (err) => {
      log(`spawn error: ${err.message}`);
      resolveExit(1);
    });
    child.on('exit', (code) => resolveExit(code ?? 0));
  });
}

export async function runEmitOnly(options: EmitOnlyOptions): Promise<EmitOnlyResult> {
  const log = options.log ?? ((line) => { process.stdout.write(line + '\n'); });
  const viewport = options.viewport ?? 'desktop';
  const captureRoot = resolve(options.captureRoot);
  const outDir = resolve(options.outDir);
  const force = options.force ?? false;

  const pages: MultiPageInput[] =
    options.pages && options.pages.length > 0
      ? options.pages
      : discoverCapturedPages(captureRoot, viewport).map((p) => ({
          cloneDir: p.cloneDir,
          pathname: p.pathname,
          url: p.url,
        }));

  if (pages.length === 0) {
    throw new Error(`emit-only: no captured pages found under ${captureRoot}`);
  }

  log(`emit-only: emitting ${pages.length} pages -> ${outDir}`);
  for (const p of pages) log(`  - ${p.pathname}  (${p.cloneDir})`);

  mkdirSync(outDir, { recursive: true });

  const summary = await buildAstroMulti({
    pages,
    outDir,
    name: options.name,
    force,
  });

  // Persist the emit summary for traceability.
  writeFileSync(
    join(outDir, 'emit-only-summary.json'),
    JSON.stringify({
      outDir,
      ranAt: new Date().toISOString(),
      pages: pages.map((p) => ({ pathname: p.pathname, url: p.url, cloneDir: p.cloneDir })),
      summary,
    }, null, 2) + '\n',
    'utf8',
  );

  log(`emit-only: pages emitted    : ${summary.pagesEmitted.length}`);
  log(`emit-only: shared components: ${summary.sharedComponents.length}`);
  log(`emit-only: per-page comps   : ${summary.perPageComponents}`);
  log(`emit-only: assets           : ${summary.assetCount} files / ${summary.assetBytes} bytes`);

  let built = false;
  let buildExitCode: number | null = null;
  let verifyReport: VerifyRenderReport | null = null;

  if (!options.emitOnly) {
    if (!existsSync(join(outDir, 'node_modules'))) {
      log('emit-only: installing dependencies (npm install)');
      const installCode = await spawnInDir('npm', ['install', '--silent'], outDir, log);
      if (installCode !== 0) {
        log(`emit-only: npm install failed (exit ${installCode}); aborting build`);
        return {
          outDir,
          pagesEmitted: summary.pagesEmitted,
          sharedComponents: summary.sharedComponents,
          perPageComponents: summary.perPageComponents,
          assetCount: summary.assetCount,
          assetBytes: summary.assetBytes,
          built: false,
          buildExitCode: installCode,
          verifyReport: null,
        };
      }
    }

    log('emit-only: running npm run build');
    buildExitCode = await spawnInDir('npm', ['run', 'build'], outDir, log);
    built = buildExitCode === 0;

    if (built && !options.skipVerify) {
      log('emit-only: running verify-render');
      try {
        verifyReport = await verifyRender({ outDir, log });
      } catch (err) {
        log(`emit-only: verify-render crashed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return {
    outDir,
    pagesEmitted: summary.pagesEmitted,
    sharedComponents: summary.sharedComponents,
    perPageComponents: summary.perPageComponents,
    assetCount: summary.assetCount,
    assetBytes: summary.assetBytes,
    built,
    buildExitCode,
    verifyReport,
  };
}
