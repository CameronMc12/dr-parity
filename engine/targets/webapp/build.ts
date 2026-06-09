/**
 * Top-level webapp build orchestrator.
 *
 * Phase 1 contract: produce a buildable empty React + Vite + MSW project
 * from a captured clone directory. Crawler, state inference, mock
 * synthesis, websocket stubs, and library detection are explicit later
 * phases — this file leaves clean extension points (empty MSW handlers,
 * routes parameter, stateful flag on the component def) but does NOT
 * implement them.
 */

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { extractHead, rewriteHeadAssetLinks, sliceBody, copyAssetsToPublic } from '../shared';
import { buildCloneAssetMap, rewriteBodyAssetUrls } from '../shared';
import type { CloneAssetMap, ExtractedHead } from '../shared';
import { htmlToJsx } from '../react/html-to-jsx';
import { writeApp, writeComponent, writeIndexHtml, writeMain } from './emit';
import type { RouteEntry } from './emit';
import { writeScaffold } from './scaffold';
import { loadCrawlGraph, inferStateGroups } from './inference';
import type { RouteGroup } from './inference';
import type { CrawlGraph } from './crawler/types';
import { emitStatefulMain } from './emit-router';
import { emitShellSplit } from './shell-split';
import { emitAssetsFromCrawl, mergeCrawlIntoCloneMap } from './emit-assets-from-crawl';
import { harvestSprite } from './harvest-sprite';
import { emitMocks } from './emit-mocks';
import { emitRealtime } from './emit-realtime';
import { writeRealtimeOutputs } from './emit-realtime/write-outputs';
import { emitSpec } from './emit-spec';
import { deriveComponentName } from './route-naming';
import type { ComponentDef } from '../shared/types';
import type {
  WebappBuildOptions,
  WebappBuildSummary,
  WebappComponentDef,
} from './types';

/**
 * Webapp Phase 1 emits one component per route from the flattened body. The
 * shared IR represents `<main>` as a composition wrapper (`html: ''` plus
 * structured `wrapper` and `childComponentNames`), so we expand it inline
 * here, drop the now-empty Main entry, and drop the per-section components
 * that the wrapper already inlines.
 */
function flattenComponentsForRoute(components: readonly ComponentDef[]): string {
  let mainSectionNames: Set<string> | null = null;
  const parts: string[] = [];
  for (const comp of components) {
    if (comp.role === 'main' && comp.wrapper) {
      const wrapper = comp.wrapper;
      const childNames = comp.childComponentNames ?? [];
      mainSectionNames = new Set(childNames);
      const inner = childNames
        .map((n) => components.find((c) => c.name === n)?.html ?? '')
        .join('\n');
      parts.push(`${wrapper.openTag}\n${inner}\n${wrapper.closeTag}`);
      continue;
    }
    if (mainSectionNames && comp.role === 'section' && mainSectionNames.has(comp.name)) {
      // Already inlined inside the main wrapper.
      continue;
    }
    if (comp.html.length > 0) parts.push(comp.html);
  }
  return parts.join('\n');
}

export function validateCloneDir(cloneDir: string): void {
  const abs = resolve(cloneDir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`Clone directory not found: ${abs}`);
  }
  if (!existsSync(join(abs, 'index.html'))) {
    throw new Error(`Clone is missing index.html: ${abs}`);
  }
  if (!existsSync(join(abs, 'manifest.json'))) {
    throw new Error(`Clone is missing manifest.json: ${abs}`);
  }
}

/** Read the captured document URL from a clone-dir manifest. Empty on miss. */
function readCloneDocumentUrl(absClone: string): string {
  try {
    const manifest = JSON.parse(readFileSync(join(absClone, 'manifest.json'), 'utf8')) as {
      documentUrl?: string;
    };
    return typeof manifest.documentUrl === 'string' ? manifest.documentUrl : '';
  } catch {
    return '';
  }
}

/**
 * Pick the crawl graph's root state id. Prefers the node whose url matches the
 * graph startUrl, then the shallowest node (depth 0), then the first node.
 */
function pickRootStateId(graph: CrawlGraph): string {
  if (graph.nodes.length === 0) {
    throw new Error('Crawl graph has no nodes — cannot derive a root document.');
  }
  const byStartUrl =
    graph.startUrl && graph.nodes.find((n) => n.url === graph.startUrl);
  if (byStartUrl) return byStartUrl.id;

  let shallowest = graph.nodes[0];
  for (const node of graph.nodes) {
    if (node.depth < shallowest.depth) shallowest = node;
  }
  return shallowest.id;
}

/**
 * Crawl-only head source: load the root-state DOM (a full rendered document
 * WITH a real `<head>`), parse it, and return the extracted head plus the
 * documentUrl from the graph. Used when no clone-dir is supplied.
 */
async function readCrawlHead(
  graph: CrawlGraph,
  getStateDom: (stateId: string) => Promise<string>,
): Promise<{ head: ExtractedHead; documentUrl: string }> {
  const rootStateId = pickRootStateId(graph);
  const rootHtml = await getStateDom(rootStateId);
  const $root = cheerio.load(rootHtml, null, true);

  // Strip ANY captured <base> (e.g. the app's CDN base href). The clone path
  // reads an already-base-stripped index.html; crawl-state DOM retains the
  // live page's base, which would resolve /src/main.tsx and /_ext/* against the
  // CDN origin and CORS-block them, leaving the page blank. Removing it lets
  // root-relative refs resolve against the dev/preview origin.
  $root('head base').remove();
  const head = extractHead($root);

  const rootNode = graph.nodes.find((n) => n.id === rootStateId);
  const documentUrl = graph.startUrl || rootNode?.url || '';
  return { head, documentUrl };
}

async function buildFromCrawl(
  options: WebappBuildOptions & { crawlDir: string },
  absClone: string | null,
  absOut: string,
): Promise<WebappBuildSummary> {
  const publicDir = join(absOut, 'public');

  // Clone-dir assets are copied verbatim when a clone is present. In crawl-only
  // mode there is no clone to copy; every asset comes from the crawl's
  // network.jsonl via emitAssetsFromCrawl below, so assetStats starts at zero.
  const assetStats = absClone
    ? copyAssetsToPublic(absClone, publicDir)
    : { count: 0, bytes: 0 };

  // The crawl graph is the source of truth for routes/state and, in crawl-only
  // mode, also for the document head + documentUrl. Load it once up front.
  const loaded = await loadCrawlGraph(options.crawlDir);

  // Head + documentUrl. With a clone: parse its index.html and read the manifest
  // documentUrl. Without a clone: derive both from the crawl's root-state DOM
  // (a full rendered document WITH a real <head>) and graph.json startUrl.
  let head: ExtractedHead;
  let documentUrl: string;
  if (absClone) {
    const html = readFileSync(join(absClone, 'index.html'), 'utf8');
    const $ = cheerio.load(html, null, true);
    head = extractHead($);
    // The clone-dir manifest records the captured document URL; head asset refs
    // (e.g. the global stylesheet at `/static/assets/*.css`) resolve against it.
    documentUrl = readCloneDocumentUrl(absClone);
  } else {
    const crawlHead = await readCrawlHead(loaded.graph, loaded.getStateDom);
    head = crawlHead.head;
    documentUrl = crawlHead.documentUrl;
  }

  // Body asset rewriting: crawl-state DOM carries ABSOLUTE asset URLs that
  // fail cross-origin at runtime even though the same assets are captured
  // locally. Rebuild the clone's url map from the sibling parsed/ dir and
  // rewrite every captured body reference to its local served path before
  // JSX emission. Missing parsed inputs → null → bodies pass through unchanged.
  // Crawl-only mode has no clone parsed dir, so cloneMap is null and every
  // served path comes from the crawl assets below.
  const cloneMap: CloneAssetMap | null = absClone
    ? buildCloneAssetMap(join(absClone, '..', 'parsed'))
    : null;

  // Localize EVERY static asset from the crawl's network.jsonl (superset of all
  // routes), skipping anything the complete clone-dir already covers and any
  // body the crawler truncated. Then merge crawl entries UNDER the clone map so
  // the complete clone copy always wins on conflict, and so routes the clone
  // never captured still resolve their CSS/JS/SVG locally.
  const cloneKnownUrls = new Set<string>(cloneMap ? cloneMap.servedPaths.keys() : []);
  const crawlAssets = await emitAssetsFromCrawl({
    crawlDir: options.crawlDir,
    publicDir,
    existingUrls: cloneKnownUrls,
  });
  const assetMap: CloneAssetMap | null =
    cloneMap || crawlAssets.servedPaths.size > 0
      ? mergeCrawlIntoCloneMap(cloneMap, crawlAssets, cloneMap?.documentUrl ?? documentUrl)
      : null;

  // Rewrite same-origin head asset links (global stylesheet, preloads) to their
  // localized `_ext/...` served paths so the emitted index.html links files the
  // dev server actually has. Without this the global CSS 404s and the theme
  // silently falls back. Refs with no localized copy pass through unchanged.
  // The merged assetMap is used so crawl-localized refs resolve in both modes.
  head = rewriteHeadAssetLinks(head, cloneMap?.documentUrl ?? documentUrl, assetMap);

  // Harvest the union of in-document icon-sprite `<symbol>` defs across every
  // captured state DOM so injected `<use>` refs resolve app-wide.
  const sprite = harvestSprite(options.crawlDir);

  const inference = await inferStateGroups(loaded.graph, loaded.getStateDom);

  // Scaffold expects a list of RouteEntry — derive from inferred routes.
  const routeEntries: RouteEntry[] = inference.routes.map((r: RouteGroup) => ({
    path: r.routePath,
    componentName: deriveComponentName(r.routePath),
  }));

  writeScaffold(absOut, { name: options.name, routes: routeEntries });

  // Shell/content split: detect the persistent app shell shared across routes
  // vs the per-route content outlet, emit the shell ONCE as a layout component
  // with a React Router <Outlet/>, emit each route as a content-only component
  // nested under the layout, and wire the layout-route tree in router.tsx. The
  // shell stays mounted across client-side navigations; only the outlet swaps.
  // Captured-app hostname (e.g. `app.clickup.com`) so the SPA-nav interceptor
  // can treat the captured DOM's absolute production hrefs as same-origin links
  // it governs. Empty on a malformed/absent documentUrl.
  let captureHost = '';
  try {
    captureHost = documentUrl ? new URL(documentUrl).hostname : '';
  } catch {
    captureHost = '';
  }

  const split = await emitShellSplit({
    routes: inference.routes,
    getStateDom: loaded.getStateDom,
    assetMap,
    outDir: absOut,
    spriteSvg: sprite.spriteSvg,
    captureHost,
  });
  const componentsEmitted = split.contentComponents + 1; // + layout

  // Phase 4: mocked backend. emitMocks reads network.jsonl (+ forms.jsonl)
  // from the crawl dir and overwrites the scaffold's empty handlers.ts +
  // writes fixtures into src/fixtures/. The empty case emits a valid
  // zero-handler file, so this never breaks the no-traffic path.
  const mocks = await emitMocks(options.crawlDir, absOut);

  // Phase 5: websocket replay. emitRealtime returns code without touching
  // disk; writeRealtimeOutputs persists src/mocks/socket.ts + ws fixtures.
  // Frames-present is the only case that wires socket.ts into the boot.
  const realtime = await emitRealtime(options.crawlDir);
  const hasSockets = realtime.connectionCount > 0;
  if (hasSockets) {
    writeRealtimeOutputs(absOut, realtime);
  }

  emitStatefulMain(absOut, { startSocketMocks: hasSockets });
  writeIndexHtml({ outDir: absOut, head });

  // Phase 6: documentation inventory. Reuses the same parse/group passes
  // as emit-mocks plus the inferred state groups. Guarded internally for
  // empty network/websocket logs.
  const spec = await emitSpec({
    crawlDir: options.crawlDir,
    outDir: absOut,
    name: options.name,
    routes: inference.routes,
  });
  void spec;

  return {
    outDir: absOut,
    componentsEmitted,
    pagesEmitted: inference.routes.length,
    assetCount: assetStats.count,
    assetBytes: assetStats.bytes,
    endpointsEmitted: mocks.endpointCount,
    fixturesEmitted: mocks.fixtureCount,
    wsConnectionsEmitted: realtime.connectionCount,
  };
}

export async function buildWebappProject(
  options: WebappBuildOptions,
): Promise<WebappBuildSummary> {
  const absClone = options.cloneDir ? resolve(options.cloneDir) : null;
  const absOut = resolve(options.outDir);
  const force = options.force ?? false;
  const routes = options.routes && options.routes.length > 0 ? options.routes : ['/'];

  // Crawl-only mode requires a crawl-dir to source the head + assets from.
  if (!absClone && !options.crawlDir) {
    throw new Error(
      'buildWebappProject requires either a clone-dir or a crawlDir (crawl-only mode).',
    );
  }

  if (absClone && (absOut === absClone || absOut.startsWith(absClone + '/'))) {
    throw new Error('Refusing to write into the clone directory itself.');
  }

  if (absClone) {
    validateCloneDir(absClone);
  }

  if (existsSync(absOut) && !force) {
    throw new Error(
      `Output directory already exists: ${absOut} (pass force=true to overwrite)`,
    );
  }

  mkdirSync(absOut, { recursive: true });

  if (options.crawlDir) {
    return buildFromCrawl(
      { ...options, crawlDir: options.crawlDir },
      absClone,
      absOut,
    );
  }

  // Past this point a clone-dir is guaranteed: only the no-crawl legacy path
  // reaches here, and it is gated by the validation above.
  const cloneDir = absClone as string;
  const publicDir = join(absOut, 'public');
  const assetStats = copyAssetsToPublic(cloneDir, publicDir);

  const html = readFileSync(join(cloneDir, 'index.html'), 'utf8');
  const $ = cheerio.load(html, null, true);

  const head = extractHead($);
  const { components } = sliceBody($);

  const srcDir = join(absOut, 'src');
  const pagesDir = join(srcDir, 'pages');

  const routeEntries: RouteEntry[] = routes.map((path) => ({
    path,
    componentName: deriveComponentName(path),
  }));

  writeScaffold(absOut, { name: options.name, routes: routeEntries });

  // Phase 1: every route renders the same captured body. Phase 2's crawler
  // will pair routes with their own clone dirs and slice each independently.
  //
  // The shared slicer returns Main as a composition wrapper (`html: ''` plus
  // structured `wrapper` + `childComponentNames`). We inline-expand it here
  // so the captured `<main>` opener/closer is preserved around the section
  // HTML in source order, and the per-section components are skipped (they
  // already live inside the expanded wrapper). This replaces the previous
  // `components.map((c) => c.html).join('\n')` which dropped the wrapper
  // tag and (worse) baked the leaky Astro frontmatter into the JSX as
  // literal text.
  const pageHtml = flattenComponentsForRoute(components);
  const pageJsx = htmlToJsx(pageHtml);

  for (const route of routeEntries) {
    const def: WebappComponentDef = {
      name: route.componentName,
      role: 'main',
      html: pageHtml,
      tsx: pageJsx,
    };
    writeComponent(pagesDir, def);
  }

  writeApp({ srcDir, routes: routeEntries, title: head.title });
  writeMain(srcDir, routeEntries);
  writeIndexHtml({ outDir: absOut, head });

  return {
    outDir: absOut,
    componentsEmitted: routeEntries.length,
    pagesEmitted: routeEntries.length,
    assetCount: assetStats.count,
    assetBytes: assetStats.bytes,
    endpointsEmitted: 0,
    fixturesEmitted: 0,
    wsConnectionsEmitted: 0,
  };
}
