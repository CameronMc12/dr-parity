import { readFileSync } from 'node:fs';
import type {
  CapturedResponse,
  EndpointMap,
  EndpointMapEntry,
  SurfaceEndpoint,
} from './types.js';
import { pathOf } from './net-reader.js';

/** Turn a concrete path into a loose template so captures can match it. */
function templateToRegex(pathTemplate: string): RegExp {
  const escaped = pathTemplate
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:\w+/g, '[^/]+');
  return new RegExp('^' + escaped + '(?:[/?]|$)');
}

function loadSurface(endpointsPath: string): SurfaceEndpoint[] {
  const raw = JSON.parse(readFileSync(endpointsPath, 'utf8')) as Record<string, SurfaceEndpoint[]>;
  const out: SurfaceEndpoint[] = [];
  for (const list of Object.values(raw)) {
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

/**
 * For each surface-map endpoint, attach the best captured example response so a
 * mock service can replay it. Endpoints with no captured data are flagged.
 */
export function buildEndpointMap(
  endpointsPath: string,
  responses: CapturedResponse[],
): { map: EndpointMap; gaps: SurfaceEndpoint[] } {
  const surface = loadSurface(endpointsPath);
  const byPath = responses.map((r) => ({ path: pathOf(r.url), res: r }));
  const map: EndpointMap = {};
  const gaps: SurfaceEndpoint[] = [];

  for (const ep of surface) {
    const re = templateToRegex(ep.pathTemplate);
    const hit = byPath.find((b) => b.res.method === ep.method && re.test(b.path));
    const entry: EndpointMapEntry = {
      service: ep.service,
      method: ep.method,
      pathTemplate: ep.pathTemplate,
      exampleUrl: ep.exampleUrl,
      hasCapturedResponse: Boolean(hit),
      status: hit ? hit.res.status : null,
      example: hit ? hit.res.json : (ep.sampleResponseBodyShape ?? null),
    };
    (map[ep.service] ??= []).push(entry);
    if (!hit) gaps.push(ep);
  }

  return { map, gaps };
}
