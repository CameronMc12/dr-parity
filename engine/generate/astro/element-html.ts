/**
 * Renders an ElementSpec subtree to HTML for use inside an Astro `.astro`
 * component template. Plain HTML attributes (class=, for=, etc.) — Astro
 * accepts both raw HTML and JSX-style className in templates, but plain HTML
 * keeps the output the closest to what Astro auto-scopes against.
 *
 * Inline `<svg>` markup is passed through verbatim (cleaned of data-* noise).
 */

import type { ElementSpec } from '../../types/extraction';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const SKIP_ATTRS = new Set(['class', 'style']);

export interface HtmlRenderOptions {
  classPrefix: string;
  maxDepth?: number;
  /** Used by the emitter to record selector data-anim hooks. */
  collectAnimSelectors?: Set<string>;
  /** When set, every element with an id or animatable class gets a stable data-anim attr. */
  animElementSelectors?: Set<string>;
}

export function elementToHtml(
  element: ElementSpec,
  options: HtmlRenderOptions,
  depth = 0,
): string {
  const maxDepth = options.maxDepth ?? 12;
  if (depth > maxDepth) return '';

  const tag = element.tag.toLowerCase();

  if (tag === 'svg') {
    return reconstructSvgHtml(element);
  }

  if (tag === 'img') {
    const src = element.media?.localPath ?? element.media?.src ?? element.attributes.src ?? '';
    const alt = element.media?.alt ?? element.attributes.alt ?? '';
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`;
  }

  const attrs = renderAttrs(element, options);
  const text = (element.textContent ?? '').trim();
  const children = element.children
    .map((c) => elementToHtml(c, options, depth + 1))
    .filter(Boolean);

  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs} />`;

  if (children.length === 0 && text) {
    return `<${tag}${attrs}>${escapeText(text)}</${tag}>`;
  }
  if (children.length === 0) {
    return `<${tag}${attrs}></${tag}>`;
  }
  return `<${tag}${attrs}>${children.join('')}</${tag}>`;
}

function renderAttrs(element: ElementSpec, options: HtmlRenderOptions): string {
  const out: string[] = [];

  const classes = computeClasses(element, options.classPrefix);
  const numericClass = looksNumeric(element.textContent) ? 'num' : '';
  const finalClasses = [classes, numericClass].filter(Boolean).join(' ').trim();
  if (finalClasses) out.push(`class="${escapeAttr(finalClasses)}"`);

  for (const [rawKey, rawValue] of Object.entries(element.attributes)) {
    if (SKIP_ATTRS.has(rawKey)) continue;
    if (rawKey.startsWith('on')) continue;
    if (!isSafeAttrName(rawKey)) continue;
    out.push(`${rawKey}="${escapeAttr(rawValue)}"`);
  }

  return out.length === 0 ? '' : ' ' + out.join(' ');
}

function computeClasses(element: ElementSpec, prefix: string): string {
  const base = element.classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
  if (base.length > 0) return base.join(' ');
  return `${prefix}-${element.tag.toLowerCase()}`;
}

function reconstructSvgHtml(element: ElementSpec): string {
  const attrs = Object.entries(element.attributes)
    .filter(([k]) => !k.startsWith('data-') && k !== 'class' && k !== 'style')
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(' ');
  const open = attrs ? `<svg ${attrs} fill="currentColor">` : '<svg fill="currentColor">';
  const inner = (element.innerHTML ?? '').replace(/\s+data-[a-z-]+="[^"]*"/gi, '');
  return `${open}${inner}</svg>`;
}

function isSafeAttrName(name: string): boolean {
  return /^[a-zA-Z_][\w:-]*$/.test(name) && !name.startsWith('xmlns');
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function looksNumeric(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 24) return false;
  return /^[$#]?\d[\d.,:\-/%a-z]*$/i.test(trimmed) && /\d/.test(trimmed);
}
