/**
 * Route discovery interface.
 *
 * Additive subsystem layered on top of the existing crawler frontier.
 * A `RouteDiscoverer` runs ONCE during crawler init (before the BFS loop) and
 * returns a list of `RouteSeed`s the crawler merges into the initial frontier.
 *
 * The discoverer is intentionally decoupled from `crawler.ts`: it is given a
 * small `DiscoveryContext` (just the bits it needs) and returns plain data.
 * The crawler only knows how to enqueue `RouteSeed`s — it has no idea what
 * mechanism produced them. This keeps the no-regression bar trivial: no
 * discoverers configured => empty array => zero behaviour change.
 *
 * Iteration scope: this iteration ships ONE concrete discoverer that reads
 * captured JSON response bodies (the api-hierarchy-traverser). A second pass
 * (DOM sidebar expander) is deliberately deferred to keep this small.
 */

/**
 * Priority assigned to seeds emitted by a discoverer. Equal to the existing
 * `PRIORITY_NEW_ROUTE` constant in `../priority-queue` so seeds compete at the
 * same tier as never-visited routes discovered via DOM. Re-exported here so the
 * discovery layer never imports the queue directly (one-way dependency).
 */
export const PRIORITY_NEW_ROUTE = 100;

/**
 * Confidence tier for a discovered seed. Drives dedup precedence (higher tier
 * wins when the same viewId is discovered by multiple passes) and lets the
 * crawler tag log lines for diagnostics. The crawler does NOT use confidence
 * to order the frontier in this iteration — the field is advisory only.
 *
 *   - 'strict'    : extracted from a known view-enumeration endpoint with a
 *                   sibling numeric `type` / `view_entity_type` field.
 *   - 'inferred'  : type derived from a co-located string field
 *                   (`type`/`view_type`/`category`) or from a URL token hint
 *                   (e.g. the SPA URL `/v/<seg>/<viewId>` or a path word
 *                   such as `/calendar_view/`).
 *   - 'fallback'  : no type signal at all. The discoverer emits one seed per
 *                   known view-type bucket so the crawler can probe each one
 *                   — non-resolving seeds will be logged as 404s by the
 *                   crawler's normal navigation-error path.
 */
export type SeedConfidence = 'strict' | 'inferred' | 'fallback';

/**
 * Numeric ranking of `SeedConfidence`. Higher = stronger. Used by the hybrid
 * discoverer to dedup: when two passes emit a seed for the same viewId+url,
 * the higher tier wins.
 */
export const CONFIDENCE_RANK: Record<SeedConfidence, number> = {
  strict: 3,
  inferred: 2,
  fallback: 1,
};

/**
 * A single discovered route. The crawler enqueues each seed as a queue item:
 *   { url, depth: 0, viaEdge: null, priority }
 * The advisory fields (`sourceTag`, `viewId`, `viewType`, `confidence`) are
 * ignored by the crawler today but readable by tooling + log scanners.
 */
export type RouteSeed = {
  /** Fully-qualified URL to enqueue. */
  url: string;
  /** Priority for the priority queue. Defaults to `PRIORITY_NEW_ROUTE`. */
  priority?: number;
  /** Which discoverer / pass produced this seed (advisory; for logs). */
  sourceTag?: string;
  /** Optional viewId the seed was synthesised from (advisory). */
  viewId?: string;
  /**
   * Canonical view-type bucket. `'unknown'` when the discoverer could not
   * infer a type (fallback seeds are emitted one-per-known-type and each
   * carries the concrete type they target — they do NOT carry 'unknown').
   */
  viewType?: string | 'unknown';
  /** Confidence tier for this seed (see `SeedConfidence`). Defaults to 'strict'. */
  confidence?: SeedConfidence;
};

/**
 * Minimal context handed to a discoverer at crawler init. Add fields here ONLY
 * when a new discoverer concretely needs them (YAGNI). Today the
 * api-hierarchy-traverser needs only the host + paths to captured network logs
 * + the original start URL so it can synthesise same-origin URLs.
 *
 * - `host`            : the hostname of the crawl (e.g. `app.clickup.com`).
 * - `origin`          : the full origin (e.g. `https://app.clickup.com`).
 * - `startUrl`        : the original start URL — used to lift the workspace
 *                       prefix for synthesised view URLs.
 * - `networkLogPaths` : absolute paths to network-log files (one or more
 *                       `network.jsonl`s). May be empty on a fresh crawl
 *                       before any capture; discoverers handle that gracefully.
 */
export type DiscoveryContext = {
  host: string;
  origin: string;
  startUrl: string;
  networkLogPaths: readonly string[];
  /**
   * Additive. Concrete file paths the crawler resolved from the profile's
   * `bootstrapCorpus` globs. Discoverers should prefer these (they refer to
   * PRIOR captures with real data) over `networkLogPaths` (which on a fresh
   * crawl is empty at t=0). Absent or empty => no bootstrap corpus available.
   */
  bootstrapCorpusPaths?: readonly string[];
};

export interface RouteDiscoverer {
  /** Human-readable name for logging. */
  readonly name: string;
  /** Run the discovery pass. Returns an array of seeds (may be empty). */
  discover(ctx: DiscoveryContext): Promise<RouteSeed[]>;
}
