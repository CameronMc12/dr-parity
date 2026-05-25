/**
 * Predicate that flags a captured request/response as a static asset rather
 * than a real API/data endpoint. Static assets (JS/CSS/font/image/wasm chunks)
 * that an SPA lazy-loads via fetch pollute the mock handlers, fixtures, and
 * API spec, so both emit-mocks and emit-spec drop them before grouping.
 *
 * Default-on. A record is treated as a static asset when EITHER the response
 * content-type is an asset MIME type OR the URL path (ignoring query) ends in
 * a known asset extension.
 */

const STATIC_CONTENT_TYPE_EXACT = new Set([
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/wasm',
  'application/octet-stream',
]);

const STATIC_CONTENT_TYPE_PREFIXES = ['font/', 'image/'];

const STATIC_PATH_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.map',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.ico',
  '.wasm',
]);

function contentTypeOf(headers: Record<string, string> | undefined): string {
  if (!headers) return '';
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      return value.split(';')[0].trim().toLowerCase();
    }
  }
  return '';
}

function isStaticContentType(contentType: string): boolean {
  if (contentType.length === 0) return false;
  if (STATIC_CONTENT_TYPE_EXACT.has(contentType)) return true;
  return STATIC_CONTENT_TYPE_PREFIXES.some((prefix) => contentType.startsWith(prefix));
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

function isStaticPath(url: string): boolean {
  const path = pathnameOf(url);
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex < 0) return false;
  const ext = lastSegment.slice(dotIndex).toLowerCase();
  return STATIC_PATH_EXTENSIONS.has(ext);
}

export function isStaticAssetRequest(args: {
  url: string;
  headers?: Record<string, string>;
}): boolean {
  if (isStaticContentType(contentTypeOf(args.headers))) return true;
  return isStaticPath(args.url);
}
