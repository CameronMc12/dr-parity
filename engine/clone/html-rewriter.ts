/**
 * HTML rewriter using cheerio.
 *
 * Rewrites every reference in the document to point at the corresponding
 * file inside clone/. Same-origin <a href> only rewrites when the target
 * was captured. External URLs we never captured are left as-is so the
 * clone still loads them when served online.
 */

import * as cheerio from 'cheerio';
import { resolveUrl, relativeFromClonePath } from './url-map';
import { rewriteCss } from './css-rewriter';
import type { UrlMap } from './types';

type RewriteArgs = {
  html: string;
  documentUrl: string;
  /** Clone-relative path of the html file itself ("index.html"). */
  ownClonePath: string;
  urlMap: UrlMap;
  unresolved: Set<string>;
};

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function rewriteSingle(
  raw: string | undefined,
  documentUrl: string,
  ownClonePath: string,
  urlMap: UrlMap,
  unresolved: Set<string>
): string | null {
  if (raw === undefined) return null;
  const abs = resolveUrl(documentUrl, raw);
  if (!abs) return null;
  const hit = urlMap.get(abs);
  if (!hit) {
    unresolved.add(abs);
    return null;
  }
  return relativeFromClonePath(ownClonePath, hit.cloneRelPath);
}

function rewriteSrcset(
  raw: string,
  documentUrl: string,
  ownClonePath: string,
  urlMap: UrlMap,
  unresolved: Set<string>
): string {
  return raw
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const segments = trimmed.split(/\s+/);
      const url = segments[0];
      const descriptor = segments.slice(1).join(' ');
      const replaced = rewriteSingle(url, documentUrl, ownClonePath, urlMap, unresolved);
      const finalUrl = replaced ?? url;
      return descriptor ? `${finalUrl} ${descriptor}` : finalUrl;
    })
    .filter(Boolean)
    .join(', ');
}

function rewriteInlineStyle(
  raw: string,
  documentUrl: string,
  ownClonePath: string,
  urlMap: UrlMap,
  unresolved: Set<string>
): string {
  return rewriteCss({
    css: raw,
    cssSourceUrl: documentUrl,
    ownClonePath,
    urlMap,
    unresolved,
  });
}

/**
 * HTML5 void elements — the only tags that may legally self-close.
 * Everything else MUST have an explicit closing tag, otherwise browsers
 * (per the HTML5 spec) treat `<script src="x"/>` as an unterminated
 * `<script>` element and swallow the rest of the document.
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Belt-and-braces pass: cheerio sometimes emits `<tag attrs/>` for
 * non-void elements. Convert any such self-closing tag back into an
 * explicit `<tag attrs></tag>` pair when the tag is NOT in the HTML5
 * void list. The leading `<` is captured so we don't touch comments,
 * doctype, or CDATA.
 */
function expandNonVoidSelfClosing(html: string): string {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)\s*\/>/g,
    (match, tag: string, attrs: string) => {
      if (VOID_ELEMENTS.has(tag.toLowerCase())) return match;
      const cleanAttrs = attrs.replace(/\s+$/, '');
      return `<${tag}${cleanAttrs}></${tag}>`;
    }
  );
}

export function rewriteHtml(args: RewriteArgs): string {
  // IMPORTANT: do NOT enable xml mode. cheerio's xml mode (or anything
  // that flips `xmlMode` true under the hood) serialises non-void
  // elements as self-closing tags, which corrupts the document.
  const $ = cheerio.load(args.html, { xmlMode: false });

  $('base[href]').remove();
  $('meta[http-equiv]').each((_, el) => {
    const v = $(el).attr('http-equiv') ?? '';
    if (v.toLowerCase() === 'content-security-policy') {
      $(el).remove();
    }
  });
  $('script[integrity]').removeAttr('integrity');
  $('link[integrity]').removeAttr('integrity');
  $('script[crossorigin]').removeAttr('crossorigin');
  $('link[crossorigin]').removeAttr('crossorigin');

  let head = $('head');
  if (head.length === 0) {
    $('html').prepend('<head></head>');
    head = $('head');
  }
  head.prepend('<base href="./">');

  const rewriteAttr = (selector: string, attr: string): void => {
    $(selector).each((_, el) => {
      const raw = $(el).attr(attr);
      if (raw === undefined) return;
      const replaced = rewriteSingle(
        raw,
        args.documentUrl,
        args.ownClonePath,
        args.urlMap,
        args.unresolved
      );
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

  $('img[srcset]').each((_, el) => {
    const raw = $(el).attr('srcset');
    if (!raw) return;
    $(el).attr(
      'srcset',
      rewriteSrcset(raw, args.documentUrl, args.ownClonePath, args.urlMap, args.unresolved)
    );
  });
  $('source[srcset]').each((_, el) => {
    const raw = $(el).attr('srcset');
    if (!raw) return;
    $(el).attr(
      'srcset',
      rewriteSrcset(raw, args.documentUrl, args.ownClonePath, args.urlMap, args.unresolved)
    );
  });

  $('iframe[src]').each((_, el) => {
    const raw = $(el).attr('src');
    if (!raw) return;
    const abs = resolveUrl(args.documentUrl, raw);
    if (!abs) return;
    if (!sameOrigin(abs, args.documentUrl)) return;
    const replaced = rewriteSingle(
      raw,
      args.documentUrl,
      args.ownClonePath,
      args.urlMap,
      args.unresolved
    );
    if (replaced) $(el).attr('src', replaced);
  });

  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    if (!raw) return;
    const abs = resolveUrl(args.documentUrl, raw);
    if (!abs) return;
    if (!sameOrigin(abs, args.documentUrl)) return;
    const hit = args.urlMap.get(abs);
    if (!hit) return;
    const replaced = relativeFromClonePath(args.ownClonePath, hit.cloneRelPath);
    $(el).attr('href', replaced);
  });

  $('[style]').each((_, el) => {
    const raw = $(el).attr('style');
    if (!raw) return;
    const rewritten = rewriteInlineStyle(
      raw,
      args.documentUrl,
      args.ownClonePath,
      args.urlMap,
      args.unresolved
    );
    if (rewritten !== raw) $(el).attr('style', rewritten);
  });

  $('style').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    const rewritten = rewriteInlineStyle(
      raw,
      args.documentUrl,
      args.ownClonePath,
      args.urlMap,
      args.unresolved
    );
    $(el).text(rewritten);
  });

  return expandNonVoidSelfClosing($.html());
}
