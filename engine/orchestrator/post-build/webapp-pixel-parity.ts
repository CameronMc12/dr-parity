/**
 * Webapp pixel parity stage (V2.1 stretch goal toward ~99% pixel parity).
 *
 * Phase A in this module: boot the built SPA via `vite preview` and capture
 * per-viewport full-page screenshots of every inferred route. The diff and
 * report-emit phases land in follow-up commits.
 *
 * Why we re-use `startVitePreview`/`stopPreview` from `post-emit-multi-webapp.ts`:
 * those helpers already encode the readiness pattern used by
 * route-render-check and state-assertion-check, including MSW init. Sharing
 * one boot routine avoids drift in how the preview server is detected and
 * torn down.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

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

export interface CapturedShot {
  routePath: string;
  baseStateId: string;
  viewport: PixelParityViewport;
  rebuiltScreenshot: string;
  referenceScreenshot: string | null;
  referenceViewport: string | null;
  note: string;
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
  /** Max ms to wait for vite preview to become ready. Default 30s. */
  previewReadyTimeoutMs?: number;
  /** Skip Playwright work (used by tests). */
  skipBrowser?: boolean;
  /** Log sink. Defaults to stdout. */
  log?: (line: string) => void;
}

export interface PixelParityCaptureResult {
  name: 'pixel-parity';
  status: PixelParityStatus;
  metrics: {
    durationMs: number;
    routes?: number;
    captured?: number;
    [key: string]: number | string | boolean | null | undefined;
  };
  errors: string[];
  shots: CapturedShot[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PREVIEW_READY_TIMEOUT_MS = 30_000;
const PAGE_GOTO_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const POST_LOAD_SETTLE_MS = 2_500;
const MSW_READY_TIMEOUT_MS = 10_000;

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
// Orchestrator (Phase A: capture only)
// ---------------------------------------------------------------------------

export async function runWebappPixelParity(
  options: RunWebappPixelParityOptions,
): Promise<PixelParityCaptureResult> {
  const log = options.log ?? defaultLog;
  const start = Date.now();
  const projectDir = resolve(options.outDir);
  const viewports = options.viewports ?? PIXEL_PARITY_VIEWPORTS;
  const previewReadyTimeoutMs = options.previewReadyTimeoutMs ?? DEFAULT_PREVIEW_READY_TIMEOUT_MS;

  if (options.skipBrowser) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'skipBrowser=true' },
      errors: [],
      shots: [],
    };
  }
  if (!options.inference || options.inference.routes.length === 0) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no inference graph' },
      errors: [],
      shots: [],
    };
  }
  if (!options.crawlDir) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no crawlDir' },
      errors: [],
      shots: [],
    };
  }

  const crawlDir = resolve(options.crawlDir);
  if (!existsSync(crawlDir)) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'crawlDir not found' },
      errors: [`crawlDir does not exist: ${crawlDir}`],
      shots: [],
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
      shots: [],
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
      shots: [],
    };
  }

  const jobs = buildRouteJobs(options.inference, graph, crawlDir, viewports);
  if (jobs.length === 0) {
    return {
      name: 'pixel-parity',
      status: 'skipped',
      metrics: { durationMs: 0, reason: 'no routes resolved' },
      errors: [],
      shots: [],
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
      shots: [],
    };
  }

  const artefactDir = join(projectDir, 'parity-artefacts');
  mkdirSync(artefactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  const shots: CapturedShot[] = [];
  try {
    for (const job of jobs) {
      const slug = routePathSlug(job.routePath);
      log(
        `  [pixel-parity] route ${job.routePath} (base=${job.baseStateId}, refViewport=${job.referenceViewport?.name ?? 'none'})`,
      );
      for (const viewport of viewports) {
        const viewportDir = join(artefactDir, slug, viewport.name);
        mkdirSync(viewportDir, { recursive: true });
        const rebuiltPath = join(viewportDir, 'rebuilt.png');
        try {
          await captureRouteViewport(
            browser,
            server.baseUrl,
            job.routePath,
            viewport,
            rebuiltPath,
            log,
          );
          const isRef =
            job.referenceViewport !== null && job.referenceViewport.name === viewport.name;
          shots.push({
            routePath: job.routePath,
            baseStateId: job.baseStateId,
            viewport,
            rebuiltScreenshot: rebuiltPath,
            referenceScreenshot: isRef ? job.referenceAbsPath : null,
            referenceViewport: job.referenceViewport ? job.referenceViewport.name : null,
            note: isRef
              ? job.referenceAbsPath
                ? 'captured at reference viewport'
                : 'reference screenshot missing for base state'
              : 'no reference for this viewport',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${job.routePath} :: ${viewport.name}: ${msg}`);
        }
      }
    }
  } finally {
    try { await browser.close(); } catch { /* noop */ }
    await stopPreview(server);
  }

  return {
    name: 'pixel-parity',
    status: errors.length === 0 ? 'ok' : 'warn',
    metrics: {
      durationMs: Date.now() - start,
      routes: jobs.length,
      captured: shots.length,
    },
    errors,
    shots,
  };
}
