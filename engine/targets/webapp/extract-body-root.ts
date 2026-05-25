/**
 * Extract the visible app body from a captured FULL HTML document.
 *
 * The crawler's `state-capture` writes `document.documentElement.outerHTML`,
 * which means every state's `dom.html` (and every per-route fresh capture)
 * is the complete document: `<html><head>...</head><body>...</body></html>`.
 *
 * The emit-stateful pipeline needs ONLY the visible app body — i.e. the
 * contents of `<div id="root">` plus any body-level sibling portals
 * (modal roots, toast containers) — because:
 *   1. The captured `<head>` already powers the generated Vite shell
 *      (writeIndexHtml), so re-rendering it inside React would duplicate
 *      meta tags, scripts, and stylesheets.
 *   2. The captured body contains its own literal `<div id="root">` which,
 *      if pasted as JSX, creates an id collision with the outer Vite
 *      `<div id="root">` that the router mounts into, AND buries the
 *      route-specific UI inside a nested wrapper that React never sees
 *      as the "real" mount point.
 *
 * Strategy:
 *   1. Find `<div id="root">` → start with its innerHTML.
 *   2. ALSO append any body-level sibling element that is NOT a
 *      `<script>`, `<noscript>`, or `<link>` tag. This preserves portal
 *      roots (Radix modals, react-hot-toast containers) that the source
 *      app mounted as direct children of `<body>`.
 *   3. If no `#root` is found, fall back to `<body>` innerHTML, stripped
 *      of `<script>` and `<noscript>`.
 *   4. Last resort: return the input unchanged.
 *
 * Keeps the slicer cheerio-based (never regex) so HTML edge cases like
 * unquoted attrs and nested quotes don't corrupt the output.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

export interface ExtractedBody {
  /** The sliced inner HTML. */
  html: string;
  /** Where the slice came from, for diagnostics. */
  source: 'div-root' | 'div-root-plus-siblings' | 'body' | 'fallback';
}

const BODY_LEVEL_SKIP_TAGS = new Set(['script', 'noscript', 'link', 'style']);

function collectBodySiblings($: any, rootEl: any): string {
  // Walk body children, skipping #root itself and any noisy tags. Anything
  // else (portals, late-mounted modal hosts) gets concatenated.
  const body = $('body').first();
  if (body.length === 0) return '';
  const fragments: string[] = [];
  body.children().each((_i: number, child: any) => {
    if (child === rootEl[0]) return;
    const tagName = (child.tagName ?? child.name ?? '').toLowerCase();
    if (BODY_LEVEL_SKIP_TAGS.has(tagName)) return;
    const id = $(child).attr('id') ?? '';
    if (id === 'root') return;
    fragments.push($.html(child));
  });
  return fragments.join('');
}

/**
 * Extract `<div id="root">`'s innerHTML (the React-mounted shell) plus
 * body-level portal siblings from a full captured document. Falls back
 * to `<body>` innerHTML, then to the raw input.
 */
export function extractBodyRoot(fullHtml: string): ExtractedBody {
  if (!fullHtml || fullHtml.length === 0) {
    return { html: '', source: 'fallback' };
  }

  const $ = cheerio.load(fullHtml, null, true);

  const root = $('#root').first();
  if (root.length > 0) {
    const inner = root.html() ?? '';
    const siblings = collectBodySiblings($, root);
    if (siblings.length > 0) {
      return { html: `${inner}${siblings}`, source: 'div-root-plus-siblings' };
    }
    return { html: inner, source: 'div-root' };
  }

  const body = $('body').first();
  if (body.length > 0) {
    // Remove <script>/<noscript> tags from the body slice — they belong
    // in the shell (writeIndexHtml hoists them), not the React tree,
    // where React DOM-renders <script> elements without executing them.
    body.find('script').remove();
    body.find('noscript').remove();
    const inner = body.html() ?? '';
    return { html: inner, source: 'body' };
  }

  return { html: fullHtml, source: 'fallback' };
}
