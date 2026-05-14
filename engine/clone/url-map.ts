/**
 * URL map builder and resolver.
 *
 * Builds a Map<originalAbsoluteUrl, UrlMapEntry> from parsed indexes,
 * and exposes resolveUrl(base, raw) which returns the absolute URL
 * to look up in the map, or null for unrewritable values.
 *
 * Local paths under clone/ mirror the original URL pathname so that
 * hard-coded references inside minified JS keep working.
 */

import { createHash } from 'node:crypto';
import { posix as pathPosix } from 'node:path';
import type { ParsedIndexEntry, UrlMap, AssetBucket } from './types';

const SKIP_SCHEMES = ['data:', 'blob:', 'javascript:', 'mailto:', 'tel:', 'about:'];

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 6);
}

function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, '');
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._\-+~@]/g, '_');
}

function sanitizePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => (seg === '' ? '' : sanitizeSegment(seg)))
    .join('/');
}

function appendQueryHash(localPath: string, query: string): string {
  if (!query) return localPath;
  const tag = shortHash(query);
  const dir = pathPosix.dirname(localPath);
  const ext = pathPosix.extname(localPath);
  const base = pathPosix.basename(localPath, ext);
  const fileName = `${base}-${tag}${ext}`;
  return dir === '.' || dir === '' ? fileName : pathPosix.join(dir, fileName);
}

function indexFallback(localPath: string): string {
  if (!localPath || localPath.endsWith('/')) {
    return `${localPath}index`;
  }
  return localPath;
}

/**
 * Convert an absolute URL into the relative path it should occupy inside clone/.
 *
 * Same host as the document → "<pathname>".
 * Different host → "_external/<host>/<pathname>".
 * Query string is stripped from the filename; if present, a short stable hash is
 * appended to the basename so two URLs that differ only by query stay distinct.
 *
 * Returns null for unsupported schemes or unparseable input.
 */
export function urlToLocalPath(
  absoluteUrl: string,
  originalDocumentUrl: string
): string | null {
  if (!absoluteUrl) return null;
  const lower = absoluteUrl.toLowerCase().trim();
  for (const scheme of SKIP_SCHEMES) {
    if (lower.startsWith(scheme)) return null;
  }

  let u: URL;
  let docU: URL;
  try {
    u = new URL(absoluteUrl);
    docU = new URL(originalDocumentUrl);
  } catch {
    return null;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const sameHost = u.host === docU.host;
  const sanitizedPath = sanitizePathname(u.pathname);
  let local = stripLeadingSlash(sanitizedPath);
  local = indexFallback(local);

  if (!sameHost) {
    const hostSeg = sanitizeSegment(u.host);
    local = pathPosix.join('_external', hostSeg, local);
  }

  if (u.search) {
    local = appendQueryHash(local, u.search);
  }

  return local;
}

export function buildUrlMap(args: {
  documentUrl: string;
  styles: ParsedIndexEntry[];
  scripts: ParsedIndexEntry[];
  assets: ParsedIndexEntry[];
}): UrlMap {
  if (!args.documentUrl) {
    throw new Error('buildUrlMap requires a documentUrl');
  }

  const map: UrlMap = new Map();

  map.set(args.documentUrl, {
    bucket: 'document',
    sourceFile: '',
    cloneRelPath: 'index.html',
    mimeType: 'text/html',
  });

  const usedPaths = new Set<string>(['index.html']);

  const addAll = (rows: ParsedIndexEntry[], bucket: AssetBucket): void => {
    for (const row of rows) {
      if (!row.url) continue;
      if (map.has(row.url)) continue;
      const local = urlToLocalPath(row.url, args.documentUrl);
      if (!local) continue;

      let finalPath = local;
      if (usedPaths.has(finalPath)) {
        const tag = shortHash(row.url);
        const dir = pathPosix.dirname(finalPath);
        const ext = pathPosix.extname(finalPath);
        const base = pathPosix.basename(finalPath, ext);
        const fileName = `${base}-${tag}${ext}`;
        finalPath = dir === '.' || dir === '' ? fileName : pathPosix.join(dir, fileName);
      }
      usedPaths.add(finalPath);

      map.set(row.url, {
        bucket,
        sourceFile: row.file,
        cloneRelPath: finalPath,
        mimeType: row.mimeType,
      });
    }
  };

  addAll(args.styles, 'styles');
  addAll(args.scripts, 'scripts');
  addAll(args.assets, 'assets');

  return map;
}

/**
 * Resolve a raw href/src against a base URL.
 * Returns absolute URL string for lookup, or null to leave the value alone.
 *
 * Skip rules:
 *   - empty / whitespace
 *   - hash-only (#foo)
 *   - data:, blob:, javascript:, mailto:, tel:, about: schemes
 */
export function resolveUrl(base: string, raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;
  const lower = trimmed.toLowerCase();
  for (const scheme of SKIP_SCHEMES) {
    if (lower.startsWith(scheme)) return null;
  }
  try {
    const abs = new URL(trimmed, base).toString();
    return abs;
  } catch {
    return null;
  }
}

/**
 * Compute "./" or "../" relative path from one clone-relative file to another.
 * Always uses POSIX separators. Always prefixed with "./" or "../".
 */
export function relativeFromClonePath(fromRel: string, toRel: string): string {
  const fromDir = pathPosix.dirname(fromRel);
  const rel = pathPosix.relative(fromDir, toRel);
  if (!rel) return `./${pathPosix.basename(toRel)}`;
  if (rel.startsWith('.')) return rel;
  return `./${rel}`;
}

export const __testing = { shortHash, sanitizePathname, urlToLocalPath };
