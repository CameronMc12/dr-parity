/**
 * Per-route fresh-navigation capture pass.
 *
 * Mirrors the React target's "one capture per page" approach. Reads the
 * existing crawl graph, walks every UNIQUE route path discovered by the
 * BFS crawler, fresh-navigates to each one, waits for network idle plus
 * the shell-settle window, then writes the FULL outer HTML to
 * `<crawlDir>/routes/<slug>.html`. Also writes a manifest at
 * `<crawlDir>/routes.json` so downstream consumers can locate captures
 * without re-deriving slugs.
 *
 * Why a separate pass:
 *   - The BFS crawler's per-route state captures happen mid-interaction,
 *     so the captured DOM often reflects the LAST overlay/route state the
 *     crawler arrived in (e.g. drafts panel open). A clean capture is
 *     needed to use as the canonical "base HTML" for each route.
 *   - Re-running the full BFS is slow (6 min+); this pass is O(routes)
 *     and idempotent — safe to re-run without re-crawling.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

import { computeDomHash } from './dom-hash';
import type { CrawlGraph, StateNode } from './types';

const SHELL_SELECTOR = 'aside, nav, [role="navigation"], [class*="sidebar" i]';

export interface RouteCapture {
  path: string;
  url: string;
  htmlPath: string;
  title: string;
  capturedAt: string;
}

export interface RouteCaptureResult {
  routes: RouteCapture[];
  capturedCount: number;
  failedCount: number;
}

export interface RouteRecaptureOptions {
  crawlDir: string;
  userDataDir: string;
  viewport: { width: number; height: number };
  shellSettleMs: number;
  /** Optional explicit route paths to capture. Defaults to all in graph. */
  routePaths?: string[];
  /**
   * Extra route paths or URLs to capture EVEN IF they aren't present in the
   * crawl graph. Each captured route is also injected as a synthetic state
   * node into graph.json (with a fresh state-XXXX directory) so the
   * downstream inference / build can render them as pages.
   *
   * Pass either absolute URLs ("https://app.x.com/inbox") or path strings
   * ("/inbox"). Path strings resolve against the crawl graph's startUrl
   * origin.
   */
  extraRoutes?: string[];
}

function routePathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname || '/';
  } catch {
    return '/';
  }
}

function slugifyPath(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (trimmed.length === 0) return 'index';
  return trimmed.replace(/\//g, '_').replace(/[^a-z0-9_-]/gi, '-');
}

function uniqueRoutesFromGraph(graph: CrawlGraph): { path: string; url: string }[] {
  const byPath = new Map<string, string>();
  for (const node of graph.nodes) {
    const path = routePathOf(node.url);
    if (!byPath.has(path)) {
      byPath.set(path, node.url);
    }
  }
  return [...byPath.entries()].map(([path, url]) => ({ path, url }));
}

async function settle(page: Page, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((res) => setTimeout(res, timeoutMs)),
  ]).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function settleWithShell(page: Page, shellSettleMs: number): Promise<void> {
  await settle(page, 5_000);
  if (shellSettleMs > 0) {
    await page.waitForTimeout(shellSettleMs);
  }
  await page
    .waitForSelector(SHELL_SELECTOR, { state: 'attached', timeout: 3_000 })
    .catch(() => undefined);
}

async function captureOne(
  page: Page,
  url: string,
  shellSettleMs: number,
): Promise<{ html: string; title: string; normalisedHtml: string; hash: string } | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } catch {
    return null;
  }
  await settleWithShell(page, shellSettleMs);

  // Dismiss any stray overlay before capture (best-effort): press Escape.
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch {
    /* noop */
  }

  let html: string;
  try {
    html = await page.content();
  } catch {
    return null;
  }
  const title = await page.title().catch(() => '');

  // Also compute the normalised DOM + hash for state injection.
  let normalisedHtml = '';
  let hash = '';
  try {
    const r = await computeDomHash(page);
    normalisedHtml = r.normalisedHtml;
    hash = r.hash;
  } catch {
    // fall back to a content-based hash so the synthetic node still has a unique id
    normalisedHtml = html;
    hash = createHash('sha256').update(html).digest('hex');
  }

  return { html, title, normalisedHtml, hash };
}

/**
 * Resolve a path or URL against the crawl graph's startUrl origin.
 * Returns null if the input is malformed.
 */
function resolveAgainstStart(raw: string, startUrl: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('http')) return new URL(trimmed).toString();
    const origin = new URL(startUrl).origin;
    return new URL(trimmed, origin).toString();
  } catch {
    return null;
  }
}

/**
 * Allocate the next state-XXXX id given an existing list of node ids. Pads
 * to 4 digits to match `state-capture.ts`'s convention.
 */
function nextStateId(existingIds: Iterable<string>): (() => string) {
  let max = 0;
  for (const id of existingIds) {
    const m = /^state-(\d+)$/.exec(id);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return () => {
    max += 1;
    return `state-${String(max).padStart(4, '0')}`;
  };
}

export async function recaptureRoutes(
  options: RouteRecaptureOptions,
): Promise<RouteCaptureResult> {
  const absCrawlDir = resolve(options.crawlDir);
  const graphPath = join(absCrawlDir, 'graph.json');
  if (!existsSync(graphPath)) {
    throw new Error(`Crawl graph not found: ${graphPath}`);
  }
  const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as CrawlGraph;

  const routesDir = join(absCrawlDir, 'routes');
  mkdirSync(routesDir, { recursive: true });

  const baseTargets =
    options.routePaths && options.routePaths.length > 0
      ? uniqueRoutesFromGraph(graph).filter((r) =>
          options.routePaths!.includes(r.path),
        )
      : uniqueRoutesFromGraph(graph);

  // Extra routes: paths/URLs not (yet) present in the graph. Captured AND
  // injected as synthetic state nodes so build can render them.
  const seenPaths = new Set(uniqueRoutesFromGraph(graph).map((r) => r.path));
  const extraTargets: { path: string; url: string; synthetic: true }[] = [];
  if (options.extraRoutes && options.extraRoutes.length > 0) {
    for (const raw of options.extraRoutes) {
      const absUrl = resolveAgainstStart(raw, graph.startUrl);
      if (!absUrl) continue;
      const path = routePathOf(absUrl);
      if (seenPaths.has(path)) {
        // Already in graph — covered by baseTargets, skip to avoid double-capture.
        continue;
      }
      seenPaths.add(path);
      extraTargets.push({ path, url: absUrl, synthetic: true });
    }
  }

  type Target = { path: string; url: string; synthetic?: boolean };
  const targets: Target[] = [...baseTargets, ...extraTargets];

  console.log(`[recapture] launching persistent profile: ${options.userDataDir}`);
  const context: BrowserContext = await chromium.launchPersistentContext(
    options.userDataDir,
    {
      channel: 'chrome',
      headless: false,
      viewport: options.viewport,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    },
  );

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });

  const page = context.pages()[0] ?? (await context.newPage());

  const captures: RouteCapture[] = [];
  let failed = 0;

  // Prepare to inject synthetic states for any extraRoutes that succeed.
  const allocStateId = nextStateId(graph.nodes.map((n) => n.id));
  let graphMutated = false;

  for (const target of targets) {
    const slug = slugifyPath(target.path);
    const htmlPath = join('routes', `${slug}.html`);
    const absHtmlPath = join(absCrawlDir, htmlPath);

    console.log(`[recapture] ${target.path} <- ${target.url}${target.synthetic ? ' (extra)' : ''}`);
    const captured = await captureOne(page, target.url, options.shellSettleMs);
    if (!captured) {
      console.warn(`[recapture]   FAILED to capture ${target.path}`);
      failed += 1;
      continue;
    }

    writeFileSync(absHtmlPath, captured.html, 'utf8');
    captures.push({
      path: target.path,
      url: target.url,
      htmlPath,
      title: captured.title,
      capturedAt: new Date().toISOString(),
    });
    console.log(`[recapture]   wrote ${htmlPath} (${captured.html.length} chars)`);

    // For extras: also synthesise a state-XXXX entry in graph.json so the
    // build pipeline picks them up as discoverable routes.
    if (target.synthetic) {
      const stateId = allocStateId();
      const relStateDir = join('states', stateId);
      const absStateDir = join(absCrawlDir, relStateDir);
      mkdirSync(absStateDir, { recursive: true });

      const relDomPath = join(relStateDir, 'dom.html');
      const absDomPath = join(absCrawlDir, relDomPath);
      writeFileSync(absDomPath, captured.normalisedHtml, 'utf8');
      writeFileSync(join(absStateDir, 'dom-raw.html'), captured.html, 'utf8');

      const meta = {
        id: stateId,
        url: target.url,
        title: captured.title,
        depth: 0,
        domHash: captured.hash,
        capturedAt: new Date().toISOString(),
        synthetic: true as const,
        source: 'route-recapture:extra-routes',
      };
      writeFileSync(join(absStateDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

      // Screenshot is optional. Try once, ignore failure (we may have already
      // navigated away by the time this runs, and the build doesn't require it).
      const relShotPath = join(relStateDir, 'screenshot.png');
      const absShotPath = join(absCrawlDir, relShotPath);
      await page
        .screenshot({ path: absShotPath, fullPage: false, timeout: 3_000 })
        .catch(() => undefined);

      const syntheticNode: StateNode = {
        id: stateId,
        url: target.url,
        domHash: captured.hash,
        title: captured.title,
        screenshotPath: relShotPath,
        domPath: relDomPath,
        capturedAt: meta.capturedAt,
        depth: 0,
      };
      graph.nodes.push(syntheticNode);
      graphMutated = true;
      console.log(`[recapture]   injected synthetic state ${stateId} for ${target.path}`);
    }
  }

  if (graphMutated) {
    writeFileSync(join(absCrawlDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8');
    console.log(`[recapture] graph.json updated with synthetic nodes`);
  }

  const manifestPath = join(absCrawlDir, 'routes.json');
  writeFileSync(manifestPath, JSON.stringify({ routes: captures }, null, 2), 'utf8');

  await context.close();

  return {
    routes: captures,
    capturedCount: captures.length,
    failedCount: failed,
  };
}

export function loadRouteCaptures(crawlDir: string): RouteCapture[] {
  const absDir = resolve(crawlDir);
  const manifestPath = join(absDir, 'routes.json');
  if (!existsSync(manifestPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      routes?: RouteCapture[];
    };
    return Array.isArray(parsed.routes) ? parsed.routes : [];
  } catch {
    return [];
  }
}

export function readRouteCaptureHtml(
  crawlDir: string,
  capture: RouteCapture,
): string | null {
  const absPath = join(resolve(crawlDir), capture.htmlPath);
  if (!existsSync(absPath)) return null;
  return readFileSync(absPath, 'utf8');
}
