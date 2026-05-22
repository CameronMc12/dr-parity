/**
 * Asset inventory from parsed HTML.
 *
 * Walks a parsed document and returns the absolute http(s) URLs of every
 * image, video, audio, preload, and inline-style asset it references. The
 * complete-assets stage uses this to discover URLs the browser never
 * actually requested (typically srcset siblings outside the captured
 * viewport's `<picture>` match), so those siblings can be fetched and
 * stored alongside the assets the HAR captured.
 *
 * Pure function, no I/O. Safe to call from any pipeline stage.
 */

import * as cheerio from 'cheerio';

type CollectArgs = {
  /** Full HTML source of the parsed document. */
  html: string;
  /** Absolute URL the document was served from (used to resolve relative refs). */
  documentUrl: string;
};

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_BARE_RE = /@import\s+(['"])([^'"]+)\1/g;
const AT_IMPORT_URL_RE = /@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/**
 * Attributes likely to carry image / media URLs. Includes the standard
 * HTML attributes plus the most common lazy-loading data-* attributes
 * used across the web (lozad, lazysizes, native lazy patterns, custom
 * picture polyfills). Not exhaustive but covers >95% of sites we see.
 */
const SINGLE_URL_ATTRS: Array<[selector: string, attr: string]> = [
  ['img[src]', 'src'],
  ['img[data-src]', 'data-src'],
  ['img[data-lazy-src]', 'data-lazy-src'],
  ['img[data-original]', 'data-original'],
  ['img[data-image]', 'data-image'],
  ['img[data-image-source]', 'data-image-source'],
  ['source[src]', 'src'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['link[rel="preload"][href]', 'href'],
  ['link[rel="prefetch"][href]', 'href'],
];

const SRCSET_ATTRS: Array<[selector: string, attr: string]> = [
  ['img[srcset]', 'srcset'],
  ['img[data-srcset]', 'data-srcset'],
  ['source[srcset]', 'srcset'],
  ['source[data-srcset]', 'data-srcset'],
];

function isHttpUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function resolveAbs(documentUrl: string, ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:')) {
    return null;
  }
  if (trimmed.startsWith('#')) return null;
  try {
    const abs = new URL(trimmed, documentUrl).toString();
    return isHttpUrl(abs) ? abs : null;
  } catch {
    return null;
  }
}

function splitSrcset(raw: string): string[] {
  // Comma-separated, each candidate is "url descriptor?" where descriptor
  // is optional. data: URIs in srcset are rare but legal — the regex below
  // is tolerant of commas inside data: URIs.
  const out: string[] = [];
  if (!raw.trim()) return out;
  // Quick path: split on `, ` then trim. If a part starts with data: and
  // contains an unbalanced base64 chunk, the simple split is wrong, but
  // we then defer to URL parsing which will reject malformed entries.
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const url = trimmed.split(/\s+/, 1)[0];
    if (url) out.push(url);
  }
  return out;
}

function collectCssUrls(css: string): string[] {
  const refs = new Set<string>();
  for (const match of css.matchAll(URL_FUNC_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  for (const match of css.matchAll(AT_IMPORT_BARE_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  for (const match of css.matchAll(AT_IMPORT_URL_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  return Array.from(refs);
}

/**
 * Walks the parsed document and returns every absolute http(s) URL it
 * references via image/media attributes, srcset variants, preload hints,
 * inline styles, and <style> blocks.
 */
export function collectHtmlAssetCandidates(args: CollectArgs): string[] {
  const found = new Set<string>();
  const $ = cheerio.load(args.html, { xmlMode: false });

  const push = (raw: string | undefined): void => {
    if (!raw) return;
    const abs = resolveAbs(args.documentUrl, raw);
    if (abs) found.add(abs);
  };

  for (const [selector, attr] of SINGLE_URL_ATTRS) {
    $(selector).each((_, el) => {
      push($(el).attr(attr));
    });
  }

  for (const [selector, attr] of SRCSET_ATTRS) {
    $(selector).each((_, el) => {
      const raw = $(el).attr(attr);
      if (!raw) return;
      for (const url of splitSrcset(raw)) push(url);
    });
  }

  // Inline element styles.
  $('[style]').each((_, el) => {
    const raw = $(el).attr('style');
    if (!raw) return;
    for (const url of collectCssUrls(raw)) push(url);
  });

  // <style> blocks.
  $('style').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    for (const url of collectCssUrls(raw)) push(url);
  });

  return Array.from(found);
}
