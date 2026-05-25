/**
 * Rewrite the captured bootstrap HTML so every script/style/asset reference
 * points at a locally-served copy, and inject the boot shim as the FIRST node
 * in <head> so it runs before the app's own bundle.
 *
 * The captured ClickUp document carries `<base href="https://app-cdn.clickup.com/">`
 * and RELATIVE script/link srcs (e.g. `polyfills-M7D5VYFE.js`). Those resolve
 * against the base, so we:
 *   1. Read the document's effective base (its `<base href>`, else the doc URL).
 *   2. Resolve every ref to an absolute URL against that base.
 *   3. Map the absolute URL to its local served path via the asset map.
 *   4. Rewrite `<base href>` to "/" so any runtime-relative refs the bundle
 *      builds still hit the local origin (the Service Worker then serves them).
 *
 * The app's `<script>` tags are KEPT — the real bundle must execute.
 */

import * as cheerio from 'cheerio';

import { resolveUrl } from '../../../clone/url-map';
import { urlToExtPath } from '../emit-assets-from-crawl';
import type { CloneAssetMap } from '../../shared';

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

type RewriteArgs = {
  html: string;
  documentUrl: string;
  assetMap: CloneAssetMap;
  /** Inline JS injected as the first <head> child, before the app bundle. */
  bootShimJs: string;
};

export type RewriteResult = {
  html: string;
  /** Count of element references rewritten to local paths. */
  rewritten: number;
};

function effectiveBase($: cheerio.CheerioAPI, documentUrl: string): string {
  const baseHref = $('base[href]').first().attr('href');
  if (baseHref) {
    const abs = resolveUrl(documentUrl, baseHref);
    if (abs) return abs;
  }
  return documentUrl;
}

/** Resolve a raw ref against base, then map to local served path, or null. */
function localFor(
  raw: string,
  base: string,
  assetMap: CloneAssetMap,
): string | null {
  const abs = resolveUrl(base, raw);
  if (!abs) return null;
  const served = assetMap.servedPaths.get(abs);
  if (served) return served;
  // Fall back to content-hashed basename match (handles query-disambiguated URLs).
  const lastSeg = abs.split(/[?#]/)[0].split('/').pop() ?? '';
  return assetMap.byBasename.get(lastSeg) ?? null;
}

function rewriteAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string,
  base: string,
  assetMap: CloneAssetMap,
): number {
  let count = 0;
  $(selector).each((_i, el) => {
    const node = $(el);
    const raw = node.attr(attr);
    if (!raw) return;
    const local = localFor(raw, base, assetMap);
    if (local) {
      node.attr(attr, local);
      count++;
    }
  });
  return count;
}

function rewriteSrcset(
  $: cheerio.CheerioAPI,
  base: string,
  assetMap: CloneAssetMap,
): number {
  let count = 0;
  $('img[srcset], source[srcset]').each((_i, el) => {
    const node = $(el);
    const raw = node.attr('srcset');
    if (!raw) return;
    const rewritten = raw
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        const [url, descriptor] = trimmed.split(/\s+/, 2);
        const local = localFor(url, base, assetMap);
        if (!local) return trimmed;
        count++;
        return descriptor ? `${local} ${descriptor}` : local;
      })
      .join(', ');
    node.attr('srcset', rewritten);
  });
  return count;
}

function rewriteInlineStyleUrls(
  css: string,
  base: string,
  assetMap: CloneAssetMap,
): { css: string; count: number } {
  let count = 0;
  const out = css.replace(URL_FUNC_RE, (match, quote: string, inner: string) => {
    const local = localFor(inner, base, assetMap);
    if (!local) return match;
    count++;
    const q = quote || '"';
    return `url(${q}${local}${q})`;
  });
  return { css: out, count };
}

type ImportMap = {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
};

/**
 * Map an import-map spec (key or value) to the local path the bundle will
 * actually resolve to. The map originally lived at the CDN base, so each spec
 * resolves against that base to an absolute CDN URL. Prefer the real localized
 * file from the asset map (the hashed value chunk is captured); fall back to the
 * deterministic `_ext` path so unhashed KEYS — which were never fetched as files
 * — still match where the bundle resolves them (`./main13.js` ->
 * `/_ext/app-cdn.clickup.com/main13.js`).
 */
function specToLocal(
  spec: string,
  base: string,
  assetMap: CloneAssetMap,
): string | null {
  const abs = resolveUrl(base, spec);
  if (!abs) return null;
  const served = assetMap.servedPaths.get(abs);
  if (served) return served;
  const ext = urlToExtPath(abs);
  return ext ? `/${ext}` : null;
}

function rewriteSpecMap(
  specs: Record<string, string>,
  base: string,
  assetMap: CloneAssetMap,
): { out: Record<string, string>; count: number } {
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(specs)) {
    const localKey = specToLocal(key, base, assetMap) ?? key;
    const localValue = specToLocal(value, base, assetMap) ?? value;
    out[localKey] = localValue;
    if (localKey !== key || localValue !== value) count++;
  }
  return { out, count };
}

/**
 * Rewrite every `<script type="importmap">` so its keys AND values are absolute
 * local `/_ext/...` paths. The bundle's bare-ish specifiers (`./main13.js`)
 * resolve against the bundle's own `_ext` URL; the rewritten keys are made to
 * match those resolved paths so the hashed real chunk loads instead of an empty
 * stub. Handles both `imports` and `scopes`.
 */
function rewriteImportMaps(
  $: cheerio.CheerioAPI,
  base: string,
  assetMap: CloneAssetMap,
): number {
  let count = 0;
  $('script[type="importmap"]').each((_i, el) => {
    const node = $(el);
    const raw = node.html();
    if (!raw || raw.trim().length === 0) return;

    let parsed: ImportMap;
    try {
      parsed = JSON.parse(raw) as ImportMap;
    } catch {
      return;
    }

    const next: ImportMap = {};
    if (parsed.imports) {
      const { out, count: c } = rewriteSpecMap(parsed.imports, base, assetMap);
      next.imports = out;
      count += c;
    }
    if (parsed.scopes) {
      const scopes: Record<string, Record<string, string>> = {};
      for (const [scopeKey, specs] of Object.entries(parsed.scopes)) {
        const localScope = specToLocal(scopeKey, base, assetMap) ?? scopeKey;
        const { out, count: c } = rewriteSpecMap(specs, base, assetMap);
        scopes[localScope] = out;
        count += c;
      }
      next.scopes = scopes;
    }

    node.text(JSON.stringify(next));
  });
  return count;
}

export function rewriteBootstrapHtml(args: RewriteArgs): RewriteResult {
  const { html, documentUrl, assetMap, bootShimJs } = args;
  const $ = cheerio.load(html, null, true);

  const base = effectiveBase($, documentUrl);
  let rewritten = 0;

  rewritten += rewriteAttr($, 'script[src]', 'src', base, assetMap);
  rewritten += rewriteAttr($, 'link[href]', 'href', base, assetMap);
  rewritten += rewriteAttr($, 'img[src]', 'src', base, assetMap);
  rewritten += rewriteAttr($, 'source[src]', 'src', base, assetMap);
  rewritten += rewriteAttr($, 'video[src]', 'src', base, assetMap);
  rewritten += rewriteAttr($, 'audio[src]', 'src', base, assetMap);
  rewritten += rewriteSrcset($, base, assetMap);

  // Import maps map unhashed module specifiers to hashed chunk files. Resolve
  // both sides against the CDN base and rewrite to local _ext paths so the
  // bundle's `import "./mainNN.js"` loads the real hashed chunk, not a stub.
  rewritten += rewriteImportMaps($, base, assetMap);

  // Inline style="" url() refs.
  $('[style]').each((_i, el) => {
    const node = $(el);
    const raw = node.attr('style');
    if (!raw || !raw.includes('url(')) return;
    const { css, count } = rewriteInlineStyleUrls(raw, base, assetMap);
    if (count > 0) {
      node.attr('style', css);
      rewritten += count;
    }
  });

  // Inline <style> blocks.
  $('style').each((_i, el) => {
    const node = $(el);
    const raw = node.html();
    if (!raw || !raw.includes('url(')) return;
    const { css, count } = rewriteInlineStyleUrls(raw, base, assetMap);
    if (count > 0) {
      node.text(css);
      rewritten += count;
    }
  });

  // Neutralize integrity / crossorigin so locally-served copies are not blocked.
  $('[integrity]').removeAttr('integrity');
  $('[crossorigin]').removeAttr('crossorigin');

  // Strip any CSP meta tag so inline boot shim + local assets are not blocked.
  $('meta[http-equiv]').each((_i, el) => {
    const equiv = ($(el).attr('http-equiv') ?? '').toLowerCase();
    if (equiv === 'content-security-policy') $(el).remove();
  });

  // Rewrite <base> to local origin root so runtime-relative refs hit the SW.
  const baseEl = $('base[href]').first();
  if (baseEl.length > 0) {
    baseEl.attr('href', '/');
  } else {
    $('head').prepend('<base href="/">');
  }

  // Inject the boot shim as the FIRST executable node in <head>, after <base>
  // so document.baseURI is already local when the shim runs.
  const shimTag = `<script data-replay-boot>\n${bootShimJs}\n</script>`;
  const headBase = $('head base').first();
  if (headBase.length > 0) {
    headBase.after(shimTag);
  } else {
    $('head').prepend(shimTag);
  }

  return { html: $.html(), rewritten };
}
