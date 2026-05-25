/**
 * URL normalisation for route-once dedup.
 *
 * The crawler must treat each distinct ROUTE as a single base capture. Many
 * SPAs append volatile query params (?tab=, ?_=timestamp, tracking ids) and
 * hash fragments that do not represent a different page. We strip those so
 * `/inbox`, `/inbox?tab=primary`, and `/inbox#x` collapse to one key, while
 * preserving genuinely route-defining params.
 */

const VOLATILE_QUERY_KEYS = new Set([
  '_',
  't',
  'ts',
  'cb',
  'cachebust',
  'cache',
  'v',
  'ref',
  'referrer',
  'source',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'sessionid',
  'session_id',
  'requestid',
  'request_id',
  'tab',
  'view',
  'panel',
]);

const VOLATILE_QUERY_VALUE_RE = /^[0-9a-f]{16,}$/i;

/**
 * Returns a stable key for a URL that ignores volatile query params + hash.
 * Two URLs that point at the same logical route yield the same key.
 */
export function normalizeRouteUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const kept: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lower = key.toLowerCase();
    if (VOLATILE_QUERY_KEYS.has(lower)) continue;
    if (VOLATILE_QUERY_VALUE_RE.test(value)) continue;
    kept.push([key, value]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const query = kept.length > 0
    ? `?${kept.map(([k, v]) => `${k}=${v}`).join('&')}`
    : '';
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${url.origin}${pathname}${query}`;
}

export function routePathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname || '/';
  } catch {
    return '/';
  }
}
