/**
 * Post-processor that marks every <script> and <style> tag with `is:inline`
 * so Astro emits them verbatim instead of routing them through Vite/Rollup.
 *
 * Astro's default behaviour treats inline <script> blocks and `<script src="...">`
 * tags as TypeScript modules to bundle. The clones produced by dr-parity already
 * point at pre-built static files under public/, so Astro must NOT try to
 * resolve them. Adding the `is:inline` directive opts every tag out of bundling.
 *
 * Notes:
 * - <link rel="stylesheet"> is intentionally untouched (Astro does not bundle it).
 * - We walk descendants too: top-level tags AND tags nested inside wrappers
 *   (e.g. <div><script>...</script></div>) both need the directive.
 * - The directive is idempotent: tags that already carry `is:inline` are skipped.
 */

import * as cheerioModule from 'cheerio';
import type { Element } from 'domhandler';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

/**
 * Add `is:inline` to every <script> and <style> tag in the supplied HTML
 * fragment. The HTML may be a full document, a head's innerHTML, or a single
 * element. Output preserves whitespace and original attribute ordering.
 */
export function injectIsInline(html: string): string {
  if (html.length === 0) return html;
  if (!/<\s*(script|style)\b/i.test(html)) return html;

  const $ = cheerio.load(html, null, false);
  $('script, style').each((_idx: number, el: Element) => {
    // domhandler reports node.type as 'script' or 'style' for these elements
    // (not 'tag'), so do not filter on type === 'tag'.
    if (el.type !== 'script' && el.type !== 'style' && el.type !== 'tag') return;
    const attribs = (el as { attribs: Record<string, string> }).attribs;
    if (Object.prototype.hasOwnProperty.call(attribs, 'is:inline')) return;
    attribs['is:inline'] = '';
  });
  return $.html();
}
