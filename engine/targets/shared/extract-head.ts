/**
 * Extract the document head and html/body attribute strings.
 *
 * - Strips the injected `<base href="./"/>` element.
 * - Normalises asset paths in head children (href, src, srcset, inline style/<style>).
 * - Pulls a best-effort title + description for use by the page wrapper.
 *
 * Target-agnostic: returns a JSON description (ExtractedHead). Each framework
 * target formats this into its own layout/head syntax.
 */

import * as cheerioModule from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { normaliseElementPaths } from './paths';
import { resolveUrl } from '../../clone/url-map';
import type { CloneAssetMap } from './rewrite-body-assets';
import type { ExtractedHead } from './types';

// cheerio's default export varies between ESM/CJS interop; normalise it.
const cheerio: { load: typeof import('cheerio').load } =
  (cheerioModule as unknown as { default?: { load: typeof import('cheerio').load } }).default ??
  (cheerioModule as unknown as { load: typeof import('cheerio').load });

function serialiseAttrs(attribs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attribs)) {
    if (value === undefined || value === null) continue;
    if (value === '') parts.push(key);
    else parts.push(`${key}="${escapeAttr(value)}"`);
  }
  return parts.length === 0 ? '' : ' ' + parts.join(' ');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function extractHead($: CheerioAPI): ExtractedHead {
  const head = $('head').first();
  if (head.length === 0) {
    throw new Error('Captured HTML has no <head> element.');
  }

  head.find('base[href="./"], base[href="/"]').remove();

  normaliseElementPaths($, head);

  const titleEl = head.find('title').first();
  const title = titleEl.length > 0 ? titleEl.text().trim() : '';

  const descEl = head.find('meta[name="description"]').first();
  const description =
    descEl.length > 0 ? (descEl.attr('content') ?? '').trim() : '';

  const innerHTML = (head.html() ?? '').trim();

  const htmlEl = $('html').first();
  const bodyEl = $('body').first();
  const htmlAttrs = htmlEl.length > 0 ? serialiseAttrs((htmlEl.get(0) as Element).attribs) : '';
  const bodyAttrs = bodyEl.length > 0 ? serialiseAttrs((bodyEl.get(0) as Element).attribs) : '';

  return { innerHTML, htmlAttrs, bodyAttrs, title, description };
}

/** Resolve a head ref against the document URL, then map to a local served path. */
function localServedFor(
  raw: string,
  documentUrl: string,
  assetMap: CloneAssetMap,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) return null;
  const abs = resolveUrl(documentUrl, trimmed);
  if (!abs) return null;
  const served = assetMap.servedPaths.get(abs);
  if (served) return served;
  const lastSeg = abs.split(/[?#]/)[0].split('/').pop() ?? '';
  return assetMap.byBasename.get(lastSeg) ?? null;
}

/**
 * Rewrite same-origin head asset references (`<link href>`, `<script src>`) to
 * their crawl-localized `_ext/...` served paths.
 *
 * `extractHead` only normalises `<base href="./">`-relative paths; it leaves
 * absolute same-origin refs like `/static/assets/app.css` untouched because it
 * has no asset map. The global stylesheet lives at such a path, so without this
 * pass the emitted `index.html` links a file the dev server never has and the
 * whole theme silently falls back (no brand vars, Times body font). This runs
 * after the asset map is known and only changes refs that resolve to a localized
 * copy — uncaptured refs pass through unchanged, so nothing regresses.
 */
export function rewriteHeadAssetLinks(
  head: ExtractedHead,
  documentUrl: string,
  assetMap: CloneAssetMap | null,
): ExtractedHead {
  if (!assetMap || !documentUrl) return head;
  const $ = cheerio.load(head.innerHTML, null, false);
  let changed = 0;

  const remap = (selector: string, attr: string): void => {
    $(selector).each((_i, el) => {
      const node = $(el);
      const raw = node.attr(attr);
      if (!raw) return;
      const local = localServedFor(raw, documentUrl, assetMap);
      if (local && local !== raw) {
        node.attr(attr, local);
        changed++;
      }
    });
  };

  remap('link[href]', 'href');
  remap('script[src]', 'src');

  if (changed === 0) return head;
  return { ...head, innerHTML: ($.html() ?? '').trim() };
}
