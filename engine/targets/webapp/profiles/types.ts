/**
 * Webapp profile types.
 *
 * A `WebappProfile` carries app-specific overrides for the otherwise generic
 * webapp crawler. The DEFAULT profile is empty (`discoverers: []`) and yields
 * bytewise-identical behaviour to the pre-profile crawler. Apps that need
 * extra discovery (e.g. ClickUp's view-enumeration API parsing) opt in by
 * supplying a profile.
 *
 * This iteration intentionally exposes ONLY the `discoverers` field. Future
 * fields (matchers, view-synth, boot-blockers, auth-keepers, schema-drift
 * detectors) are deliberately omitted — they are next-iteration scope. Keeping
 * the surface small keeps the no-regression bar trivially provable.
 */

import type { RouteDiscoverer } from '../crawler/discovery/types';

export type WebappProfile = {
  /** Stable identifier, used for logging + the `--profile=<name>` flag. */
  name: string;
  /**
   * Host matchers (string suffix OR regex). The first profile whose matcher
   * matches the host wins. `default` matches `*` and lives at the end of the
   * resolution list.
   */
  hostMatchers: ReadonlyArray<string | RegExp>;
  /**
   * Route discoverers run once at crawler init. Empty array (or omitted) =>
   * the crawler's original DOM-only frontier is unchanged.
   */
  discoverers?: ReadonlyArray<RouteDiscoverer>;
  /**
   * Additive. Glob patterns (relative to the repo root) that resolve to
   * previously-captured artefacts the discoverers can mine for seeds. The
   * crawler expands these once at init and passes the concrete file list into
   * the `DiscoveryContext`. Supports a single `*` per path segment; no `**`
   * or brace expansion (deliberately minimal — extend when a real need
   * appears).
   *
   * Absent / empty => discoverers run with an empty corpus list (the
   * pre-bootstrap behaviour). Default profile leaves this undefined so
   * behaviour is byte-identical for every other host.
   */
  bootstrapCorpus?: ReadonlyArray<string>;
  /**
   * Additive. View-synthesis config for the replay target.
   *
   * When `enabled` is true, the replay build infers one canonical
   * `ViewTemplate` per viewType from the network.jsonl files matched by
   * `templatePaths` and emits `replay/view-templates.json`. The generated
   * sw.js then uses those templates to synthesise `GET /viz/v1/view/<id>`
   * responses for viewIds the crawl never captured (FALLBACK — captured
   * responses always win).
   *
   * Absent / `enabled: false` => default profile behaviour unchanged.
   */
  viewSynth?: {
    enabled: boolean;
    /**
     * Glob patterns (relative to repo root) for network.jsonl files to mine
     * for view templates. Supports a single `*` per segment; no `**`.
     */
    templatePaths?: ReadonlyArray<string>;
  };
  /**
   * Additive. Doc-freeze config for the replay target.
   *
   * When `enabled` is true, the replay build reads `pagesIndexPath` (the
   * captured doc-pages export), emits a compact lookup index at
   * `replay/doc-pages.json`, and inlines the doc-freezer shim into the boot
   * shim. The shim watches for the Quill editor mount on `/v/dc/<id>`
   * routes and injects the captured markdown as static read-only HTML, so
   * the SPA does not hang waiting for the Codox WS to deliver content.
   *
   * Absent / `enabled: false` => default profile behaviour unchanged.
   */
  docFreeze?: {
    enabled: boolean;
    /** Absolute or repo-relative path to the captured doc-pages.json export. */
    pagesIndexPath?: string;
  };
  /**
   * Additive. Fuzzy POST-body matching for the replay target.
   *
   * When `enabled` is true, the generated sw.js falls through to a structural
   * similarity match for POST requests whose body never exact-matches any
   * captured recording. Dynamic fields (timestamps, request_ids, nonces) are
   * stripped before scoring, so two POSTs with identical structure but
   * different timestamps score 1.0 instead of failing exact-match and getting
   * an empty-200.
   *
   * Strict matches still win first; fuzzy only fires as the fallback before
   * the empty-200 default. Absent / `enabled: false` => behaviour unchanged.
   */
  fuzzyBodyMatch?: {
    enabled: boolean;
    /**
     * Override the per-class similarity thresholds. Any class omitted uses
     * the default (search/filter 0.85, bulk 0.90, crud 0.95, telemetry 0.70,
     * default 0.90). Values are clamped to [0, 1] by the matcher.
     */
    thresholds?: Partial<
      Record<'search' | 'filter' | 'bulk' | 'crud' | 'telemetry' | 'default', number>
    >;
    /**
     * Extra endpoint patterns to classify. First substring match against the
     * lowercased path wins; appended to the built-in defaults.
     */
    endpointPatterns?: ReadonlyArray<{
      pattern: string;
      class: 'search' | 'filter' | 'bulk' | 'crud' | 'telemetry' | 'default';
    }>;
  };
};
