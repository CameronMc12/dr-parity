/**
 * Match a run's recorded API requests against the surface-map endpoints.
 * Run URLs are tokenized identically to how the surface map was built, then
 * keyed by `METHOD template`. Reports HIT/MISSED per endpoint, per-service and
 * overall hit %, plus endpoints hit in the run that are NOT in the surface map.
 */

import { buildEndpointTemplate } from './tokenize.js';
import type { NetworkRequestLine } from '../surface-map/types.js';
import type {
  EndpointCoverage,
  EndpointStatus,
  NewEndpoint,
  ServiceRollup,
  SurfaceEndpoints,
} from './types.js';

/** Same API hosts the surface-map endpoint extractor scopes to. */
const API_HOSTS = new Set([
  'frontdoor-prod-eu-west-1-3.clickup.com',
  'frontdoor-search.clickup-eu.com',
]);

type RunHit = { count: number; exampleUrl: string };

function tallyRunRequests(requests: NetworkRequestLine[]): Map<string, RunHit> {
  const byKey = new Map<string, RunHit>();
  for (const req of requests) {
    let parsed: URL;
    try {
      parsed = new URL(req.url);
    } catch {
      continue;
    }
    if (!API_HOSTS.has(parsed.host)) continue;
    const template = buildEndpointTemplate(parsed.pathname);
    const method = (req.method || 'GET').toUpperCase();
    const key = `${method} ${template}`;
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { count: 1, exampleUrl: req.url });
  }
  return byKey;
}

function rollupByService(endpoints: EndpointStatus[]): ServiceRollup[] {
  const map = new Map<string, ServiceRollup>();
  for (const e of endpoints) {
    const r = map.get(e.service) ?? { service: e.service, total: 0, hit: 0, pct: 0 };
    r.total += 1;
    if (e.hit) r.hit += 1;
    map.set(e.service, r);
  }
  const list = [...map.values()];
  for (const r of list) r.pct = r.total === 0 ? 0 : round(r.hit / r.total * 100);
  return list.sort((a, b) => b.total - a.total || a.service.localeCompare(b.service));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeEndpointCoverage(
  surface: SurfaceEndpoints,
  requests: NetworkRequestLine[],
): EndpointCoverage {
  const runHits = tallyRunRequests(requests);
  const surfaceKeys = new Set<string>();
  const endpoints: EndpointStatus[] = [];

  for (const [service, list] of Object.entries(surface)) {
    for (const ep of list) {
      const key = `${ep.method} ${ep.pathTemplate}`;
      surfaceKeys.add(key);
      const hit = runHits.get(key);
      endpoints.push({
        service,
        method: ep.method,
        pathTemplate: ep.pathTemplate,
        surfaceCount: ep.count,
        hit: hit != null,
        runCount: hit?.count ?? 0,
      });
    }
  }

  endpoints.sort(
    (a, b) =>
      a.service.localeCompare(b.service) ||
      a.pathTemplate.localeCompare(b.pathTemplate) ||
      a.method.localeCompare(b.method),
  );

  const missed = endpoints
    .filter((e) => !e.hit)
    .sort((a, b) => b.surfaceCount - a.surfaceCount);

  const newDiscoveries: NewEndpoint[] = [];
  for (const [key, hit] of runHits) {
    if (surfaceKeys.has(key)) continue;
    const sep = key.indexOf(' ');
    newDiscoveries.push({
      method: key.slice(0, sep),
      pathTemplate: key.slice(sep + 1),
      runCount: hit.count,
      exampleUrl: hit.exampleUrl,
    });
  }
  newDiscoveries.sort((a, b) => b.runCount - a.runCount);

  const total = endpoints.length;
  const hitCount = endpoints.filter((e) => e.hit).length;

  return {
    overall: { total, hit: hitCount, pct: total === 0 ? 0 : round(hitCount / total * 100) },
    byService: rollupByService(endpoints),
    endpoints,
    missed,
    newDiscoveries,
  };
}
