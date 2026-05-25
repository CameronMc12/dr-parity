/**
 * URL normalisation for route-once dedup.
 *
 * The crawler must treat each distinct ROUTE as a single base capture, but it
 * must NOT collapse content-defining params. Earlier this stripped `tab`,
 * `view`, `panel` and similar, which wrongly merged `?tab=primary` with
 * `?tab=later` into one route key and lost real states. We now strip ONLY true
 * tracking junk:
 *   - the `utm_*` family, `fbclid`, `gclid`
 *   - `_` and other pure cache-bust keys
 *   - any param whose VALUE is a hex blob or a unix-style timestamp
 *
 * Content-affecting params (`tab`, `view`, `filter`, `group`, `panel`, etc.)
 * are KEPT, so `/inbox?tab=primary` and `/inbox?tab=later` are DISTINCT route
 * keys.
 *
 * Hash fragments: trailing junk is stripped, but a content-affecting fragment
 * (a SPA route hash like `#/board/123` or `#tab=...`) is treated as STATE and
 * kept. This is governed by `stripHash` (default false: keep meaningful hashes).
 */

/** Pure cache-bust / tracking keys — value-agnostic strip. */
const TRACKING_QUERY_KEYS = new Set([
  '_',
  'cb',
  'cachebust',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
]);

/** Hex blobs (ids/hashes) and unix-style timestamps are volatile VALUES. */
const VOLATILE_QUERY_VALUE_RE = /^[0-9a-f]{16,}$/i;
const TIMESTAMP_VALUE_RE = /^\d{10,}$/;

/** A fragment that merely points at an anchor/element id, not app state. */
function isTrivialFragment(fragment: string): boolean {
  if (!fragment) return true;
  // `#` alone, or a bare anchor id with no path/query semantics.
  const f = fragment.replace(/^#/, '');
  if (f === '') return true;
  if (/^[\w-]+$/.test(f)) return true; // simple anchor id
  return false;
}

export type NormalizeOptions = {
  /**
   * When true, drop the hash entirely. Default false: content-affecting
   * fragments (SPA hash routes) are KEPT as part of the route key, while
   * trivial anchor fragments are always dropped.
   */
  stripHash?: boolean;
};

/**
 * Returns a stable key for a URL. Strips tracking junk only; keeps
 * content-defining query params and content-affecting hash fragments. Two URLs
 * that point at the same logical state yield the same key.
 */
export function normalizeRouteUrl(rawUrl: string, opts: NormalizeOptions = {}): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const kept: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lower = key.toLowerCase();
    if (TRACKING_QUERY_KEYS.has(lower)) continue;
    if (VOLATILE_QUERY_VALUE_RE.test(value)) continue;
    if (TIMESTAMP_VALUE_RE.test(value)) continue;
    kept.push([key, value]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const query = kept.length > 0
    ? `?${kept.map(([k, v]) => `${k}=${v}`).join('&')}`
    : '';
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  let hash = '';
  if (!opts.stripHash && url.hash && !isTrivialFragment(url.hash)) {
    hash = url.hash;
  }

  return `${url.origin}${pathname}${query}${hash}`;
}

export function routePathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname || '/';
  } catch {
    return '/';
  }
}
