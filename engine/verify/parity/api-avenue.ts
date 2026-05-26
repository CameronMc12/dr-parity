/**
 * API avenue: TRUE backend-API parity. Scores the CONTENT parity of the
 * intersection of API/XHR endpoints that BOTH reference and candidate issued.
 *
 * Scope is the owned backend's data surface only:
 *  - INCLUDE JSON (and JSON-ish data) responses + known API path families.
 *  - EXCLUDE static assets (css/js/img/font/map), SPA document navigations,
 *    and third-party telemetry (segment/datadog/sentry/gtm/split.io …).
 *
 * Matching uses the same normalization as the capture fingerprinter
 * (method + host-class + path-template + stable query) so logically-identical
 * calls collapse to one key regardless of volatile ids / regional shards /
 * cache-busters.
 *
 * Scoring is the INTERSECTION only: for each key BOTH sides issued, compare
 * status-class + JSON shape (tolerant of volatile ids/timestamps). A request
 * only one side issued is NOT a content-parity failure — service-worker / HTTP
 * cache means an asset served once need not reappear as a network request — so
 * those are surfaced as a separate low-weight coverage note, never a gap.
 * A genuinely different BODY on a shared endpoint IS a real gap.
 */

import type { ObservedResponse } from './drive';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';
import { hostClass, pathTemplate, stableQuery } from '../../extract/capture/merge/fingerprint';

export type ApiAvenueInput = {
  reference: ObservedResponse[];
  candidate: ObservedResponse[];
  weight: number;
};

/**
 * Fire-and-forget telemetry / analytics / RUM beacons. Not part of the owned
 * backend surface (a clone deliberately drops third-party trackers) and fire a
 * non-deterministic number of times per load, so they are excluded entirely.
 */
const TELEMETRY_HOST =
  /(datadoghq|datadog|segment|sentry|amplitude|mixpanel|fullstory|heap|intercom|hotjar|launchdarkly|split\.io|google-analytics|googletagmanager|gtag|doubleclick|facebook|cdn\.heapanalytics|braze|pendo|rudderstack|newrelic|nr-data|bugsnag|loggly|optimizely)\b/i;

/**
 * Static asset / document extensions. These are served from the clone bundle
 * or the SW cache and are scored by the visual/dom avenues, NOT the API avenue.
 * Matched against the URL pathname (query stripped).
 */
const STATIC_ASSET_EXT =
  /\.(css|js|mjs|cjs|map|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|pdf|wasm|txt|xml)$/i;

/**
 * Known owned-backend API path families. A request whose pathname contains any
 * of these is treated as API even if its content-type was momentarily wrong or
 * missing (e.g. an error page served as text/html on a 500).
 */
const API_PATH_FAMILY =
  /(^|\/)(hierarchy|task-v3|tasks?|view|views|workspace-v3|workspace|customfields|custom_fields|user\/v1|user|inbox|data\/v3|home|subcategory|category|list|folder|space|team|comment|notification|search|auth|session|graphql|api|v\d+)(\/|$|\?)/i;

/** Hosts that are part of the owned backend (frontdoor / api gateways). */
const API_HOST_FAMILY = /(frontdoor|api|backend|gateway|rest)\b/i;

/**
 * Does this response belong to the owned-backend API surface we score?
 *
 * Decision order:
 *  1. drop telemetry outright
 *  2. drop static assets by pathname extension
 *  3. drop SPA document navigations (top-level HTML the router serves)
 *  4. keep JSON/data content-types
 *  5. keep known API path families / API hosts (covers non-JSON API errors)
 */
function isApiResponse(r: ObservedResponse): boolean {
  if (isTelemetry(r)) return false;

  const { pathname, host } = splitUrl(r.url);

  if (STATIC_ASSET_EXT.test(pathname)) return false;
  if (isDocumentNavigation(r, pathname)) return false;

  if (isDataContentType(r.contentType)) return true;
  if (API_HOST_FAMILY.test(host)) return true;
  if (API_PATH_FAMILY.test(pathname)) return true;

  return false;
}

function isTelemetry(r: ObservedResponse): boolean {
  return TELEMETRY_HOST.test(r.url) || TELEMETRY_HOST.test(r.key);
}

/** JSON or JSON-ish structured data content-types (the API payload surface). */
function isDataContentType(ct: string): boolean {
  return /\b(json|graphql|x-protobuf|x-ndjson|problem\+json)\b/i.test(ct);
}

/**
 * A top-level SPA document navigation: an HTML response the router serves for a
 * client route (e.g. `/.../v/l/<id>`). These are not API data — the document is
 * scored by the visual + dom avenues, not here.
 */
function isDocumentNavigation(r: ObservedResponse, pathname: string): boolean {
  if (/\bhtml\b/i.test(r.contentType)) {
    // An HTML body on a known API family is a server error page, still API.
    return !API_PATH_FAMILY.test(pathname);
  }
  return false;
}

function splitUrl(url: string): { pathname: string; host: string; search: URLSearchParams } {
  try {
    const u = new URL(url);
    return { pathname: u.pathname, host: u.host, search: u.searchParams };
  } catch {
    return { pathname: url, host: '', search: new URLSearchParams() };
  }
}

/**
 * Normalized correlation key using the capture fingerprinter's primitives:
 * method + host-class + path-template + stable query. Logically-identical calls
 * (different ids, regional shard, cache-buster) collapse to one key.
 */
function normalizedApiKey(r: ObservedResponse): string {
  const { pathname, host, search } = splitUrl(r.url);
  const hc = hostClass(host);
  const { template } = pathTemplate(pathname);
  const sq = stableQuery(search);
  return `${r.method.toUpperCase()} ${hc}${template}${sq ? `?${sq}` : ''}`;
}

/** Collapse to one representative per normalized key (first wins). */
function dedupeByNormalizedKey(list: ObservedResponse[]): Map<string, ObservedResponse> {
  const map = new Map<string, ObservedResponse>();
  for (const r of list) {
    const key = normalizedApiKey(r);
    if (!map.has(key)) map.set(key, r);
  }
  return map;
}

/**
 * Map a status to a cache-equivalence class so HTTP cache timing (200 vs 304
 * vs 206 for the SAME resource) does not count as a mismatch.
 */
function statusClass(status: number): string {
  if (status === 200 || status === 304 || status === 206) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return String(status);
}

/** Keys whose values are volatile and excluded from shape comparison. */
const VOLATILE_KEY =
  /(^|_)(id|ids|token|csrf|nonce|cursor|etag|ts|time|date|updated|created|expires|seed|hash|sig|signature|version|rev|seq)($|_)/i;

type ShapeNode =
  | { t: 'null' }
  | { t: 'bool' }
  | { t: 'number' }
  | { t: 'string' }
  | { t: 'array'; el: ShapeNode | null }
  | { t: 'object'; keys: Record<string, ShapeNode> };

/** Reduce a JSON value to a type skeleton, dropping volatile keys + values. */
function toShape(value: unknown, depth = 0): ShapeNode {
  if (depth > 8) return { t: 'string' };
  if (value === null || value === undefined) return { t: 'null' };
  if (typeof value === 'boolean') return { t: 'bool' };
  if (typeof value === 'number') return { t: 'number' };
  if (typeof value === 'string') return { t: 'string' };
  if (Array.isArray(value)) {
    return { t: 'array', el: value.length > 0 ? toShape(value[0], depth + 1) : null };
  }
  if (typeof value === 'object') {
    const keys: Record<string, ShapeNode> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE_KEY.test(k)) continue;
      keys[k] = toShape(v, depth + 1);
    }
    return { t: 'object', keys };
  }
  return { t: 'string' };
}

/** 0..1 structural similarity between two shapes. */
function shapeSimilarity(a: ShapeNode, b: ShapeNode): number {
  if (a.t !== b.t) {
    if (a.t === 'null' || b.t === 'null') return 0.5;
    return 0;
  }
  if (a.t === 'array' && b.t === 'array') {
    if (a.el === null || b.el === null) return a.el === b.el ? 1 : 0.7;
    return shapeSimilarity(a.el, b.el);
  }
  if (a.t === 'object' && b.t === 'object') {
    const keysA = Object.keys(a.keys);
    const keysB = Object.keys(b.keys);
    if (keysA.length === 0 && keysB.length === 0) return 1;
    const all = new Set([...keysA, ...keysB]);
    let sum = 0;
    for (const k of all) {
      const ca = a.keys[k];
      const cb = b.keys[k];
      if (ca && cb) sum += shapeSimilarity(ca, cb);
    }
    return all.size > 0 ? sum / all.size : 1;
  }
  return 1;
}

export function scoreApiAvenue(input: ApiAvenueInput): AvenueScore {
  const { weight } = input;
  const notes: string[] = [];
  const gaps: Gap[] = [];

  const refRaw = input.reference;
  const candRaw = input.candidate;

  const telemetryRef = refRaw.filter(isTelemetry).length;
  if (telemetryRef > 0) {
    notes.push(`excluded ${telemetryRef} telemetry/analytics beacon(s) from scoring`);
  }

  // Scope to the owned-backend API surface only.
  const refApi = refRaw.filter(isApiResponse);
  const candApi = candRaw.filter(isApiResponse);
  const droppedRef = refRaw.length - refApi.length - telemetryRef;
  if (droppedRef > 0) {
    notes.push(`excluded ${droppedRef} static-asset/document response(s) from API scoring`);
  }

  if (refApi.length === 0) {
    return {
      avenue: 'api',
      score: 0,
      sampleSize: 0,
      gaps,
      notes: [...notes, 'no scorable reference API responses observed; API avenue skipped'],
      skipped: true,
    };
  }

  const refByKey = dedupeByNormalizedKey(refApi);
  const candByKey = dedupeByNormalizedKey(candApi);

  // Score the INTERSECTION: keys both sides issued.
  let sum = 0;
  let total = 0;
  let refOnly = 0;

  for (const [key, ref] of refByKey) {
    const cand = candByKey.get(key);
    if (!cand) {
      // One-sided issue (cache / SW served it without a network request).
      // Coverage note, NOT a content-parity failure.
      refOnly += 1;
      continue;
    }

    total += 1;

    const statusMatch = statusClass(ref.status) === statusClass(cand.status) ? 1 : 0;
    let shapeMatch = 1;
    if (ref.json !== undefined || cand.json !== undefined) {
      shapeMatch = shapeSimilarity(toShape(ref.json), toShape(cand.json));
    }
    // Status is the hard gate (60%), shape the soft (40%).
    const itemScore = 0.6 * statusMatch + 0.4 * shapeMatch;
    sum += itemScore;

    if (itemScore < 0.99) {
      const reasons: string[] = [];
      if (statusMatch < 1) reasons.push(`status ${ref.status} vs ${cand.status}`);
      if (shapeMatch < 1) reasons.push(`body shape ${(shapeMatch * 100).toFixed(0)}% match`);
      gaps.push({
        avenue: 'api',
        label: key,
        locator: ref.url,
        reason: reasons.join('; ') || 'partial match',
        severity: clampScore((1 - itemScore) * weight * 100),
      });
    }
  }

  const candOnly = [...candByKey.keys()].filter((k) => !refByKey.has(k)).length;

  if (refOnly > 0) {
    notes.push(
      `${refOnly} API endpoint(s) issued only by reference (likely served from candidate SW/HTTP cache without a network request); excluded from content-parity scoring`,
    );
  }
  if (candOnly > 0) {
    notes.push(`${candOnly} API endpoint(s) issued only by candidate; excluded from content-parity scoring`);
  }

  if (total === 0) {
    return {
      avenue: 'api',
      score: 0,
      sampleSize: 0,
      gaps,
      notes: [
        ...notes,
        'no shared API endpoints between reference and candidate to compare; API avenue skipped',
      ],
      skipped: true,
    };
  }

  gaps.sort((a, b) => b.severity - a.severity);
  const score = clampScore((sum / total) * 100);
  return {
    avenue: 'api',
    score,
    sampleSize: total,
    gaps,
    notes,
    skipped: false,
  };
}
