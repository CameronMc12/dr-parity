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

import { extractHead, sliceBody, copyAssetsToPublic, pascalCase } from '../shared';
import { htmlToJsx } from '../react/html-to-jsx';
import { writeApp, writeComponent, writeIndexHtml, writeMain } from './emit';
import type { RouteEntry } from './emit';
import { writeScaffold } from './scaffold';
import { loadCrawlGraph, inferStateGroups } from './inference';
import type { RouteGroup } from './inference';
import { emitStatefulComponent, writeStatefulPage } from './emit-stateful';
import { emitRouter, emitStatefulMain } from './emit-router';
import type {
  WebappBuildOptions,
  WebappBuildSummary,
  WebappComponentDef,
} from './types';

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

function deriveComponentName(routePath: string): string {
  if (routePath === '/' || routePath.length === 0) return 'HomePage';
  const slug = routePath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  return `${pascalCase(slug)}Page`;
}

async function buildFromCrawl(
  options: WebappBuildOptions & { crawlDir: string },
  absClone: string,
  absOut: string,
): Promise<WebappBuildSummary> {
  const publicDir = join(absOut, 'public');
  const assetStats = copyAssetsToPublic(absClone, publicDir);

  const html = readFileSync(join(absClone, 'index.html'), 'utf8');
  const $ = cheerio.load(html, null, true);
  const head = extractHead($);

  const loaded = await loadCrawlGraph(options.crawlDir);
  const inference = await inferStateGroups(loaded.graph, loaded.getStateDom);

  const srcDir = join(absOut, 'src');
  const pagesDir = join(srcDir, 'pages');

  // Scaffold expects a list of RouteEntry — derive from inferred routes.
  const routeEntries: RouteEntry[] = inference.routes.map((r: RouteGroup) => ({
    path: r.routePath,
    componentName: deriveComponentName(r.routePath),
  }));

  writeScaffold(absOut, { name: options.name, routes: routeEntries });

  // Per-route stateful component. Base HTML comes from the base state DOM.
  let componentsEmitted = 0;
  for (const routeGroup of inference.routes) {
    const baseHtml = await loaded.getStateDom(routeGroup.baseStateGroup.baseStateId);
    const result = emitStatefulComponent({ route: routeGroup, baseHtml });
    writeStatefulPage(pagesDir, result);
    componentsEmitted++;
  }

  emitRouter(inference.routes, absOut);
  emitStatefulMain(absOut);
  writeIndexHtml({ outDir: absOut, head });

  return {
    outDir: absOut,
    componentsEmitted,
    pagesEmitted: inference.routes.length,
    assetCount: assetStats.count,
    assetBytes: assetStats.bytes,
  };
}

export async function buildWebappProject(
  options: WebappBuildOptions,
): Promise<WebappBuildSummary> {
  const absClone = resolve(options.cloneDir);
  const absOut = resolve(options.outDir);
  const force = options.force ?? false;
  const routes = options.routes && options.routes.length > 0 ? options.routes : ['/'];

  if (absOut === absClone || absOut.startsWith(absClone + '/')) {
    throw new Error('Refusing to write into the clone directory itself.');
  }

  validateCloneDir(absClone);

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

  const publicDir = join(absOut, 'public');
  const assetStats = copyAssetsToPublic(absClone, publicDir);

  const html = readFileSync(join(absClone, 'index.html'), 'utf8');
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
  const pageHtml = components.map((c) => c.html).join('\n');
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
  };
}
