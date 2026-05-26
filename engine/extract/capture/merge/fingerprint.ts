/**
 * Deterministic request fingerprinting for flow correlation + dedup.
 *
 * A fingerprint folds the volatile, per-request noise out of a request so two
 * logically-identical calls (different ids, different regional shard, different
 * cache-buster query) collapse to the same `normalizedKey`. The concrete values
 * stripped during normalization are retained in side maps so nothing is lost.
 *
 * normalizedKey = method + hostClass + pathTemplate + stableQuery + bodyShapeHash
 */

import { createHash } from 'node:crypto';
import type { Flow } from '../mitm/flow-types';

/** Query params that are pure cache-busters / telemetry — dropped from the key. */
const VOLATILE_QUERY_KEYS = new Set([
  '_',
  't',
  'ts',
  'timestamp',
  'cb',
  'cachebust',
  'cache_bust',
  'rand',
  'random',
  'nonce',
  'v',
  'ver',
  'version',
  'rid',
  'requestid',
  'request_id',
  'correlationid',
  'correlation_id',
  'traceid',
  'trace_id',
  '__cf_chl_rt_tk',
]);

/** Segment looks like a UUID. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Segment is all digits (numeric id). */
const NUMERIC_RE = /^\d+$/;
/** Segment is a long hex/base-ish opaque id. */
const OPAQUE_ID_RE = /^[0-9a-zA-Z_-]{16,}$/;
/** Regional shard host like `frontdoor-prod-eu-3` → folds to `frontdoor`. */
const SHARD_RE = /^([a-z]+)-(?:prod|stg|stage|dev|test)(?:-[a-z]{2,})?(?:-\d+)?$/i;
/** Generic trailing numeric shard suffix like `api-7` → `api`. */
const NUMERIC_SHARD_RE = /^([a-z][a-z-]*?)-\d+$/i;

export type Fingerprint = {
  /** The full normalized key (the join used for correlation/dedup). */
  normalizedKey: string;
  method: string;
  hostClass: string;
  pathTemplate: string;
  stableQuery: string;
  bodyShapeHash: string;
  /** Concrete path params extracted during templating, in path order. */
  params: Record<string, string>;
};

/**
 * Fold a host down to a stable class by stripping regional/shard suffixes.
 *  - `frontdoor-prod-eu-3.clickup.com` → `frontdoor.clickup.com`
 *  - `api-7.example.com`               → `api.example.com`
 */
export function hostClass(host: string): string {
  const lower = host.toLowerCase();
  const parts = lower.split('.');
  if (parts.length === 0) return lower;

  const first = parts[0];
  const shard = SHARD_RE.exec(first);
  if (shard) {
    parts[0] = shard[1];
    return parts.join('.');
  }
  const numeric = NUMERIC_SHARD_RE.exec(first);
  if (numeric) {
    parts[0] = numeric[1];
    return parts.join('.');
  }
  return lower;
}

/**
 * Template a path: replace id-like segments with `{param}` and record the
 * concrete value in the returned params map (keyed `p0`, `p1`, … in order).
 */
export function pathTemplate(pathname: string): { template: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  let idx = 0;
  const segments = pathname.split('/').map((seg) => {
    if (seg === '') return seg;
    const isId =
      UUID_RE.test(seg) ||
      NUMERIC_RE.test(seg) ||
      (OPAQUE_ID_RE.test(seg) && /\d/.test(seg));
    if (isId) {
      params[`p${idx++}`] = seg;
      return '{param}';
    }
    return seg;
  });
  return { template: segments.join('/'), params };
}

/** Build a stable, sorted query string with volatile keys dropped. */
export function stableQuery(search: URLSearchParams): string {
  const kept: Array<[string, string]> = [];
  for (const [k, v] of search.entries()) {
    if (VOLATILE_QUERY_KEYS.has(k.toLowerCase())) continue;
    kept.push([k, v]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return kept.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Hash the SHAPE of a JSON body (keys + value types), not its values, so two
 * structurally-identical POSTs with different payloads fingerprint the same.
 * Non-JSON or empty bodies hash to a fixed sentinel.
 */
export function bodyShapeHash(flow: Flow): string {
  if (flow.kind !== 'http') return 'ws';
  const m = flow.method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'none';
  const body = flow.reqBody;
  if (!body || body.encoding === 'empty') return 'none';
  if (body.encoding !== 'text') return `bin:${body.size}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return `text:${hash(body.text.slice(0, 256))}`;
  }
  return `json:${hash(shapeOf(parsed))}`;
}

function shapeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${shapeOf(value[0])}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${k}:${shapeOf(obj[k])}`).join(',')}}`;
  }
  return typeof value;
}

function hash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

/** Build the full fingerprint for a flow. */
export function fingerprint(flow: Flow): Fingerprint {
  let host = '';
  let pathname = '/';
  let search = new URLSearchParams();
  try {
    const u = new URL(flow.url);
    host = u.host;
    pathname = u.pathname;
    search = u.searchParams;
  } catch {
    pathname = flow.url;
  }

  const hc = hostClass(host);
  const { template, params } = pathTemplate(pathname);
  const sq = stableQuery(search);
  const bsh = bodyShapeHash(flow);
  const method = flow.method.toUpperCase();

  const normalizedKey = `${method} ${hc}${template}${sq ? `?${sq}` : ''} #${bsh}`;

  return {
    normalizedKey,
    method,
    hostClass: hc,
    pathTemplate: template,
    stableQuery: sq,
    bodyShapeHash: bsh,
    params,
  };
}
