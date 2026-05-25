import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrawlGraph } from '../targets/webapp/crawler/types';
import type { RouteSpec, RouteInteraction, RoutesFile } from './score-types';

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'root';
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url.startsWith('/') ? url : `/${url}`;
  }
}

/** Loads an explicit routes.json file. */
export async function loadRoutesFile(path: string): Promise<RouteSpec[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as RoutesFile | RouteSpec[];
  const routes = Array.isArray(parsed) ? parsed : parsed.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error(`Routes file ${path} contains no routes`);
  }
  return routes.map((r, i) => ({
    id: r.id ?? slugify(r.path ?? `route-${i}`),
    path: r.path,
    label: r.label ?? r.path,
    interactions: r.interactions ?? [],
  }));
}

/**
 * Derives routes + interactions from a crawl graph.json. Each unique node URL
 * becomes a route. Click/hover edges leaving that node become interactions on
 * the route (others are ignored as not auto-performable).
 */
export async function loadRoutesFromCrawl(crawlDir: string): Promise<RouteSpec[]> {
  const graphPath = join(crawlDir, 'graph.json');
  const raw = await readFile(graphPath, 'utf8');
  const graph = JSON.parse(raw) as CrawlGraph;

  const byUrl = new Map<string, RouteSpec>();
  const nodeUrlById = new Map<string, string>();

  for (const node of graph.nodes) {
    nodeUrlById.set(node.id, node.url);
    const path = pathFromUrl(node.url);
    if (!byUrl.has(node.url)) {
      byUrl.set(node.url, {
        id: slugify(path),
        path,
        label: node.title || path,
        interactions: [],
      });
    }
  }

  for (const edge of graph.edges) {
    const kind = edge.interaction.kind;
    if (kind !== 'click' && kind !== 'hover') continue;
    const fromUrl = nodeUrlById.get(edge.fromStateId);
    if (!fromUrl) continue;
    const route = byUrl.get(fromUrl);
    if (!route) continue;
    const interaction: RouteInteraction = {
      label: slugify(edge.interaction.selectorLabel || edge.interaction.selector),
      kind,
      selector: edge.interaction.selector,
    };
    route.interactions = route.interactions ?? [];
    if (!route.interactions.some((i) => i.selector === interaction.selector)) {
      route.interactions.push(interaction);
    }
  }

  const routes = [...byUrl.values()];
  if (routes.length === 0) {
    throw new Error(`Crawl graph at ${graphPath} produced no routes`);
  }
  return routes;
}
