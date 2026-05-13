/**
 * Renders an ElementSpec subtree to JSX for use inside a React `.tsx` island.
 *
 * Differs from element-html in three ways:
 *  - emits className instead of class, htmlFor instead of for, etc.
 *  - self-closing tags use `/>` JSX style
 *  - inline SVG is wrapped in a span with dangerouslySetInnerHTML to avoid
 *    JSX attribute mangling on every SVG child path.
 */

import type { ElementSpec } from '../../types/extraction';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  spellcheck: 'spellCheck',
};

export interface JsxRenderOptions {
  classPrefix: string;
  maxDepth?: number;
}

export function elementToJsx(
  element: ElementSpec,
  options: JsxRenderOptions,
  depth = 0,
): string {
  const maxDepth = options.maxDepth ?? 12;
  if (depth > maxDepth) return '';

  const tag = element.tag.toLowerCase();

  if (tag === 'svg') {
    const safe = JSON.stringify(reconstructSvg(element));
    return `<span className="svg-wrap" dangerouslySetInnerHTML={{ __html: ${safe} }} />`;
  }

  if (tag === 'img') {
    const src = element.media?.localPath ?? element.media?.src ?? element.attributes.src ?? '';
    const alt = element.media?.alt ?? element.attributes.alt ?? '';
    return `<img src=${JSON.stringify(src)} alt=${JSON.stringify(alt)} />`;
  }

  const attrs = renderAttrs(element, options);
  const text = (element.textContent ?? '').trim();
  const children = element.children
    .map((c) => elementToJsx(c, options, depth + 1))
    .filter(Boolean);

  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs} />`;
  if (children.length === 0 && text) {
    return `<${tag}${attrs}>${escapeJsxText(text)}</${tag}>`;
  }
  if (children.length === 0) return `<${tag}${attrs} />`;
  return `<${tag}${attrs}>${children.join('')}</${tag}>`;
}

function renderAttrs(element: ElementSpec, options: JsxRenderOptions): string {
  const out: string[] = [];
  const classes = computeClasses(element, options.classPrefix);
  const numeric = looksNumeric(element.textContent) ? 'num' : '';
  const finalClasses = [classes, numeric].filter(Boolean).join(' ').trim();
  if (finalClasses) out.push(`className=${JSON.stringify(finalClasses)}`);

  for (const [rawKey, rawValue] of Object.entries(element.attributes)) {
    if (rawKey === 'class' || rawKey === 'style') continue;
    if (rawKey.startsWith('on')) continue;
    const key = ATTR_MAP[rawKey.toLowerCase()] ?? rawKey;
    if (!isSafeAttrName(key)) continue;
    out.push(`${key}=${JSON.stringify(rawValue)}`);
  }
  return out.length === 0 ? '' : ' ' + out.join(' ');
}

function computeClasses(element: ElementSpec, prefix: string): string {
  const base = element.classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
  if (base.length > 0) return base.join(' ');
  return `${prefix}-${element.tag.toLowerCase()}`;
}

function reconstructSvg(element: ElementSpec): string {
  const attrs = Object.entries(element.attributes)
    .filter(([k]) => !k.startsWith('data-') && k !== 'class' && k !== 'style')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');
  const open = attrs ? `<svg ${attrs} fill="currentColor">` : '<svg fill="currentColor">';
  const inner = (element.innerHTML ?? '').replace(/\s+data-[a-z-]+="[^"]*"/gi, '');
  return `${open}${inner}</svg>`;
}

function isSafeAttrName(name: string): boolean {
  return /^[a-zA-Z_][\w-]*$/.test(name) && !name.startsWith('xmlns');
}

function escapeJsxText(text: string): string {
  return text.replace(/[<>{}]/g, (c) => `{${JSON.stringify(c)}}`);
}

function looksNumeric(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 24) return false;
  return /^[$#]?\d[\d.,:\-/%a-z]*$/i.test(trimmed) && /\d/.test(trimmed);
}
