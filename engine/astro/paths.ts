/**
 * Path normalisation utilities.
 *
 * Captured clones use `<base href="./"/>` so all asset references are written
 * as relative paths (`./_astro/...` or `imgs/...`). In Astro static output we
 * serve from `public/` at the root, so each non-absolute reference must be
 * rewritten to a root-anchored absolute path.
 */

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const URL_ATTRS = ['src', 'href', 'poster', 'data-src'];
const SRCSET_ATTRS = ['srcset', 'data-srcset'];

/** True for protocol, protocol-relative, root, data, blob, hash, mailto, tel, js. */
function isAbsoluteLike(value: string): boolean {
  if (value.length === 0) return true;
  if (value.startsWith('/')) return true;
  if (value.startsWith('#')) return true;
  if (value.startsWith('data:')) return true;
  if (value.startsWith('blob:')) return true;
  if (value.startsWith('mailto:')) return true;
  if (value.startsWith('tel:')) return true;
  if (value.startsWith('javascript:')) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return true;
  return false;
}

/** Convert a single URL token to a root-anchored path. */
export function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return raw;
  if (isAbsoluteLike(trimmed)) return trimmed;
  if (trimmed.startsWith('./')) return '/' + trimmed.slice(2);
  if (trimmed.startsWith('../')) return '/' + trimmed.replace(/^(\.\.\/)+/, '');
  return '/' + trimmed;
}

/** Normalise a srcset value: split entries by comma, rewrite the URL token of each. */
export function normaliseSrcset(value: string): string {
  return value
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      if (trimmed.length === 0) return entry;
      const spaceIdx = trimmed.search(/\s/);
      if (spaceIdx === -1) return normaliseUrl(trimmed);
      const url = trimmed.slice(0, spaceIdx);
      const descriptor = trimmed.slice(spaceIdx);
      return normaliseUrl(url) + descriptor;
    })
    .join(', ');
}

/** Rewrite every `url(...)` token inside a CSS string. */
export function normaliseCssUrls(css: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_match, quote: string, url: string) => {
    return `url(${quote}${normaliseUrl(url)}${quote})`;
  });
}

/**
 * Walk every element in the subtree (inclusive) and normalise asset paths in
 * place. We recurse manually rather than via `.find('*')` because cheerio's
 * universal-descendant selector excludes `<script>` and `<style>` elements,
 * which are exactly the tags we need to rewrite (e.g. <script src="./x.js">).
 *
 * Note: domhandler uses node.type === 'script' for <script> and 'style' for
 * <style>; only generic elements use 'tag'. We treat all three as elements.
 */
export function normaliseElementPaths($: CheerioAPI, root: Cheerio<AnyNode>): void {
  root.each((_, node) => {
    if (!isElementNode(node)) return;
    walk($, node as Element);
  });
}

function isElementNode(node: AnyNode): boolean {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function walk($: CheerioAPI, el: Element): void {
  rewriteElement($, el);
  const children = (el.children ?? []) as AnyNode[];
  for (const child of children) {
    if (isElementNode(child)) walk($, child as Element);
  }
}

function rewriteElement($: CheerioAPI, el: Element): void {
  const $el = $(el);
  for (const attr of URL_ATTRS) {
    const value = $el.attr(attr);
    if (typeof value === 'string' && value.length > 0) {
      $el.attr(attr, normaliseUrl(value));
    }
  }
  for (const attr of SRCSET_ATTRS) {
    const value = $el.attr(attr);
    if (typeof value === 'string' && value.length > 0) {
      $el.attr(attr, normaliseSrcset(value));
    }
  }
  const style = $el.attr('style');
  if (typeof style === 'string' && style.includes('url(')) {
    $el.attr('style', normaliseCssUrls(style));
  }
  if (el.tagName === 'style') {
    const text = $el.html();
    if (typeof text === 'string' && text.includes('url(')) {
      $el.html(normaliseCssUrls(text));
    }
  }
}
