/**
 * Match the surface map's observed nav-patterns against routes actually visited
 * in the run. A run route is the patternized pathname of a graph node URL or of
 * a `resourceType: 'document'` network request on app.clickup.com.
 */

import { patternizeRoute } from './tokenize.js';
import type { NetworkRequestLine } from '../surface-map/types.js';
import type { RouteCoverage, RouteStatus, SurfaceRoute } from './types.js';

const APP_HOST = 'app.clickup.com';

function patternFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.host !== APP_HOST) return null;
  if (parsed.pathname.includes('.')) return null; // skip asset files
  return patternizeRoute(parsed.pathname);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeRouteCoverage(
  surfaceRoutes: SurfaceRoute[],
  graphUrls: string[],
  documentRequests: NetworkRequestLine[],
): RouteCoverage {
  const fromGraph = new Set<string>();
  for (const url of graphUrls) {
    const p = patternFromUrl(url);
    if (p) fromGraph.add(p);
  }
  const fromDocs = new Set<string>();
  for (const req of documentRequests) {
    const p = patternFromUrl(req.url);
    if (p) fromDocs.add(p);
  }

  const routes: RouteStatus[] = surfaceRoutes.map((r) => {
    const inGraph = fromGraph.has(r.pattern);
    const inDocs = fromDocs.has(r.pattern);
    const source: RouteStatus['source'] = inGraph && inDocs
      ? 'both'
      : inGraph
        ? 'graph'
        : inDocs
          ? 'document'
          : 'none';
    return { pattern: r.pattern, surfaceCount: r.count, hit: inGraph || inDocs, source };
  });

  routes.sort((a, b) => b.surfaceCount - a.surfaceCount);
  const missed = routes.filter((r) => !r.hit);
  const total = routes.length;
  const hit = routes.filter((r) => r.hit).length;

  return {
    overall: { total, hit, pct: total === 0 ? 0 : round(hit / total * 100) },
    routes,
    missed,
  };
}
