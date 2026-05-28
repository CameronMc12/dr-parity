/**
 * Fuzzy body matcher for POST recordings.
 *
 * Algorithm choice: HAND-ROLLED structural similarity over the normalised
 * stable-stringified bodies. Reasoning:
 *
 *   - jsondiffpatch is NOT a current repo dependency. Adding it would pull
 *     ~80KB into every sw.js, with CJS/ESM-export friction inside the
 *     plain-JS service-worker scope.
 *   - The captured-vs-incoming bodies differ in a small set of dynamic
 *     fields (timestamps, request_ids, date-window filters). After stripping
 *     those + sorting keys, a length-based similarity over the stable JSON
 *     strings is already discriminating enough to clear the 0.85 search
 *     threshold for near-twins and to drop below 0.95 for structurally
 *     different siblings.
 *   - The hand-rolled comparator is ~40 LOC, dependency-free, and inlines
 *     cleanly into the generated SW.
 *
 * Score formula: similarity = 1 - (editDistance / max(|a|, |b|))
 *   - For strings ≤ 4 KB we run a true Levenshtein DP.
 *   - For longer strings we fall back to a cheap length-delta score
 *     1 - |len(a) - len(b)| / max(len(a), len(b))  — this avoids quadratic
 *     blow-up on very large bodies while still rejecting structurally
 *     different siblings (whose stable-stringified lengths diverge sharply).
 *
 * Pure function: no I/O, no globals, deterministic.
 */

import { normalizedStringify, type NormalizeOptions } from './normalize-body';
import {
  classifyEndpoint,
  thresholdFor,
  defaultEndpointPatterns,
  defaultThresholds,
  type EndpointPattern,
  type ThresholdMap,
} from './endpoint-thresholds';

/** The minimal shape the matcher needs from a captured recording. */
export type FuzzyCandidate = {
  /** Stable normalised key the runtime uses for exact-match. May be raw JSON. */
  requestBodyKey: string;
  status: number;
  body: string;
  contentType?: string;
};

export type FuzzyMatchOptions = {
  thresholds?: ThresholdMap;
  endpointPatterns?: ReadonlyArray<EndpointPattern>;
  stripFields?: ReadonlyArray<string>;
};

export type FuzzyMatchResult = {
  candidate: FuzzyCandidate;
  score: number;
  threshold: number;
  endpointClass: string;
};

/** Levenshtein DP capped at MAX_LEN to avoid O(n²) blow-up on huge bodies. */
const LEVENSHTEIN_MAX_LEN = 4096;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Two-row DP — O(min(a,b)) space, O(a*b) time.
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

/** Similarity ∈ [0, 1]. 1 = identical normalised bodies. */
export function similarity(aNormStr: string, bNormStr: string): number {
  if (aNormStr === bNormStr) return 1;
  const maxLen = Math.max(aNormStr.length, bNormStr.length);
  if (maxLen === 0) return 1;
  if (maxLen > LEVENSHTEIN_MAX_LEN) {
    // Cheap length-delta score — discriminates structurally different siblings
    // without quadratic cost on huge payloads.
    const delta = Math.abs(aNormStr.length - bNormStr.length);
    return Math.max(0, 1 - delta / maxLen);
  }
  return Math.max(0, 1 - levenshtein(aNormStr, bNormStr) / maxLen);
}

/**
 * Run fuzzy matching over a candidate set. Returns the highest-scoring
 * candidate whose score meets the endpoint-class threshold, or null.
 *
 * Caller is responsible for: (1) confirming the request is a POST, (2) having
 * already tried exact-match and missed. This function does NOT short-circuit
 * on exact match — it scores every candidate and picks the best.
 */
export function fuzzyMatchBody(
  incomingPath: string,
  incomingBody: unknown,
  candidates: ReadonlyArray<FuzzyCandidate>,
  opts: FuzzyMatchOptions = {},
): FuzzyMatchResult | null {
  if (candidates.length === 0) return null;

  const stripFields = opts.stripFields;
  const normalizeOpts: NormalizeOptions = stripFields ? { stripFields } : {};
  const incomingNorm = normalizedStringify(incomingBody, normalizeOpts);
  if (!incomingNorm) return null;

  const cls = classifyEndpoint(incomingPath, opts.endpointPatterns ?? defaultEndpointPatterns);
  const threshold = thresholdFor(cls, opts.thresholds ?? defaultThresholds);

  let best: FuzzyMatchResult | null = null;
  for (const cand of candidates) {
    const candParsed = tryParseJson(cand.requestBodyKey);
    const candNorm = candParsed === undefined
      ? cand.requestBodyKey
      : normalizedStringify(candParsed, normalizeOpts);
    const score = similarity(incomingNorm, candNorm);
    if (!best || score > best.score) {
      best = { candidate: cand, score, threshold, endpointClass: cls };
    }
  }

  if (!best || best.score < threshold) return null;
  return best;
}

function tryParseJson(s: string): unknown | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * The matcher logic, stringified for inlining into the generated sw.js.
 * Mirrors `fuzzyMatchBody` + `similarity` + `levenshtein` above. Combine with
 * NORMALIZE_BODY_SOURCE and the thresholds source (from buildThresholdsSource).
 */
export const FUZZY_MATCHER_SOURCE = `
var FUZZY_LEVENSHTEIN_MAX = ${LEVENSHTEIN_MAX_LEN};

function __fuzzy_levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var prev = new Array(b.length + 1);
  var curr = new Array(b.length + 1);
  for (var j = 0; j <= b.length; j++) prev[j] = j;
  for (var i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (var k = 1; k <= b.length; k++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1;
      curr[k] = Math.min(curr[k - 1] + 1, prev[k] + 1, prev[k - 1] + cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[b.length];
}

function __fuzzy_similarity(a, b) {
  if (a === b) return 1;
  var maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  if (maxLen > FUZZY_LEVENSHTEIN_MAX) {
    var delta = Math.abs(a.length - b.length);
    return Math.max(0, 1 - delta / maxLen);
  }
  return Math.max(0, 1 - __fuzzy_levenshtein(a, b) / maxLen);
}

function __fuzzy_tryParse(s) {
  if (!s) return undefined;
  try { return JSON.parse(s); } catch (e) { return undefined; }
}

/**
 * Returns { candidate, score, threshold, endpointClass } when a match
 * meeting the class threshold is found; null otherwise. ONLY called after
 * exact match has already missed for a POST.
 */
function fuzzyMatchBody(incomingPath, incomingParsedBody, candidates) {
  if (!candidates || candidates.length === 0) return null;
  var incomingNorm = __fuzzy_normalizedStringify(incomingParsedBody);
  if (!incomingNorm) return null;
  var cls = __fuzzy_classifyEndpoint(incomingPath);
  var threshold = __fuzzy_thresholdFor(cls);
  var best = null;
  for (var i = 0; i < candidates.length; i++) {
    var cand = candidates[i];
    var parsed = __fuzzy_tryParse(cand.requestBodyKey);
    var candNorm = (parsed === undefined) ? cand.requestBodyKey : __fuzzy_normalizedStringify(parsed);
    var score = __fuzzy_similarity(incomingNorm, candNorm);
    if (!best || score > best.score) {
      best = { candidate: cand, score: score, threshold: threshold, endpointClass: cls };
    }
  }
  if (!best || best.score < threshold) return null;
  return best;
}
`;
