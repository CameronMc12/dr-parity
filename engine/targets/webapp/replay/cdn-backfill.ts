/**
 * Build-time CDN backfill for the replay target.
 *
 * The recorded crawl misses early render-blocking requests (e.g. the global
 * stylesheet `/styles-MKJ24DPC.css`, lazy `/assets/...` images and webm files).
 * Those references survive in the bootstrap HTML but 404 at runtime, so the
 * app boots UNSTYLED. ClickUp's static assets are PUBLIC on the CDN, so this
 * pass scans the bootstrap HTML for ClickUp-host references that were NOT
 * localized, fetches them live, writes them into the SAME `_ext/<host>/...`
 * layout, and extends the asset map so the existing bootstrap rewriter points
 * the references at the localized copies.
 *
 * It is strictly additive and best-effort: a non-200 or a fetch error logs a
 * warning and continues; the build never fails on a missed asset. Only first-
 * party hosts are backfilled (clickup.com, app-cdn.clickup.com, pages.clickup.com);
 * third-party hosts (segment, googletagmanager, …) are left as online refs.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import * as cheerio from 'cheerio';

import { resolveUrl } from '../../../clone/url-map';
import { urlToExtPath } from '../emit-assets-from-crawl';
import type { CloneAssetMap } from '../../shared';

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_RE = /@import\s+(?:url\(\s*)?(['"]?)([^'")]+)\1/g;
const HASHED_BASENAME_RE = /-[A-Za-z0-9]{6,}\.[a-z0-9]+$/;
const CSS_EXT_RE = /\.css(\?|#|$)/i;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CDN_FALLBACK_HOST = 'app-cdn.clickup.com';

/** Only these hosts (and subdomains) are backfilled from the live CDN. */
const FIRST_PARTY_HOSTS = ['clickup.com'];

/** Max fetch attempts per asset before giving up (1 try + 3 retries). */
const MAX_FETCH_ATTEMPTS = 4;
/** Base delay for exponential backoff between retries, in milliseconds. */
const RETRY_BASE_DELAY_MS = 300;

export type BackfillResult = {
  /** Count of references backfilled (written to disk + added to the map). */
  backfilled: number;
  /** Count of references that were missing but could not be fetched. */
  failed: number;
  /**
   * CRITICAL first-party assets (bootstrap stylesheet / script / importmap
   * target) that could NOT be fetched after all retries. A non-empty list means
   * the replay will boot UNSTYLED or BROKEN — the build must surface this loudly
   * so a flaky fetch is never silently shipped.
   */
  criticalFailures: string[];
  /** Warning lines for the build summary. */
  warnings: string[];
};

function isFirstPartyHost(host: string): boolean {
  const h = host.toLowerCase();
  return FIRST_PARTY_HOSTS.some((base) => h === base || h.endsWith(`.${base}`));
}

/** True when the absolute URL is already localized in the asset map. */
function isLocalized(absUrl: string, assetMap: CloneAssetMap): boolean {
  if (assetMap.servedPaths.has(absUrl)) return true;
  const lastSeg = absUrl.split(/[?#]/)[0].split('/').pop() ?? '';
  return assetMap.byBasename.has(lastSeg);
}

function effectiveBase($: cheerio.CheerioAPI, documentUrl: string): string {
  const baseHref = $('base[href]').first().attr('href');
  if (baseHref) {
    const abs = resolveUrl(documentUrl, baseHref);
    if (abs) return abs;
  }
  return documentUrl;
}

/** Origin (scheme + host) of an absolute URL, or null. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Collect every static reference in the bootstrap HTML that is NOT yet
 * localized: stylesheet/script srcs, importmap targets, and root-relative
 * /assets/* and /styles-* refs. Returns absolute URLs against the doc base,
 * plus the subset that is CRITICAL (render-blocking bootstrap stylesheet /
 * script / importmap target — a miss here breaks the whole replay).
 */
function collectMissingFromHtml(
  $: cheerio.CheerioAPI,
  base: string,
  docOrigin: string,
  assetMap: CloneAssetMap,
): { missing: Set<string>; critical: Set<string> } {
  const missing = new Set<string>();
  const critical = new Set<string>();

  const consider = (raw: string | undefined, against: string, isCritical: boolean): void => {
    if (!raw) return;
    const abs = resolveUrl(against, raw);
    if (!abs) return;
    if (isLocalized(abs, assetMap)) return;
    const host = originOf(abs);
    if (!host) return;
    try {
      if (!isFirstPartyHost(new URL(abs).hostname)) return;
    } catch {
      return;
    }
    missing.add(abs);
    if (isCritical) critical.add(abs);
  };

  // Stylesheets and module scripts are render-blocking: a miss boots UNSTYLED.
  $('link[rel~="stylesheet"][href]').each((_i, el) => consider($(el).attr('href'), base, true));
  $('link[rel="preload"][href], link[rel="modulepreload"][href]').each((_i, el) =>
    consider($(el).attr('href'), base, false),
  );
  $('script[src]').each((_i, el) => consider($(el).attr('src'), base, true));

  $('script[type="importmap"]').each((_i, el) => {
    const raw = $(el).html();
    if (!raw || raw.trim().length === 0) return;
    let parsed: { imports?: Record<string, string>; scopes?: Record<string, Record<string, string>> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const values: string[] = [];
    if (parsed.imports) values.push(...Object.values(parsed.imports));
    if (parsed.scopes) {
      for (const specs of Object.values(parsed.scopes)) values.push(...Object.values(specs));
    }
    for (const value of values) consider(value, base, true);
  });

  // Root-relative /assets/* and /styles-* refs resolve against the doc origin,
  // not the (CDN) base — they were served from the app host. The global
  // stylesheet (/styles-*.css) is critical; bare /assets/* media is not.
  const rootRelative = new Set<string>();
  $('[href], [src]').each((_i, el) => {
    const node = $(el);
    for (const attr of ['href', 'src']) {
      const v = node.attr(attr);
      if (v && (v.startsWith('/assets/') || v.startsWith('/styles-'))) rootRelative.add(v);
    }
  });
  for (const raw of rootRelative) consider(raw, docOrigin, raw.startsWith('/styles-'));

  return { missing, critical };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Single fetch attempt with a browser UA, returning the body bytes or null. */
async function fetchOnce(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': BROWSER_UA, accept: '*/*' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Fetch a URL with exponential backoff. A transient network error or a flaky
 * 5xx that previously slipped through (silently breaking styling) is now
 * retried up to MAX_FETCH_ATTEMPTS times before giving up.
 */
async function fetchBody(url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    const body = await fetchOnce(url);
    if (body) return body;
    if (attempt < MAX_FETCH_ATTEMPTS - 1) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return null;
}

/**
 * Fetch a first-party asset, trying the original origin first, then the CDN
 * fallback host (root-relative ClickUp refs are served from both). Each host is
 * retried with backoff via fetchBody. Returns the body or null.
 */
async function fetchFirstParty(absUrl: string): Promise<Uint8Array | null> {
  const direct = await fetchBody(absUrl);
  if (direct) return direct;

  try {
    const u = new URL(absUrl);
    if (u.hostname.toLowerCase() === CDN_FALLBACK_HOST) return null;
    u.hostname = CDN_FALLBACK_HOST;
    return await fetchBody(u.toString());
  } catch {
    return null;
  }
}

/** Add a backfilled asset to the map under its absolute URL + hashed basename. */
function addToMap(absUrl: string, servedPath: string, assetMap: CloneAssetMap): void {
  if (!assetMap.servedPaths.has(absUrl)) assetMap.servedPaths.set(absUrl, servedPath);
  const base = servedPath.split(/[?#]/)[0].split('/').pop() ?? '';
  if (HASHED_BASENAME_RE.test(base) && !assetMap.byBasename.has(base)) {
    assetMap.byBasename.set(base, servedPath);
  }
}

/** Extract url()/@import refs from a CSS body, resolved against its own URL. */
function cssRefs(css: string, cssAbsUrl: string): string[] {
  const out = new Set<string>();
  const push = (raw: string): void => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:')) return;
    const abs = resolveUrl(cssAbsUrl, trimmed);
    if (abs) out.add(abs);
  };
  let m: RegExpExecArray | null;
  while ((m = URL_FUNC_RE.exec(css)) !== null) push(m[2]);
  while ((m = AT_IMPORT_RE.exec(css)) !== null) push(m[2]);
  return [...out];
}

/** Rewrite url()/@import in a CSS body to localized served paths via the map. */
function rewriteCssRefs(css: string, cssAbsUrl: string, assetMap: CloneAssetMap): string {
  const lookup = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:')) return null;
    const abs = resolveUrl(cssAbsUrl, trimmed);
    if (!abs) return null;
    if (assetMap.servedPaths.has(abs)) return assetMap.servedPaths.get(abs) ?? null;
    const lastSeg = abs.split(/[?#]/)[0].split('/').pop() ?? '';
    return assetMap.byBasename.get(lastSeg) ?? null;
  };
  const withUrls = css.replace(URL_FUNC_RE, (match, quote: string, inner: string) => {
    const local = lookup(inner);
    if (!local) return match;
    const q = quote || '"';
    return `url(${q}${local}${q})`;
  });
  return withUrls.replace(AT_IMPORT_RE, (match, quote: string, inner: string) => {
    const local = lookup(inner);
    if (!local) return match;
    return `@import ${quote || '"'}${local}${quote || '"'}`;
  });
}

type WrittenAsset = { absUrl: string; servedPath: string; absPath: string; isCss: boolean };

/**
 * Fetch one missing URL and write it into `_ext/<host>/...`. On success, adds it
 * to the map and returns the written record; on failure returns null.
 */
async function backfillOne(
  absUrl: string,
  outDir: string,
  assetMap: CloneAssetMap,
): Promise<WrittenAsset | null> {
  const relPath = urlToExtPath(absUrl);
  if (!relPath) return null;

  const body = await fetchFirstParty(absUrl);
  if (!body) return null;

  const absPath = join(outDir, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, body);

  const servedPath = `/${relPath}`;
  addToMap(absUrl, servedPath, assetMap);
  const isCss = CSS_EXT_RE.test(absUrl);
  return { absUrl, servedPath, absPath, isCss };
}

/**
 * Scan the bootstrap HTML for first-party static references missing from the
 * asset map, fetch them live, write them into `_ext/<host>/...`, and extend the
 * map so the bootstrap rewriter localizes them. Recurses one level into any
 * backfilled CSS so fonts/images the global CSS pulls in are backfilled too.
 *
 * Mutates `assetMap` in place. Returns counts + warnings for the build summary.
 */
export async function backfillFromCdn(args: {
  html: string;
  documentUrl: string;
  outDir: string;
  assetMap: CloneAssetMap;
}): Promise<BackfillResult> {
  const { html, documentUrl, outDir, assetMap } = args;
  const $ = cheerio.load(html, null, true);

  const base = effectiveBase($, documentUrl);
  const docOrigin = originOf(documentUrl) ?? originOf(base) ?? '';

  const { missing, critical } = collectMissingFromHtml($, base, docOrigin, assetMap);

  const warnings: string[] = [];
  const criticalFailures: string[] = [];
  let backfilled = 0;
  let failed = 0;
  const writtenCss: WrittenAsset[] = [];
  const processed = new Set<string>();

  for (const absUrl of missing) {
    if (processed.has(absUrl)) continue;
    processed.add(absUrl);
    const written = await backfillOne(absUrl, outDir, assetMap);
    if (!written) {
      failed++;
      if (critical.has(absUrl)) {
        criticalFailures.push(absUrl);
        warnings.push(
          `CRITICAL CDN backfill failed after ${MAX_FETCH_ATTEMPTS} attempts (replay will boot BROKEN): ${absUrl}`,
        );
      } else {
        warnings.push(`CDN backfill failed: ${absUrl}`);
      }
      continue;
    }
    backfilled++;
    if (written.isCss) writtenCss.push(written);
  }

  // One level deep: backfill assets the freshly-localized CSS references, then
  // rewrite the CSS so those url()/@import refs point at the localized copies.
  for (const css of writtenCss) {
    let body: string;
    try {
      body = readFileSync(css.absPath, 'utf8');
    } catch {
      continue;
    }
    for (const refAbs of cssRefs(body, css.absUrl)) {
      if (processed.has(refAbs)) continue;
      processed.add(refAbs);
      if (isLocalized(refAbs, assetMap)) continue;
      let host: string;
      try {
        host = new URL(refAbs).hostname;
      } catch {
        continue;
      }
      if (!isFirstPartyHost(host)) continue;
      const written = await backfillOne(refAbs, outDir, assetMap);
      if (written) {
        backfilled++;
      } else {
        failed++;
        warnings.push(`CDN backfill failed (from CSS): ${refAbs}`);
      }
    }
    const rewritten = rewriteCssRefs(body, css.absUrl, assetMap);
    if (rewritten !== body) writeFileSync(css.absPath, rewritten, 'utf8');
  }

  if (criticalFailures.length > 0) {
    console.error(
      `\n[cdn-backfill] ${criticalFailures.length} CRITICAL first-party asset(s) could not be fetched ` +
        `after ${MAX_FETCH_ATTEMPTS} attempts. The replay will boot BROKEN:`,
    );
    for (const url of criticalFailures) console.error(`  - ${url}`);
    console.error('');
  }

  return { backfilled, failed, criticalFailures, warnings };
}
