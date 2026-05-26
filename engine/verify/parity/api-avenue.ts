/**
 * API avenue: response match. Given reference network responses and the
 * candidate's served responses for the SAME requests, score the % that match
 * on status + body shape, tolerant of volatile fields (ids, timestamps,
 * tokens, cursors). Shape match = same JSON key skeleton + value types, not
 * exact values.
 */

import type { ObservedResponse } from './drive';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

export type ApiAvenueInput = {
  reference: ObservedResponse[];
  candidate: ObservedResponse[];
  weight: number;
};

/**
 * Fire-and-forget telemetry / analytics / RUM beacons. These are not part of
 * app parity (a clone deliberately drops third-party trackers) and fire a
 * non-deterministic number of times per load, so they are excluded from
 * scoring. Matched on the host portion of the request key.
 */
const TELEMETRY_HOST =
  /(datadoghq|datadog|segment|sentry|amplitude|mixpanel|fullstory|heap|intercom|hotjar|launchdarkly|split\.io|google-analytics|googletagmanager|doubleclick|facebook|cdn\.heapanalytics|braze|pendo|rudderstack|newrelic|nr-data|bugsnag|loggly|optimizely)\b/i;

function isTelemetry(r: ObservedResponse): boolean {
  return TELEMETRY_HOST.test(r.url) || TELEMETRY_HOST.test(r.key);
}

/**
 * Collapse repeated identical request keys to one representative per key. A
 * count mismatch alone (the SPA fired the same poll N vs M times) is not a
 * response-parity failure; we score one match per distinct key.
 */
function dedupeByKey(list: ObservedResponse[]): ObservedResponse[] {
  const seen = new Set<string>();
  const out: ObservedResponse[] = [];
  for (const r of list) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out;
}

/** Keys whose values are volatile and excluded from shape comparison. */
const VOLATILE_KEY = /(^|_)(id|ids|token|csrf|nonce|cursor|etag|ts|time|date|updated|created|expires|seed|hash|sig|signature|version|rev|seq)($|_)/i;

/**
 * Map a status to a cache-equivalence class so HTTP cache timing (200 vs 304
 * vs 206 for the SAME resource) does not count as a response mismatch. Both
 * sides "served the resource OK"; only the cache state differed.
 */
function statusClass(status: number): string {
  if (status === 200 || status === 304 || status === 206) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return String(status);
}

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
    // Represent an array by the shape of its first element (homogeneous assumption).
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
    // null vs anything is a soft match (optional / empty payloads).
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
      // missing on one side contributes 0
    }
    return all.size > 0 ? sum / all.size : 1;
  }
  return 1; // same primitive type
}

/** Pick the best candidate response for a reference key (first match wins). */
function indexByKey(list: ObservedResponse[]): Map<string, ObservedResponse[]> {
  const map = new Map<string, ObservedResponse[]>();
  for (const r of list) {
    const arr = map.get(r.key) ?? [];
    arr.push(r);
    map.set(r.key, arr);
  }
  return map;
}

export function scoreApiAvenue(input: ApiAvenueInput): AvenueScore {
  const { weight } = input;
  const notes: string[] = [];
  const gaps: Gap[] = [];

  const telemetryRef = input.reference.filter(isTelemetry).length;
  const reference = dedupeByKey(input.reference.filter((r) => !isTelemetry(r)));
  const candidate = dedupeByKey(input.candidate.filter((r) => !isTelemetry(r)));
  if (telemetryRef > 0) {
    notes.push(`excluded ${telemetryRef} telemetry/analytics beacon(s) from scoring`);
  }

  if (reference.length === 0) {
    return {
      avenue: 'api',
      score: 0,
      sampleSize: 0,
      gaps,
      notes: [...notes, 'no scorable reference responses observed; API avenue skipped'],
      skipped: true,
    };
  }

  const candIndex = indexByKey(candidate);
  const usedCand = new Set<ObservedResponse>();
  let sum = 0;
  let total = 0;

  for (const ref of reference) {
    const candidates = candIndex.get(ref.key) ?? [];
    const cand = candidates.find((c) => !usedCand.has(c)) ?? candidates[0];
    total += 1;

    if (!cand) {
      gaps.push({
        avenue: 'api',
        label: ref.key,
        locator: ref.url,
        reason: 'candidate never served this request',
        severity: clampScore(1 * weight * 100),
      });
      continue;
    }
    usedCand.add(cand);

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
      if (shapeMatch < 1) reasons.push(`shape ${(shapeMatch * 100).toFixed(0)}% match`);
      gaps.push({
        avenue: 'api',
        label: ref.key,
        locator: ref.url,
        reason: reasons.join('; ') || 'partial match',
        severity: clampScore((1 - itemScore) * weight * 100),
      });
    }
  }

  gaps.sort((a, b) => b.severity - a.severity);
  const score = total > 0 ? clampScore((sum / total) * 100) : 0;
  return {
    avenue: 'api',
    score,
    sampleSize: total,
    gaps,
    notes,
    skipped: false,
  };
}
