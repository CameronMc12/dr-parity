/**
 * Discover assets in the parsed clone that must live in the root index.html
 * rather than inside React component JSX:
 *
 *  1. Body-level <script> tags (external + inline). React DOM-renders these
 *     but never executes them, so GSAP/AOS/etc. never load. We hoist them
 *     into index.html and strip them from the body tree before slicing.
 *
 *  2. Cached <link rel="stylesheet"> files copied into /public. The source
 *     <head> already carries the original <link> references via
 *     extractHead(); this helper finds any *.css under /public that the
 *     head didn't already cover (e.g. preloaded or JS-imported cache
 *     bundles), so the React build doesn't silently lose them.
 *
 * Keeping the collector target-agnostic (returns plain data, not JSX or
 * Astro frontmatter) means a future non-React target could reuse it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { CheerioAPI } from 'cheerio';
import type { Element, AnyNode } from 'domhandler';

import { ESCAPE_HATCH_SCRIPT_MARKERS } from './escape-hatch-predicates';

export interface HoistedScript {
  /** True if `<script src="...">`, false for inline. */
  external: boolean;
  /** Full attribute string ready to splat (e.g. ` src="/foo.js" async`). */
  attrs: string;
  /** Inline script body. Empty when external. */
  body: string;
  /**
   * True when this external script's SOURCE references a registered
   * escape-hatch marker. Deferred scripts are emitted as inert
   * placeholders so the browser neither fetches nor runs them at parse
   * time; the post-hydration runtime injects the real script only after
   * the escape-hatch DOM commits. Always false for inline scripts and
   * for clones with no escape-hatch markers.
   */
  deferred: boolean;
  /** Original `src` attribute value, preserved for deferred re-injection. */
  src: string;
  /** True when the original script was `type="module"`. */
  module: boolean;
}

/**
 * Walk every descendant of <body>, collect each <script> tag, and remove it
 * from the cheerio tree so downstream slicer/JSX emitter never see it.
 *
 * Preserves document order. Skips the root #root mount script if any
 * future code introduces it here — we only ever collect captured scripts.
 *
 * When `cloneDir` is given, each external script's captured source is read
 * from disk and tested against the registered escape-hatch markers. A
 * matching script is flagged `deferred` so `renderHoistedScripts` emits an
 * inert placeholder instead of an executable tag. This is fully additive:
 * clones whose scripts reference no escape-hatch marker yield `deferred:
 * false` for every script and render byte-identically to before.
 */
export function collectAndStripBodyScripts(
  $: CheerioAPI,
  cloneDir?: string,
): HoistedScript[] {
  const body = $('body').first();
  if (body.length === 0) return [];

  const collected: HoistedScript[] = [];

  // Snapshot before mutating: `.each` over a live selection would skip
  // elements after removal.
  const scriptEls = body.find('script').toArray();

  for (const el of scriptEls) {
    const tag = el as Element;
    const attribs: Record<string, string> = { ...(tag.attribs ?? {}) };
    const src = typeof attribs.src === 'string' ? attribs.src : '';
    const isExternal = src.length > 0;
    const isModule = (attribs.type ?? '').toLowerCase() === 'module';

    let body = '';
    if (!isExternal) {
      for (const child of (tag.children ?? []) as AnyNode[]) {
        if (child.type === 'text' || child.type === 'script') {
          body += (child as { data?: string }).data ?? '';
        }
      }
    }

    const deferred =
      isExternal && cloneDir !== undefined && scriptSourceHasMarker(cloneDir, src);

    collected.push({
      external: isExternal,
      attrs: serialiseAttrs(attribs),
      body,
      deferred,
      src,
      module: isModule,
    });

    $(tag).remove();
  }

  return collected;
}

/**
 * Read the captured source for a script `src` (root-anchored after path
 * normalisation, e.g. `/v/home/a/built/scripts/gallery.built.js`) from the
 * clone directory and report whether it references any escape-hatch marker.
 * Returns false on any read failure so a missing asset never breaks emit.
 */
function scriptSourceHasMarker(cloneDir: string, normalisedSrc: string): boolean {
  if (ESCAPE_HATCH_SCRIPT_MARKERS.length === 0) return false;
  const rel = normalisedSrc.replace(/^\//, '').split(/[?#]/, 1)[0];
  if (rel.length === 0) return false;
  const assetPath = join(cloneDir, ...rel.split('/'));
  let source: string;
  try {
    source = readFileSync(assetPath, 'utf8');
  } catch {
    return false;
  }
  return ESCAPE_HATCH_SCRIPT_MARKERS.some((marker) => source.includes(marker));
}

/**
 * Render hoisted scripts as plain HTML strings ready to splice into the
 * end of <body> in the generated index.html. Preserves all attributes
 * (including async/defer/type=module) and document order.
 */
export function renderHoistedScripts(scripts: readonly HoistedScript[]): string[] {
  return scripts.map((s) => {
    if (s.deferred) {
      // Deferred escape-hatch script: emit an inert placeholder carrying
      // the original src + module flag. No `src` and a custom `type` mean
      // the browser neither fetches nor executes it at parse time; the
      // post-hydration runtime injects the real <script> once the
      // escape-hatch DOM exists, winning the race the runtime would
      // otherwise lose against React's deferred commit.
      return [
        '<script type="application/parity-deferred"',
        ` data-parity-deferred-src="${escapeAttr(s.src)}"`,
        ` data-parity-deferred-module="${s.module ? 'true' : 'false'}"></script>`,
      ].join('');
    }
    if (s.external) {
      // External scripts: always emit as paired <script ...></script> for
      // maximum compatibility (some loaders dislike self-closed forms).
      return `<script${s.attrs}></script>`;
    }
    return `<script${s.attrs}>${s.body}</script>`;
  });
}

/**
 * Recursively enumerate every *.css file under `publicDir`. Returns
 * paths relative to publicDir (POSIX-style) so they can be used as
 * URL-absolute hrefs in index.html (`/foo/bar.css`).
 */
export function listPublicCssFiles(publicDir: string): string[] {
  const out: string[] = [];
  walkCss(publicDir, publicDir, out);
  out.sort();
  return out;
}

function walkCss(root: string, current: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(current);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(current, name);
    let s;
    try {
      s = statSync(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walkCss(root, abs, out);
    } else if (name.toLowerCase().endsWith('.css')) {
      const rel = relative(root, abs).split(/[\\/]/).join('/');
      out.push(rel);
    }
  }
}

/**
 * Extract the set of stylesheet hrefs already linked from the source
 * clone's index.html. Matches `<link rel="stylesheet" ... href="...">`
 * in any attribute order. Hrefs are normalised to leading-slash form
 * so they line up with the URL-absolute hrefs used at runtime.
 */
export function extractSourceStylesheetHrefs(rawHtml: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawHtml)) !== null) {
    const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(match[0]);
    if (!hrefMatch) continue;
    out.push(normaliseHref(hrefMatch[1]));
  }
  return out;
}

function normaliseHref(href: string): string {
  // Drop the relative './' prefix produced by the path normaliser.
  let h = href.replace(/^\.\//, '/');
  if (!h.startsWith('/') && !/^https?:\/\//i.test(h)) {
    h = '/' + h;
  }
  return h;
}

/**
 * Decide which discovered public-CSS files need a <link> in the generated
 * index.html. We emit links for:
 *
 *   - every source <link rel="stylesheet"> in original order (so cascade
 *     stays identical), as long as the file exists in /public
 *   - any orphan *.css under /public that the source didn't link (better
 *     to over-include than miss styles — they may have been preloaded or
 *     imported via JS)
 *
 * Returns the ordered list of hrefs to emit.
 */
export function planCssLinks(args: {
  sourceStylesheetHrefs: readonly string[];
  publicCssFiles: readonly string[];
}): string[] {
  const { sourceStylesheetHrefs, publicCssFiles } = args;
  const publicSet = new Set(publicCssFiles.map((p) => '/' + p));

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const href of sourceStylesheetHrefs) {
    // Source order first: keep cascade identical to captured site.
    if (seen.has(href)) continue;
    seen.add(href);
    ordered.push(href);
  }

  for (const file of publicCssFiles) {
    const href = '/' + file;
    if (seen.has(href)) continue;
    // Skip files outside /public we somehow can't resolve.
    if (!publicSet.has(href)) continue;
    seen.add(href);
    ordered.push(href);
  }

  return ordered;
}

/**
 * Filter planned CSS links to drop ones that are already present (verbatim
 * or as variant href) in the head's serialised innerHTML. Prevents
 * duplicate <link rel="stylesheet"> tags when the source head already
 * carries them.
 */
export function filterAlreadyLinked(headInnerHtml: string, hrefs: readonly string[]): string[] {
  const out: string[] = [];
  for (const href of hrefs) {
    if (isLinked(headInnerHtml, href)) continue;
    out.push(href);
  }
  return out;
}

function isLinked(headInnerHtml: string, href: string): boolean {
  // Look for any <link rel="stylesheet" ... href="<href>"> in the head
  // (attribute order independent).
  const escaped = escapeRegex(href);
  const re = new RegExp(
    `<link\\b[^>]*\\brel=["']stylesheet["'][^>]*\\bhref=["']${escaped}["']`,
    'i',
  );
  if (re.test(headInnerHtml)) return true;
  // Also match the reverse attribute order.
  const re2 = new RegExp(
    `<link\\b[^>]*\\bhref=["']${escaped}["'][^>]*\\brel=["']stylesheet["']`,
    'i',
  );
  return re2.test(headInnerHtml);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serialiseAttrs(attribs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attribs)) {
    if (value === undefined || value === null) continue;
    if (value === '') {
      parts.push(key);
    } else {
      parts.push(`${key}="${escapeAttr(value)}"`);
    }
  }
  return parts.length === 0 ? '' : ' ' + parts.join(' ');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
