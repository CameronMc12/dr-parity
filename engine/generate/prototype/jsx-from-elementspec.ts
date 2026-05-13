/**
 * Turns an ElementSpec subtree into a JSX string suitable for a Babel-Standalone
 * runtime. No hooks, no "use client", no Tailwind classes — vanilla JSX with
 * class names that match the per-component CSS emitted by `component-css.ts`.
 */

import type { ElementSpec } from '../../types/extraction';
import { reconstructSvg, cleanSvg } from './svg-inliner';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// React-specific attribute renames.
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
  /** Section class prefix used when minting per-element class names. */
  classPrefix: string;
  /** Max depth — guards against runaway trees. */
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

  // SVG: inline the raw markup wrapped in dangerouslySetInnerHTML to avoid
  // JSX attribute mangling on every child path.
  if (tag === 'svg') {
    const safe = JSON.stringify(cleanSvg(reconstructSvg(element)));
    return `<span className="svg-wrap" dangerouslySetInnerHTML={{ __html: ${safe} }} />`;
  }

  // Media elements — image / video / iframe pass through with attrs.
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

  // Decide between rendering text vs children. If both exist, text wins for
  // leaf elements; otherwise children win.
  if (children.length === 0 && text) {
    return `<${tag}${attrs}>${escapeJsxText(text)}</${tag}>`;
  }

  if (children.length === 0) {
    return `<${tag}${attrs} />`;
  }

  return `<${tag}${attrs}>${children.join('')}</${tag}>`;
}

function renderAttrs(element: ElementSpec, options: JsxRenderOptions): string {
  const out: string[] = [];

  const classes = computeClasses(element, options.classPrefix);
  if (classes) out.push(`className=${JSON.stringify(classes)}`);

  for (const [rawKey, rawValue] of Object.entries(element.attributes)) {
    if (rawKey === 'class' || rawKey === 'style') continue;
    if (rawKey.startsWith('on')) continue; // strip inline handlers from source
    const key = ATTR_MAP[rawKey.toLowerCase()] ?? rawKey;
    if (!isSafeAttrName(key)) continue;
    out.push(`${key}=${JSON.stringify(rawValue)}`);
  }

  // Mark numeric leaf nodes with the `.num` utility so they pick up the mono font.
  if (looksNumeric(element.textContent)) {
    const existing = out.find((a) => a.startsWith('className='));
    if (existing) {
      const idx = out.indexOf(existing);
      const merged = mergeClassName(existing, 'num');
      out[idx] = merged;
    } else {
      out.push('className="num"');
    }
  }

  return out.length === 0 ? '' : ' ' + out.join(' ');
}

function computeClasses(element: ElementSpec, prefix: string): string {
  // Use original class names verbatim where present — the component-css emitter
  // mirrors them so styling stays consistent.
  const base = element.classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
  if (base.length > 0) return base.join(' ');
  // Otherwise mint a stable, scoped class from tag + prefix.
  return `${prefix}-${element.tag.toLowerCase()}`;
}

function mergeClassName(existingAttr: string, extra: string): string {
  // existingAttr looks like: className="foo bar"
  const match = existingAttr.match(/^className=(["'])(.*)\1$/);
  if (!match) return existingAttr;
  const current = match[2];
  if (current.split(/\s+/).includes(extra)) return existingAttr;
  return `className=${JSON.stringify(`${current} ${extra}`.trim())}`;
}

function isSafeAttrName(name: string): boolean {
  return /^[a-zA-Z_][\w-]*$/.test(name) && !name.startsWith('xmlns');
}

function escapeJsxText(text: string): string {
  // Escape JSX-significant characters. Leave normal punctuation alone.
  return text.replace(/[<>{}]/g, (c) => `{${JSON.stringify(c)}}`);
}

function looksNumeric(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 24) return false;
  // Match: 123, 12.34, 1,234, 12%, $99, 12px, 2026-05-13, IDs like #4f3
  return /^[$#]?\d[\d.,:\-/%a-z]*$/i.test(trimmed) && /\d/.test(trimmed);
}
