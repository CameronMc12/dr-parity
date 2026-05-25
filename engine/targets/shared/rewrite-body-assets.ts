/**
 * Body asset-URL rewriter for crawl-state DOM.
 *
 * The webapp target composes its page body from crawl-state DOM, whose asset
 * references stay ABSOLUTE (e.g. `https://app-cdn.clickup.com/media/core.css`).
 * Those cross-origin requests fail at runtime even though the same assets are
 * captured locally in the clone. This module rebuilds the SAME url map the
 * clone rewriter used (`buildUrlMap` over the parsed indexes), then rewrites
 * every body reference whose absolute form is in the map to the local served
 * path. References not in the map (uncaptured assets) are left untouched.
 *
 * Served-path scheme: `copyAssetsToPublic` copies the whole clone tree into the
 * target's `public/`, so a clone-relative path like `_external/host/x.js` is
 * served at `/_external/host/x.js`. We therefore map absolute URL → `/` +
 * cloneRelPath.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerioModule from 'cheerio';

import { buildUrlMap, resolveUrl } from '../../clone/url-map';
import type { ParsedIndexEntry } from '../../clone/types';

const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_BARE_RE = /@import\s+(['"])([^'"]+)\1/g;

export interface CloneAssetMap {
  documentUrl: string;
  /** Absolute original URL -> local served path (leading-slash, e.g. "/media/x.css"). */
  servedPaths: Map<string, string>;
  /**
   * Content-hashed basename -> local served path. Captured CDN assets carry
   * unique hashed basenames (e.g. `core-5BSWG2DG.css`), but the DOM often
   * references them via a relative path that resolves to the WRONG host
   * (document host instead of the CDN host), so exact-URL lookup misses. A
   * basename fallback recovers these deterministically. Only basenames that
   * map to exactly one served path are kept — ambiguous ones are dropped.
   */
  byBasename: Map<string, string>;
}

const HASHED_BASENAME_RE = /-[A-Za-z0-9]{6,}\.[a-z0-9]+$/;

function basenameOf(servedOrUrl: string): string {
  const noQuery = servedOrUrl.split(/[?#]/)[0];
  const segs = noQuery.split('/');
  return segs[segs.length - 1] ?? '';
}

function readJsonArray(filePath: string): ParsedIndexEntry[] {
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as ParsedIndexEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Build the absolute-URL -> local-served-path map from a clone's parsed
 * indexes. Returns null when the parsed directory is missing the inputs the
 * clone rewriter relied on (no map can be reconstructed → no rewriting).
 */
export function buildCloneAssetMap(parsedDir: string): CloneAssetMap | null {
  const documentUrlPath = join(parsedDir, 'document.url');
  if (!existsSync(documentUrlPath)) return null;
  const documentUrl = readFileSync(documentUrlPath, 'utf8').trim();
  if (!documentUrl) return null;

  const styles = readJsonArray(join(parsedDir, 'styles', 'index.json'));
  const scripts = readJsonArray(join(parsedDir, 'scripts', 'index.json'));
  const assets = readJsonArray(join(parsedDir, 'assets', 'index.json'));

  const urlMap = buildUrlMap({ documentUrl, styles, scripts, assets });

  const servedPaths = new Map<string, string>();
  const basenameCounts = new Map<string, number>();
  const basenameFirst = new Map<string, string>();
  for (const [url, entry] of urlMap.entries()) {
    if (entry.bucket === 'document') continue;
    const served = `/${entry.cloneRelPath}`;
    servedPaths.set(url, served);

    const base = basenameOf(entry.cloneRelPath);
    if (HASHED_BASENAME_RE.test(base)) {
      basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
      if (!basenameFirst.has(base)) basenameFirst.set(base, served);
    }
  }

  const byBasename = new Map<string, string>();
  for (const [base, count] of basenameCounts) {
    if (count === 1) byBasename.set(base, basenameFirst.get(base) as string);
  }

  return { documentUrl, servedPaths, byBasename };
}

function lookup(map: CloneAssetMap, raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  // Already a local served path — never rewrite again.
  if (trimmed.startsWith('/_external/') || trimmed.startsWith('/media/')) return null;

  const abs = resolveUrl(map.documentUrl, trimmed);
  if (abs) {
    const exact = map.servedPaths.get(abs);
    if (exact) return exact;
  }

  // Fallback: content-hashed basename. Recovers DOM refs that resolve to the
  // wrong host (relative paths against the document host rather than the CDN).
  const base = basenameOf(trimmed);
  if (base && HASHED_BASENAME_RE.test(base)) {
    return map.byBasename.get(base) ?? null;
  }
  return null;
}

function rewriteSrcset(raw: string, map: CloneAssetMap): string {
  return raw
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const segments = trimmed.split(/\s+/);
      const url = segments[0];
      const descriptor = segments.slice(1).join(' ');
      const replaced = lookup(map, url) ?? url;
      return descriptor ? `${replaced} ${descriptor}` : replaced;
    })
    .filter(Boolean)
    .join(', ');
}

function rewriteCssText(css: string, map: CloneAssetMap): string {
  const withUrls = css.replace(URL_FUNC_RE, (match, quote: string, inner: string) => {
    const replaced = lookup(map, inner.trim());
    if (!replaced) return match;
    const q = quote || '"';
    return `url(${q}${replaced}${q})`;
  });
  return withUrls.replace(AT_IMPORT_BARE_RE, (match, quote: string, inner: string) => {
    const replaced = lookup(map, inner.trim());
    if (!replaced) return match;
    return `@import ${quote}${replaced}${quote}`;
  });
}

/**
 * Rewrite every captured asset reference in a body HTML fragment to its local
 * served path. Run this BEFORE htmlToJsx so the emitted JSX carries local
 * paths. References whose absolute form is not in the map are untouched.
 */
export function rewriteBodyAssetUrls(html: string, map: CloneAssetMap): string {
  // The crawl-state DOM is a full document. Load in document mode (matching the
  // webapp build's index.html load) so cheerio round-trips it without mangling.
  const $ = cheerio.load(html, null, true);

  const rewriteAttr = (selector: string, attr: string): void => {
    $(selector).each((_: number, el: any) => {
      const replaced = lookup(map, $(el).attr(attr));
      if (replaced) $(el).attr(attr, replaced);
    });
  };

  rewriteAttr('link[href]', 'href');
  rewriteAttr('script[src]', 'src');
  rewriteAttr('img[src]', 'src');
  rewriteAttr('source[src]', 'src');
  rewriteAttr('video[src]', 'src');
  rewriteAttr('video[poster]', 'poster');
  rewriteAttr('audio[src]', 'src');

  $('img[srcset], source[srcset]').each((_: number, el: any) => {
    const raw = $(el).attr('srcset');
    if (raw) $(el).attr('srcset', rewriteSrcset(raw, map));
  });

  $('[style]').each((_: number, el: any) => {
    const raw = $(el).attr('style');
    if (!raw) return;
    const rewritten = rewriteCssText(raw, map);
    if (rewritten !== raw) $(el).attr('style', rewritten);
  });

  $('style').each((_: number, el: any) => {
    const raw = $(el).html();
    if (!raw) return;
    const rewritten = rewriteCssText(raw, map);
    if (rewritten !== raw) $(el).text(rewritten);
  });

  return $.html();
}
