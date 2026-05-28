/**
 * Profile resolution.
 *
 * Pure function. Given a host (and an optional explicit name override),
 * returns the matching `WebappProfile`. Resolution order:
 *
 *   1. Explicit `override` name: exact match against known profile names.
 *      Falls back to `default` if the name is unknown.
 *   2. First profile (other than `default`) whose `hostMatchers` match the
 *      host.
 *   3. `default` as the universal fallback.
 *
 * `hostMatchers` may be a string (treated as a case-insensitive suffix match)
 * or a `RegExp` (matched verbatim).
 */

import { clickupProfile } from './clickup';
import { defaultProfile } from './default';
import type { WebappProfile } from './types';

/**
 * Registry of non-default profiles. Order is iteration order, so put the most
 * specific profiles first. `default` is appended automatically by
 * `resolveProfile`.
 */
const NON_DEFAULT_PROFILES: ReadonlyArray<WebappProfile> = [clickupProfile];

const ALL_PROFILES_BY_NAME: ReadonlyMap<string, WebappProfile> = new Map(
  [defaultProfile, ...NON_DEFAULT_PROFILES].map((p) => [p.name, p]),
);

function hostMatches(host: string, matcher: string | RegExp): boolean {
  if (typeof matcher === 'string') {
    const h = host.toLowerCase();
    const m = matcher.toLowerCase();
    return h === m || h.endsWith(`.${m}`) || h.endsWith(m);
  }
  return matcher.test(host);
}

export function resolveProfile(host: string, override?: string): WebappProfile {
  if (override) {
    const named = ALL_PROFILES_BY_NAME.get(override);
    if (named) return named;
    // Unknown override is a soft failure: log + fall back to default so the
    // crawl still runs, rather than aborting the whole pipeline.
    console.log(
      `[webapp-profile] unknown profile name "${override}" — falling back to "default"`,
    );
    return defaultProfile;
  }
  for (const profile of NON_DEFAULT_PROFILES) {
    for (const matcher of profile.hostMatchers) {
      if (hostMatches(host, matcher)) return profile;
    }
  }
  return defaultProfile;
}

/** All registered profile names — used by the CLI for `--profile=` validation. */
export function listProfileNames(): readonly string[] {
  return Array.from(ALL_PROFILES_BY_NAME.keys());
}
