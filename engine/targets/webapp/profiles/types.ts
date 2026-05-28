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
};
