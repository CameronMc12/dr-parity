/**
 * Webapp pixel parity stage (V2.1 stretch goal toward ~99% pixel parity).
 *
 * Phase A: boot the built SPA via `vite preview` and capture per-viewport
 * full-page screenshots of every inferred route.
 * Phase B: pixel-diff each captured screenshot against the crawl graph's
 * reference screenshot for that route. Only the viewport whose width
 * matches the crawl viewport produces a hard pass/fail; other viewports
 * are captured for human inspection but are not gated.
 *
 * Re-use of astro's diff primitives: pixelmatch + pngjs are the same
 * libraries used by engine/qa/parity-check.ts and engine/verify/diff.ts.
 * The threshold semantics also mirror engine/verify (diffRatio = mismatched
 * pixels / total pixels).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import type { InferenceResult } from '../../targets/webapp/inference';
import type { CrawlGraph } from '../../targets/webapp/crawler/types';
import { startVitePreview, stopPreview, type PreviewServer } from './post-emit-multi-webapp';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PixelParityStatus = 'ok' | 'warn' | 'fail' | 'skipped';

export interface PixelParityViewport {
  name: string;
  width: number;
  height: number;
}

export const PIXEL_PARITY_VIEWPORTS: readonly PixelParityViewport[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

export interface PixelParityViewportResult {
  name: string;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  passed: boolean;
  rebuiltScreenshot: string;
  referenceScreenshot: string | null;
  diffImage: string | null;
  note: string;
}

export interface PixelParityRouteResult {
  routePath: string;
  baseStateId: string;
  referenceViewport: string | null;
  viewports: PixelParityViewportResult[];
  passed: boolean;
}

export interface RunWebappPixelParityOptions {
  /** Webapp project root (already installed + built). */
  outDir: string;
  /** Inference result from the crawler. Required. */
  inference: InferenceResult;
  /** Crawl graph directory containing graph.json + per-state screenshots. */
  crawlDir: string;
  /** Optional pre-parsed graph (avoids re-reading graph.json). */
  graph?: CrawlGraph;
  /** Canonical viewports to capture. Defaults to all four. */
  viewports?: readonly PixelParityViewport[];
  /** Pixel-diff threshold ratio. Default 0.20 (per webapp default). */
  threshold?: number;
  /**
   * Multiplier applied to `threshold` to find the warn/fail boundary.
   *   diffRatio <= threshold                  -> route + viewport pass
   *   threshold < diffRatio <= threshold*N    -> overall stage status warn
   *   diffRatio > threshold*N                 -> overall stage status fail
   * Default 2.
   */
  warnMultiplier?: number;
  /** Per-pixel pixelmatch threshold (0..1). Default 0.1. */
  pixelThreshold?: number;
  /** Max ms to wait for vite preview to become ready. Default 30s. */
  previewReadyTimeoutMs?: number;
  /** Skip Playwright work (used by tests). */
  skipBrowser?: boolean;
  /**
   * Override where parity-report.json is written. Defaults to
   * `<outDir>/parity-report.json`.
   */
  out?: string;
  /** Log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

/**
 * Canonical pixel-parity report shape. Compatible with the
 * ParityCheckResult shape from engine/qa/parity-check.ts so the regression
 * harvester and any astro-trained downstream tooling can consume webapp
 * reports without a schema branch. The `routes[]` array is a webapp
 * extension; the top-level `viewports[]` and other fields keep the original
 * astro shape.
 */
export interface PixelParityReport {
  target: 'webapp';
  projectDir: string;
  crawlDir: string;
  threshold: number;
  warnMultiplier: number;
  timestamp: string;
  routes: PixelParityRouteResult[];
  viewports: PixelParityViewportResult[];
  allPassed: boolean;
  reportPath: string;
  status: PixelParityStatus;
}

export interface PixelParityCaptureResult {
  name: 'pixel-parity';
  status: PixelParityStatus;
  metrics: {
    durationMs: number;
    routes?: number;
    comparedViewports?: number;
    passedViewports?: number;
    threshold?: number;
    warnMultiplier?: number;
    [key: string]: number | string | boolean | null | undefined;
  };
  errors: string[];
  routes: PixelParityRouteResult[];
  /** Path to the emitted parity-report.json. Null when no report was written. */
  reportPath?: string | null;
  /** Full report object. Null when the stage was skipped. */
  report?: PixelParityReport | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PREVIEW_READY_TIMEOUT_MS = 30_000;
const PAGE_GOTO_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const POST_LOAD_SETTLE_MS = 2_500;
const MSW_READY_TIMEOUT_MS = 10_000;
const DEFAULT_THRESHOLD = 0.2;
const DEFAULT_WARN_MULTIPLIER = 2;
const DEFAULT_PIXEL_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultLog(line: string): void {
  process.stdout.write(line + '\n');
}

function parseGraphViewport(raw: string | undefined): { width: number; height: number } | null {
  if (!raw) return null;
  const match = /^(\d+)x(\d+)$/.exec(raw.trim());
  if (!match) return null;
  return { width: Number.parseInt(match[1]!, 10), height: Number.parseInt(match[2]!, 10) };
}

/**
 * The crawler captures one screenshot per state at a single viewport
 * (recorded in `graph.viewport`). Map that to one of the canonical four so
 * we know which viewport's diff is gated against the reference. Other
 * viewports get captured for human inspection but cannot fail the gate.
 */
function resolveReferenceViewport(
  graphViewport: string | undefined,
  viewports: readonly PixelParityViewport[],
): PixelParityViewport | null {
  const parsed = parseGraphViewport(graphViewport);
  if (!parsed) return null;
  const exact = viewports.find((v) => v.width === parsed.width);
  if (exact) return exact;
  const sorted = [...viewports].sort(
    (a, b) => Math.abs(a.width - parsed.width) - Math.abs(b.width - parsed.width),
  );
  return sorted[0] ?? null;
}

function resolveScreenshotPath(crawlDir: string, screenshotPath: string): string {
  if (isAbsolute(screenshotPath)) return screenshotPath;
  return join(crawlDir, screenshotPath);
}

function routePathSlug(routePath: string): string {
  if (routePath === '/' || routePath.length === 0) return 'root';
  return routePath.replace(/^\/+/, '').replace(/\/+$/, '').replace(/[^a-z0-9._-]+/gi, '-');
}

// ---------------------------------------------------------------------------
// PNG diff (mirrors engine/qa/parity-check.ts and engine/verify/diff.ts).
// ---------------------------------------------------------------------------

async function readPng(filePath: string): Promise<PNG> {
  const buffer = await readFile(filePath);
  return new Promise<PNG>((resolvePng, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, data) => {
      if (err) reject(new Error(`Failed to parse PNG ${filePath}: ${err.message}`));
      else resolvePng(data);
    });
  });
}

function encodePng(png: PNG): Promise<Buffer> {
  return new Promise<Buffer>((resolveBuf, reject) => {
    const chunks: Buffer[] = [];
    png
      .pack()
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => resolveBuf(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function cropToSize(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) return src;
  const dst = new PNG({ width, height });
  const copyW = Math.min(width, src.width);
  const copyH = Math.min(height, src.height);
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) {
      const s = (y * src.width + x) * 4;
      const d = (y * width + x) * 4;
      dst.data[d] = src.data[s]!;
      dst.data[d + 1] = src.data[s + 1]!;
      dst.data[d + 2] = src.data[s + 2]!;
      dst.data[d + 3] = src.data[s + 3]!;
    }
  }
  return dst;
}

interface DiffOutcome {
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
}

async function diffPngs(
  referencePath: string,
  rebuiltPath: string,
  diffOut: string,
  pixelThreshold: number,
): Promise<DiffOutcome> {
  const [refPng, rebuiltPng] = await Promise.all([readPng(referencePath), readPng(rebuiltPath)]);
  const width = Math.min(refPng.width, rebuiltPng.width);
  const height = Math.min(refPng.height, rebuiltPng.height);
  if (width === 0 || height === 0) {
    throw new Error(
      `Empty PNG dims reference=${refPng.width}x${refPng.height} rebuilt=${rebuiltPng.width}x${rebuiltPng.height}`,
    );
  }
  const refCrop = cropToSize(refPng, width, height);
  const rebuiltCrop = cropToSize(rebuiltPng, width, height);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(refCrop.data, rebuiltCrop.data, diff.data, width, height, {
    threshold: pixelThreshold,
  });
  await mkdir(dirname(diffOut), { recursive: true });
  await writeFile(diffOut, await encodePng(diff));
  const totalPixels = width * height;
  return {
    diffPixels,
    totalPixels,
    diffRatio: totalPixels > 0 ? diffPixels / totalPixels : 0,
  };
}

function classifyStatus(
  results: PixelParityRouteResult[],
  threshold: number,
  warnMultiplier: number,
): PixelParityStatus {
  const failBoundary = threshold * warnMultiplier;
  let anyAboveThreshold = false;
  let anyAboveFailBoundary = false;
  for (const route of results) {
    for (const viewport of route.viewports) {
      if (!viewport.referenceScreenshot) continue;
      if (viewport.diffRatio > failBoundary) anyAboveFailBoundary = true;
      else if (viewport.diffRatio > threshold) anyAboveThreshold = true;
    }
  }
  if (anyAboveFailBoundary) return 'fail';
  if (anyAboveThreshold) return 'warn';
  return 'ok';
}

async function loadGraphIfNeeded(
  graph: CrawlGraph | undefined,
  crawlDir: string,
): Promise<CrawlGraph> {
  if (graph) return graph;
  const graphPath = join(crawlDir, 'graph.json');
  if (!existsSync(graphPath)) {
    throw new Error(`Crawl graph not found at ${graphPath}`);
  }
  const raw = await readFile(graphPath, 'utf8');
  const parsed = JSON.parse(raw) as CrawlGraph;
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`Malformed graph.json at ${graphPath}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Per-route capture using Playwright
// ---------------------------------------------------------------------------

async function waitForMsw(
  page: import('playwright').Page,
  log: (l: string) => void,
): Promise<void> {
  try {
    await page.waitForFunction(
      () =>
        typeof navigator !== 'undefined' &&
        typeof navigator.serviceWorker !== 'undefined' &&
        navigator.serviceWorker.controller !== null,
      { timeout: MSW_READY_TIMEOUT_MS },
    );
  } catch {
    // The SPA may not register a worker on this route, or the route is
    // recovered from a stale cache. Continue without failing: the
    // existing msw-boot-check already gates the worker artefact's presence.
    log('  [pixel-parity] MSW worker did not activate within timeout; continuing');
  }
}

async function captureRouteViewport(
  browser: import('playwright').Browser,
  baseUrl: string,
  routePath: string,
  viewport: PixelParityViewport,
  outPath: string,
  log: (l: string) => void,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  let page: import('playwright').Page | null = null;
  try {
    page = await context.newPage();
    const url = baseUrl + (routePath.startsWith('/') ? routePath : `/${routePath}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_GOTO_TIMEOUT_MS });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Timeout/i.test(msg)) throw err;
    }
    await waitForMsw(page, log);
    try {
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch {
      // Some SPAs poll indefinitely. Ignore networkidle timeouts.
    }
    await page.waitForTimeout(POST_LOAD_SETTLE_MS);
    mkdirSync(dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: true });
  } finally {
    if (page) {
      try { await page.close(); } catch { /* noop */ }
    }
    try { await context.close(); } catch { /* noop */ }
  }
}

interface RouteJob {
  routePath: string;
  baseStateId: string;
  referenceAbsPath: string | null;
  referenceViewport: PixelParityViewport | null;
}

function buildRouteJobs(
  inference: InferenceResult,
  graph: CrawlGraph,
  crawlDir: string,
  viewports: readonly PixelParityViewport[],
): RouteJob[] {
  const refViewport = resolveReferenceViewport(graph.viewport, viewports);
  const nodeIndex = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const jobs: RouteJob[] = [];
  for (const route of inference.routes) {
    if (seen.has(route.routePath)) continue;
    seen.add(route.routePath);
    const baseStateId = route.baseStateGroup.baseStateId;
    const node = nodeIndex.get(baseStateId);
    const referenceAbsPath = node
      ? resolveScreenshotPath(crawlDir, node.screenshotPath)
      : null;
    jobs.push({
      routePath: route.routePath,
      baseStateId,
      referenceAbsPath: referenceAbsPath && existsSync(referenceAbsPath) ? referenceAbsPath : null,
      referenceViewport: refViewport,
    });
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Per-route runner: capture every viewport, diff the reference viewport.
// ---------------------------------------------------------------------------

async function runRouteJob(
  browser: import('playwright').Browser,
  baseUrl: string,
  job: RouteJob,
  artefactDir: string,
  viewports: readonly PixelParityViewport[],
  threshold: number,
  pixelThreshold: number,
  log: (l: string) => void,
): Promise<PixelParityRouteResult> {
  const slug = routePathSlug(job.routePath);
  const routeDir = join(artefactDir, slug);
  mkdirSync(routeDir, { recursive: true });

  const results: PixelParityViewportResult[] = [];
  for (const viewport of viewports) {
    const viewportDir = join(routeDir, viewport.name);
    mkdirSync(viewportDir, { recursive: true });
    const rebuiltPath = join(viewportDir, 'rebuilt.png');
    try {
      await captureRouteViewport(browser, baseUrl, job.routePath, viewport, rebuiltPath, log);
    } catch (err) {
      results.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: 0,
        passed: false,
        rebuiltScreenshot: rebuiltPath,
        referenceScreenshot: null,
        diffImage: null,
        note: `capture failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const isReferenceViewport =
      job.referenceViewport !== null && job.referenceViewport.name === viewport.name;

    if (!isReferenceViewport) {
      // Captured for human inspection only. No reference exists at this
      // viewport so the result cannot fail the gate.
      results.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: 0,
        passed: true,
        rebuiltScreenshot: rebuiltPath,
        referenceScreenshot: null,
        diffImage: null,
        note: 'no reference for this viewport',
      });
      continue;
    }

    if (!job.referenceAbsPath) {
      results.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: 0,
        passed: false,
        rebuiltScreenshot: rebuiltPath,
        referenceScreenshot: null,
        diffImage: null,
        note: `reference screenshot missing for base state ${job.baseStateId}`,
      });
      continue;
    }

    const diffImage = join(viewportDir, 'diff.png');
    try {
      const diff = await diffPngs(job.referenceAbsPath, rebuiltPath, diffImage, pixelThreshold);
      const passed = diff.diffRatio <= threshold;
      results.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        diffPixels: diff.diffPixels,
        totalPixels: diff.totalPixels,
        diffRatio: diff.diffRatio,
        passed,
        rebuiltScreenshot: rebuiltPath,
        referenceScreenshot: job.referenceAbsPath,
        diffImage,
        note: passed
          ? `diff ${(diff.diffRatio * 100).toFixed(3)}% <= ${(threshold * 100).toFixed(2)}%`
          : `diff ${(diff.diffRatio * 100).toFixed(3)}% > ${(threshold * 100).toFixed(2)}%`,
      });
    } catch (err) {
      results.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: 0,
        passed: false,
        rebuiltScreenshot: rebuiltPath,
        referenceScreenshot: job.referenceAbsPath,
        diffImage: null,
        note: `diff failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    routePath: job.routePath,
    baseStateId: job.baseStateId,
    referenceViewport: job.referenceViewport ? job.referenceViewport.name : null,
    viewports: results,
    passed: results.every((r) => r.passed),
  };
}

// ---------------------------------------------------------------------------
// Orchestrator (capture + diff)
// ---------------------------------------------------------------------------

export async function runWebappPixelParity(
  options: RunWebappPixelParityOptions,
): Promise<PixelParityCaptureResult> {
  const log = options.log ?? defaultLog;
  const start = Date.now();
  const projectDir = resolve(options.outDir);
  const viewports = options.viewports ?? PIXEL_PARITY_VIEWPORTS;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const warnMultiplier = options.warnMultiplier ?? DEFAULT_WARN_MULTIPLIER;
  const pixelThreshold = options.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD;
  const previewReadyTimeoutMs = options.previewReadyTimeoutMs ?? DEFAULT_PREVIEW_READY_TIMEOUT_MS;

  if (options.skipBrowser) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'skipBrowser=true' },
      errors: [],
      routes: [],
    };
  }
  if (!options.inference || options.inference.routes.length === 0) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no inference graph' },
      errors: [],
      routes: [],
    };
  }
  if (!options.crawlDir) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no crawlDir' },
      errors: [],
      routes: [],
    };
  }

  const crawlDir = resolve(options.crawlDir);
  if (!existsSync(crawlDir)) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'crawlDir not found' },
      errors: [`crawlDir does not exist: ${crawlDir}`],
      routes: [],
    };
  }

  let graph: CrawlGraph;
  try {
    graph = await loadGraphIfNeeded(options.graph, crawlDir);
  } catch (err) {
    return {
      name: 'pixel-parity',
      status: 'fail',
      metrics: { durationMs: Date.now() - start },
      errors: [err instanceof Error ? err.message : String(err)],
      routes: [],
    };
  }

  let chromium: typeof import('playwright').chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (err) {
    return {
      name: 'pixel-parity',
      status: 'fail',
      metrics: { durationMs: Date.now() - start },
      errors: [`playwright unavailable: ${err instanceof Error ? err.message : String(err)}`],
      routes: [],
    };
  }

  const jobs = buildRouteJobs(options.inference, graph, crawlDir, viewports);
  if (jobs.length === 0) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no routes resolved' },
      errors: [],
      routes: [],
    };
  }

  log(`  [pixel-parity] booting vite preview in ${projectDir}`);
  let server: PreviewServer;
  try {
    server = await startVitePreview(projectDir, previewReadyTimeoutMs, log);
  } catch (err) {
    return {
      name: 'pixel-parity',
      status: 'fail',
      metrics: { durationMs: Date.now() - start, routes: jobs.length },
      errors: [err instanceof Error ? err.message : String(err)],
      routes: [],
    };
  }

  const artefactDir = join(projectDir, 'parity-artefacts');
  mkdirSync(artefactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  const routeResults: PixelParityRouteResult[] = [];
  try {
    for (const job of jobs) {
      log(
        `  [pixel-parity] route ${job.routePath} (base=${job.baseStateId}, refViewport=${job.referenceViewport?.name ?? 'none'})`,
      );
      try {
        const result = await runRouteJob(
          browser,
          server.baseUrl,
          job,
          artefactDir,
          viewports,
          threshold,
          pixelThreshold,
          log,
        );
        routeResults.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${job.routePath}: ${msg}`);
        log(`  [pixel-parity] route ${job.routePath} failed: ${msg}`);
      }
    }
  } finally {
    try { await browser.close(); } catch { /* noop */ }
    await stopPreview(server);
  }

  const status = classifyStatus(routeResults, threshold, warnMultiplier);
  const allViewports = routeResults.flatMap((r) => r.viewports);
  const comparedViewports = allViewports.filter((v) => v.referenceScreenshot !== null).length;
  const passedViewports = allViewports.filter(
    (v) => v.referenceScreenshot !== null && v.passed,
  ).length;

  const reportPath = resolve(options.out ?? join(projectDir, 'parity-report.json'));
  const report: PixelParityReport = {
    target: 'webapp',
    projectDir,
    crawlDir,
    threshold,
    warnMultiplier,
    timestamp: new Date().toISOString(),
    routes: routeResults,
    viewports: allViewports,
    allPassed: routeResults.every((r) => r.passed),
    reportPath,
    status,
  };

  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    log(`  [pixel-parity] report: ${reportPath}`);
  } catch (err) {
    errors.push(
      `failed to write parity-report.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    name: 'pixel-parity',
    status,
    metrics: {
      durationMs: Date.now() - start,
      routes: routeResults.length,
      comparedViewports,
      passedViewports,
      threshold,
      warnMultiplier,
    },
    errors,
    routes: routeResults,
    reportPath,
    report,
  };
}
