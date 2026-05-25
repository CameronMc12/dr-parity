/**
 * Localize EVERY static asset captured across the whole crawl into the webapp
 * target's `public/` directory.
 *
 * The webapp build copies assets out of a single `--clone-dir` (one viewport of
 * one route, captured via HAR). That clone is complete but narrow: routes other
 * than the captured one reference CSS/JS/fonts/SVGs the clone never saw, so they
 * 404 at runtime. The crawl's `network.jsonl` carries responses for EVERY route
 * the crawler walked, so it is the superset source of truth for cross-route
 * coverage.
 *
 * Constraints discovered in the capture format:
 *   - Bodies are stored as already-DECODED payloads (Playwright stripped the
 *     `content-encoding`), so we write them verbatim. We never re-decode br/gzip.
 *   - The crawler tags each body with `bodyEncoding`: `'base64'` for binary
 *     assets (fonts/images/wasm) and `'utf8'` for text assets (css/js/svg/html).
 *     Absent => `'utf8'` (legacy captures). Binary bodies are decoded from
 *     base64 into a Buffer and written byte-exact; text bodies are written as
 *     UTF-8 strings.
 *   - Static asset bodies are captured COMPLETE (no truncation), so the crawl is
 *     now a full superset source for cross-route coverage including binaries.
 *   - Legacy captures may still carry truncated text bodies (a body at the old
 *     50KB cap). We skip those so we never write a corrupt CSS/JS file.
 *
 * Output scheme: `public/_ext/<host>/<sanitized-pathname>` (query disambiguated
 * by a short hash), served at `/_ext/<host>/<sanitized-pathname>`. The clone-dir
 * copy uses `/_external/...` and `/media/...`, so the namespaces never collide
 * and the clone-dir always wins on conflict (it is written first into the map).
 *
 * The file is large (hundreds of MB), so it is read with a streaming line
 * splitter rather than `readFileSync`.
 */

import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { posix as pathPosix } from 'node:path';

import { resolveUrl } from '../../clone/url-map';
import type { CloneAssetMap } from '../shared';

/** Legacy crawler hard-capped text response bodies at this many characters. */
const LEGACY_TRUNCATION_CAP = 50000;

const STATIC_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.mjs',
  '.cjs',
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

const STATIC_CONTENT_TYPE_EXACT = new Set([
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/wasm',
  'image/svg+xml',
]);

const STATIC_CONTENT_TYPE_PREFIXES = ['font/', 'image/'];

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_BARE_RE = /@import\s+(['"])([^'"]+)\1/g;
const HASHED_BASENAME_RE = /-[A-Za-z0-9]{6,}\.[a-z0-9]+$/;

interface RawResponseLine {
  kind?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | null;
  bodyEncoding?: 'utf8' | 'base64';
}

export interface CrawlAssetResult {
  /** Absolute original URL -> local served path (leading-slash). */
  servedPaths: Map<string, string>;
  /** Content-hashed basename -> served path (single-mapping only). */
  byBasename: Map<string, string>;
  /** Count of asset files written to public/. */
  written: number;
  /** Bodies skipped because they hit the truncation cap. */
  truncatedSkipped: number;
  /** Static responses skipped because they carried no body (images/fonts). */
  noBodySkipped: number;
  /** Root directory the assets were written under (for reporting). */
  outRoot: string;
}

function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string {
  if (!headers) return '';
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value ?? '';
  }
  return '';
}

function contentTypeOf(headers: Record<string, string> | undefined): string {
  return headerValue(headers, 'content-type').split(';')[0].trim().toLowerCase();
}

function extOf(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/)[0];
  }
  const lastSeg = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = lastSeg.lastIndexOf('.');
  return dot < 0 ? '' : lastSeg.slice(dot).toLowerCase();
}

function isStaticAsset(contentType: string, url: string): boolean {
  if (STATIC_CONTENT_TYPE_EXACT.has(contentType)) return true;
  if (STATIC_CONTENT_TYPE_PREFIXES.some((p) => contentType.startsWith(p))) return true;
  return STATIC_EXTENSIONS.has(extOf(url));
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 6);
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._\-+~@]/g, '_');
}

/** Map an absolute URL to its clone-relative path under `_ext/<host>/...`. */
export function urlToExtPath(absoluteUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(absoluteUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = sanitizeSegment(u.host);
  let pathname = u.pathname
    .split('/')
    .map((seg) => (seg === '' ? '' : sanitizeSegment(seg)))
    .join('/')
    .replace(/^\/+/, '');
  if (!pathname || pathname.endsWith('/')) pathname = `${pathname}index`;

  let local = pathPosix.join('_ext', host, pathname);
  if (u.search) {
    const tag = shortHash(u.search);
    const dir = pathPosix.dirname(local);
    const ext = pathPosix.extname(local);
    const base = pathPosix.basename(local, ext);
    local = pathPosix.join(dir, `${base}-${tag}${ext}`);
  }
  return local;
}

function basenameOf(servedOrUrl: string): string {
  const noQuery = servedOrUrl.split(/[?#]/)[0];
  const segs = noQuery.split('/');
  return segs[segs.length - 1] ?? '';
}

/**
 * Rewrite `url(...)` / `@import` inside a crawl CSS body so font and background
 * references point at the crawl-localized copies. `lookup` resolves a raw ref
 * against the CSS's own absolute URL, then into the served map.
 */
function rewriteCssUrls(
  css: string,
  cssAbsUrl: string,
  servedPaths: Map<string, string>,
): string {
  const lookup = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:')) return null;
    const abs = resolveUrl(cssAbsUrl, trimmed);
    if (!abs) return null;
    return servedPaths.get(abs) ?? null;
  };

  const withUrls = css.replace(URL_FUNC_RE, (match, quote: string, inner: string) => {
    const replaced = lookup(inner);
    if (!replaced) return match;
    const q = quote || '"';
    return `url(${q}${replaced}${q})`;
  });
  return withUrls.replace(AT_IMPORT_BARE_RE, (match, quote: string, inner: string) => {
    const replaced = lookup(inner);
    if (!replaced) return match;
    return `@import ${quote}${replaced}${quote}`;
  });
}

/**
 * Stream the crawl `network.jsonl`, write every complete static-asset body into
 * `publicDir/_ext/...`, and return the URL->servedPath map. Bodies already
 * present in `existingUrls` (the clone-dir map) are skipped so the complete
 * clone copy always wins.
 */
export async function emitAssetsFromCrawl(args: {
  crawlDir: string;
  publicDir: string;
  existingUrls: ReadonlySet<string>;
}): Promise<CrawlAssetResult> {
  const { crawlDir, publicDir, existingUrls } = args;
  const networkPath = join(crawlDir, 'network.jsonl');

  const servedPaths = new Map<string, string>();
  const cssJobs: { absPath: string; absUrl: string }[] = [];
  const seen = new Set<string>();
  let written = 0;
  let truncatedSkipped = 0;
  let noBodySkipped = 0;

  const stream = createReadStream(networkPath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let record: RawResponseLine;
    try {
      record = JSON.parse(trimmed) as RawResponseLine;
    } catch {
      continue;
    }
    if (record.kind !== 'response') continue;

    const url = record.url ?? '';
    if (!url || seen.has(url)) continue;

    const contentType = contentTypeOf(record.headers);
    if (!isStaticAsset(contentType, url)) continue;

    seen.add(url);
    if (existingUrls.has(url)) continue;

    const body = record.body;
    if (body == null) {
      noBodySkipped++;
      continue;
    }

    const encoding = record.bodyEncoding ?? 'utf8';
    const isBinary = encoding === 'base64';

    // Legacy text captures may be truncated at the old cap; skip to avoid
    // writing a corrupt CSS/JS file. Binary base64 bodies are never truncated.
    if (!isBinary && body.length >= LEGACY_TRUNCATION_CAP) {
      truncatedSkipped++;
      continue;
    }

    const relPath = urlToExtPath(url);
    if (!relPath) continue;

    const servedPath = `/${relPath}`;
    const absPath = join(publicDir, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    if (isBinary) {
      writeFileSync(absPath, Buffer.from(body, 'base64'));
    } else {
      writeFileSync(absPath, body, 'utf8');
    }
    written++;
    servedPaths.set(url, servedPath);

    if (!isBinary && (contentType === 'text/css' || extOf(url) === '.css')) {
      cssJobs.push({ absPath, absUrl: url });
    }
  }

  // Second pass: rewrite url()/@import inside the localized CSS now that the
  // full served map is known (a CSS file may reference fonts written later).
  for (const job of cssJobs) {
    const original = readFileSafe(job.absPath);
    if (original === null) continue;
    const rewritten = rewriteCssUrls(original, job.absUrl, servedPaths);
    if (rewritten !== original) writeFileSync(job.absPath, rewritten, 'utf8');
  }

  const byBasename = buildBasenameIndex(servedPaths);

  return {
    servedPaths,
    byBasename,
    written,
    truncatedSkipped,
    noBodySkipped,
    outRoot: join(publicDir, '_ext'),
  };
}

function readFileSafe(absPath: string): string | null {
  try {
    return readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function buildBasenameIndex(servedPaths: Map<string, string>): Map<string, string> {
  const counts = new Map<string, number>();
  const first = new Map<string, string>();
  for (const served of servedPaths.values()) {
    const base = basenameOf(served);
    if (!HASHED_BASENAME_RE.test(base)) continue;
    counts.set(base, (counts.get(base) ?? 0) + 1);
    if (!first.has(base)) first.set(base, served);
  }
  const byBasename = new Map<string, string>();
  for (const [base, count] of counts) {
    if (count === 1) byBasename.set(base, first.get(base) as string);
  }
  return byBasename;
}

/**
 * Merge crawl-localized assets into an existing clone asset map. Clone entries
 * WIN: an absolute URL or basename already in the clone map is never
 * overwritten by a (possibly thinner) crawl copy. Mutates and returns `base`.
 * When `base` is null, a fresh map is synthesised from the crawl result so
 * routes still get local rewriting even without a clone parsed dir.
 */
export function mergeCrawlIntoCloneMap(
  base: CloneAssetMap | null,
  crawl: CrawlAssetResult,
  documentUrl: string,
): CloneAssetMap {
  const map: CloneAssetMap = base ?? {
    documentUrl,
    servedPaths: new Map(),
    byBasename: new Map(),
  };

  for (const [url, served] of crawl.servedPaths) {
    if (!map.servedPaths.has(url)) map.servedPaths.set(url, served);
  }
  for (const [base64, served] of crawl.byBasename) {
    if (!map.byBasename.has(base64)) map.byBasename.set(base64, served);
  }
  return map;
}
