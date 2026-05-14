/**
 * Extract the document head and html/body attribute strings.
 *
 * - Strips the injected `<base href="./"/>` element.
 * - Normalises asset paths in head children (href, src, srcset, inline style/<style>).
 * - Pulls a best-effort title + description for use by the page wrapper.
 */

import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { normaliseElementPaths } from './paths';
import type { ExtractedHead } from './types';

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
