/**
 * Endpoint classification + similarity thresholds for fuzzy POST matching.
 *
 * Different endpoint classes have different tolerances for body drift:
 *
 *   - search/filter: bodies vary heavily (free-text query, dynamic filter
 *     groups, timestamp date-windows). A real "near" capture might score 0.85.
 *   - bulk:          ID arrays vary, but the request shape is rigid. 0.90.
 *   - crud:          create/update payloads must agree on every field that
 *                    drives a database write. 0.95.
 *   - telemetry:     event payloads are noisy by design. 0.70.
 *   - default:       conservative: 0.90.
 *
 * A request whose similarity to the best-candidate falls BELOW its class
 * threshold yields no fuzzy match — the SW falls through to empty-200 / 404
 * exactly as before (no regression).
 *
 * Pure module — no side effects.
 */

export type EndpointClass = 'search' | 'filter' | 'bulk' | 'crud' | 'telemetry' | 'default';

export type ThresholdMap = Partial<Record<EndpointClass, number>>;

export const defaultThresholds: Required<Record<EndpointClass, number>> = {
  search: 0.85,
  filter: 0.85,
  bulk: 0.9,
  crud: 0.95,
  telemetry: 0.7,
  default: 0.9,
};

/**
 * Default endpoint patterns. Matched against a request's path (already
 * normalised: lowercase, query stripped). First substring match wins.
 *
 * Profiles can extend this list via `profile.fuzzyBodyMatch.endpointPatterns`.
 */
export type EndpointPattern = { pattern: string; class: EndpointClass };

export const defaultEndpointPatterns: ReadonlyArray<EndpointPattern> = [
  // ClickUp / similar SPAs: genericView is the task-grid query endpoint.
  { pattern: '/genericview', class: 'search' },
  { pattern: '/generic_view', class: 'search' },
  { pattern: '/view/v1/', class: 'search' },
  // Bulk read endpoints.
  { pattern: '/tasks/bulk', class: 'bulk' },
  { pattern: '/docs/bulk', class: 'bulk' },
  // CRUD task endpoints (create/update/delete a task).
  { pattern: '/task-v3/', class: 'crud' },
  { pattern: '/cmd/v1/', class: 'crud' },
  // Telemetry / events.
  { pattern: '/telemetry/', class: 'telemetry' },
  { pattern: '/events/', class: 'telemetry' },
  { pattern: '/_/insight', class: 'telemetry' },
  { pattern: '/_/log', class: 'telemetry' },
];

/**
 * Classify an endpoint path. Path should be lowercased and query-stripped.
 * Returns 'default' when no pattern matches.
 */
export function classifyEndpoint(
  path: string,
  patterns: ReadonlyArray<EndpointPattern> = defaultEndpointPatterns,
): EndpointClass {
  const lower = path.toLowerCase();
  for (const p of patterns) {
    if (lower.indexOf(p.pattern.toLowerCase()) !== -1) return p.class;
  }
  return 'default';
}

/**
 * Resolve the similarity threshold for a class, falling back to defaults.
 */
export function thresholdFor(
  cls: EndpointClass,
  overrides: ThresholdMap = {},
): number {
  return overrides[cls] ?? defaultThresholds[cls];
}

/**
 * ES5-ish source of the same classification logic, inlined into sw.js when
 * fuzzy matching is enabled.
 */
export function buildThresholdsSource(
  patterns: ReadonlyArray<EndpointPattern>,
  thresholds: Required<Record<EndpointClass, number>>,
): string {
  return `
var FUZZY_ENDPOINT_PATTERNS = ${JSON.stringify(patterns)};
var FUZZY_THRESHOLDS = ${JSON.stringify(thresholds)};

function __fuzzy_classifyEndpoint(path) {
  var lower = String(path || '').toLowerCase();
  for (var i = 0; i < FUZZY_ENDPOINT_PATTERNS.length; i++) {
    var p = FUZZY_ENDPOINT_PATTERNS[i];
    if (lower.indexOf(String(p.pattern).toLowerCase()) !== -1) return p['class'];
  }
  return 'default';
}

function __fuzzy_thresholdFor(cls) {
  var v = FUZZY_THRESHOLDS[cls];
  if (typeof v === 'number') return v;
  return FUZZY_THRESHOLDS['default'];
}
`;
}
