/**
 * Body normalisation for fuzzy matching.
 *
 * Strips known-dynamic fields (timestamps, request ids, nonces, cache-busters)
 * and recursively sorts object keys so two POST bodies that differ ONLY in
 * dynamic fields produce the SAME normalised JSON string, and a structural
 * diff focuses on real semantic differences.
 *
 * Pure function — no I/O, no globals, deterministic.
 *
 * Exported in two forms:
 *   1. `normalizeBody(value, opts?)` — Node-callable for build-time unit tests.
 *   2. `NORMALIZE_BODY_SOURCE` — the same logic stringified for inlining into
 *      the generated sw.js. Browser scope is ES5-ish (no optional chaining,
 *      no spread in fn args) to maximise compatibility.
 */

/** Field NAMES whose value is volatile (different on every request). */
export const defaultDynamicFieldStripList: ReadonlyArray<string> = [
  'timestamp',
  'request_id',
  'requestId',
  'request-id',
  'nonce',
  '_t',
  'ts',
  'cache_vector',
  'cacheVector',
  'fresh_req',
  'freshReq',
  'sent_at',
  'sentAt',
  'created_at_for_request',
  'rid',
  'trace_id',
  'traceId',
];

export type NormalizeOptions = {
  stripFields?: ReadonlyArray<string>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively normalise a value: drop dynamic keys, sort remaining keys.
 * Arrays keep their order (positional semantics matter for filters/columns).
 */
export function normalizeBody(value: unknown, opts: NormalizeOptions = {}): unknown {
  const stripSet = new Set(opts.stripFields ?? defaultDynamicFieldStripList);
  return walk(value, stripSet);
}

function walk(value: unknown, stripSet: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, stripSet));
  }
  if (!isPlainObject(value)) return value;

  const keys = Object.keys(value).filter((k) => !stripSet.has(k)).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = walk(value[k], stripSet);
  return out;
}

/** Stable JSON.stringify of a normalised value. */
export function normalizedStringify(value: unknown, opts: NormalizeOptions = {}): string {
  return JSON.stringify(normalizeBody(value, opts));
}

/**
 * The same normalisation logic, stringified for inlining into the boot-shim /
 * sw.js. Deliberately ES5-ish for maximum browser compatibility (no optional
 * chaining, no spread in fn args, no Set spread).
 */
export const NORMALIZE_BODY_SOURCE = `
var FUZZY_DYNAMIC_FIELDS = ${JSON.stringify(defaultDynamicFieldStripList)};

function __fuzzy_isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function __fuzzy_walk(value, stripSet) {
  if (Array.isArray(value)) {
    var out = new Array(value.length);
    for (var i = 0; i < value.length; i++) out[i] = __fuzzy_walk(value[i], stripSet);
    return out;
  }
  if (!__fuzzy_isPlainObject(value)) return value;
  var keys = [];
  for (var k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k) && !stripSet[k]) keys.push(k);
  }
  keys.sort();
  var result = {};
  for (var j = 0; j < keys.length; j++) result[keys[j]] = __fuzzy_walk(value[keys[j]], stripSet);
  return result;
}

function __fuzzy_normalizeBody(value) {
  var stripSet = {};
  for (var i = 0; i < FUZZY_DYNAMIC_FIELDS.length; i++) stripSet[FUZZY_DYNAMIC_FIELDS[i]] = true;
  return __fuzzy_walk(value, stripSet);
}

function __fuzzy_normalizedStringify(value) {
  try { return JSON.stringify(__fuzzy_normalizeBody(value)); } catch (e) { return ''; }
}
`;
