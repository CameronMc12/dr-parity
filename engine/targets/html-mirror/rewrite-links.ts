/**
 * Rewrite internal <a href> links and asset src/href attributes in a
 * captured HTML document so the resulting static mirror serves cleanly
 * from a local web root.
 *
 * Rules applied:
 *   - <a href="https://<originHost>/X"> -> <a href="/X">
 *   - <a href="/X"> left as-is (resolves against the static server root)
 *   - any src/href pointing at https://<originHost>/assets/X (or any
 *     mirrored host's /assets/X) rewritten to /assets/X
 *   - other absolute URLs and external links are untouched
 */

import * as cheerioModule from 'cheerio';

const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

export interface RewriteResult {
  html: string;
  linksRewritten: number;
  assetsRewritten: number;
}

const ASSET_PATH_RE = /^\/(?:assets|fonts|images|static|public)\//i;

function stripOriginHref(value: string, originHost: string): string | null {
  try {
    const url = new URL(value);
    if (url.host !== originHost) return null;
    const path = url.pathname + url.search + url.hash;
    return path.length > 0 ? path : '/';
  } catch {
    return null;
  }
}

/**
 * Returns the rewritten href value when the input refers to a mirrored
 * first-party URL; null when the value should be left untouched.
 */
function rewriteAnchorHref(value: string, originHost: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // hash / mailto / tel / javascript: — leave alone
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:')
  ) {
    return null;
  }
  // absolute origin link -> path
  if (/^https?:\/\//i.test(trimmed)) {
    return stripOriginHref(trimmed, originHost);
  }
  // relative or root-relative path -> leave alone
  return null;
}

function rewriteAssetUrl(value: string, originHost: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.host !== originHost) return null;
    if (!ASSET_PATH_RE.test(url.pathname)) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

const ASSET_ATTRS: ReadonlyArray<{ selector: string; attr: string }> = [
  { selector: 'link[href]', attr: 'href' },
  { selector: 'script[src]', attr: 'src' },
  { selector: 'img[src]', attr: 'src' },
  { selector: 'source[src]', attr: 'src' },
  { selector: 'source[srcset]', attr: 'srcset' },
  { selector: 'img[srcset]', attr: 'srcset' },
  { selector: 'video[src]', attr: 'src' },
  { selector: 'audio[src]', attr: 'src' },
  { selector: 'iframe[src]', attr: 'src' },
];

function rewriteSrcset(value: string, originHost: string): { value: string; count: number } {
  // srcset: comma-separated "url descriptor" entries
  let count = 0;
  const parts = value.split(',').map((entry) => {
    const piece = entry.trim();
    if (piece.length === 0) return piece;
    const segments = piece.split(/\s+/);
    const url = segments[0];
    const rewritten = rewriteAssetUrl(url, originHost);
    if (rewritten !== null) {
      count += 1;
      segments[0] = rewritten;
      return segments.join(' ');
    }
    return piece;
  });
  return { value: parts.join(', '), count };
}

export function rewriteHtml(html: string, originHost: string): RewriteResult {
  if (!html || html.length === 0) {
    return { html, linksRewritten: 0, assetsRewritten: 0 };
  }

  const $ = cheerio.load(html);
  let linksRewritten = 0;
  let assetsRewritten = 0;

  $('a[href]').each((_i: number, el: any) => {
    const current = $(el).attr('href');
    if (!current) return;
    const next = rewriteAnchorHref(current, originHost);
    if (next !== null && next !== current) {
      $(el).attr('href', next);
      linksRewritten += 1;
    }
  });

  for (const { selector, attr } of ASSET_ATTRS) {
    $(selector).each((_i: number, el: any) => {
      const current = $(el).attr(attr);
      if (!current) return;
      if (attr === 'srcset') {
        const { value: rewritten, count } = rewriteSrcset(current, originHost);
        if (count > 0 && rewritten !== current) {
          $(el).attr(attr, rewritten);
          assetsRewritten += count;
        }
        return;
      }
      const next = rewriteAssetUrl(current, originHost);
      if (next !== null && next !== current) {
        $(el).attr(attr, next);
        assetsRewritten += 1;
      }
    });
  }

  return { html: $.html(), linksRewritten, assetsRewritten };
}
