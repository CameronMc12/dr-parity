/**
 * HTML-string-to-JSX converter.
 *
 * Strategy: parse the input with cheerio (already a project dependency,
 * never regex), walk the DOM, and serialise each node as JSX with the
 * required React-specific transforms:
 *
 *   - class       -> className
 *   - for         -> htmlFor
 *   - tabindex    -> tabIndex (and all standard HTML attrs camelCased)
 *   - SVG attrs   -> camelCased (stroke-width -> strokeWidth, etc.)
 *   - style="..." -> style={{ ... }} object form
 *   - boolean attrs preserved
 *   - data-*, aria-* preserved verbatim
 *   - void elements self-closed (<br />, <img />, etc.)
 *   - <script> / <style> wrapped with dangerouslySetInnerHTML
 *   - HTML comments stripped (or converted to {/* * /} on request)
 *
 * Custom elements (e.g. <a-link>, <swiper-slider>) pass through as-is;
 * the companion `jsx-custom-elements.d.ts` widens JSX.IntrinsicElements
 * inside the generated project so they typecheck.
 *
 * Escape hatch: any element whose tag is in `options.escapeHatchTags`
 * (or that matches `options.shouldEscapeHatch`) is emitted as a
 * `<div dangerouslySetInnerHTML={{ __html: '...' }} />` so callers can
 * sidestep edge cases that don't roundtrip cleanly through JSX.
 */

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

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

const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
]);

/**
 * Standard HTML/SVG attribute name remap. Anything not in this table that
 * contains a hyphen and isn't data-/aria-/SVG-namespaced gets hyphen-stripped
 * to camelCase below.
 */
const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  usemap: 'useMap',
  frameborder: 'frameBorder',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enctype: 'encType',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  marginwidth: 'marginWidth',
  marginheight: 'marginHeight',
  novalidate: 'noValidate',
  radiogroup: 'radioGroup',
  referrerpolicy: 'referrerPolicy',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  autocomplete: 'autoComplete',
  autocorrect: 'autoCorrect',
  autocapitalize: 'autoCapitalize',
  autoplay: 'autoPlay',
  autofocus: 'autoFocus',
  playsinline: 'playsInline',
  fetchpriority: 'fetchPriority',
  controlslist: 'controlsList',
  disableremoteplayback: 'disableRemotePlayback',
  disablepictureinpicture: 'disablePictureInPicture',
  imagesizes: 'imageSizes',
  imagesrcset: 'imageSrcSet',
  itemid: 'itemID',
  itemref: 'itemRef',
  itemprop: 'itemProp',
  itemtype: 'itemType',
  accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen',
  // SVG (subset of the common ones)
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity',
  'fill-rule': 'fillRule',
  'fill-opacity': 'fillOpacity',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'text-anchor': 'textAnchor',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-style': 'fontStyle',
  'baseline-shift': 'baselineShift',
  'dominant-baseline': 'dominantBaseline',
  'pointer-events': 'pointerEvents',
  'shape-rendering': 'shapeRendering',
  'text-rendering': 'textRendering',
  'image-rendering': 'imageRendering',
  'color-interpolation': 'colorInterpolation',
  'color-rendering': 'colorRendering',
  'vector-effect': 'vectorEffect',
  'enable-background': 'enableBackground',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'lighting-color': 'lightingColor',
  'marker-end': 'markerEnd',
  'marker-mid': 'markerMid',
  'marker-start': 'markerStart',
  'mask-type': 'maskType',
  'paint-order': 'paintOrder',
  'rendering-intent': 'renderingIntent',
  'underline-position': 'underlinePosition',
  'underline-thickness': 'underlineThickness',
  'unicode-bidi': 'unicodeBidi',
  'word-spacing': 'wordSpacing',
  'writing-mode': 'writingMode',
  'xlink:href': 'xlinkHref',
  'xlink:role': 'xlinkRole',
  'xlink:show': 'xlinkShow',
  'xlink:title': 'xlinkTitle',
  'xlink:type': 'xlinkType',
};

export interface HtmlToJsxOptions {
  /** Tags listed here are emitted as dangerouslySetInnerHTML wrappers. */
  escapeHatchTags?: ReadonlySet<string>;
  /** Predicate for per-element escape-hatching. */
  shouldEscapeHatch?: (el: Element) => boolean;
  /** Convert HTML comments to JSX comments; default strips them. */
  preserveComments?: boolean;
  /** Indent unit (used for pretty-printing). */
  indent?: string;
}

/**
 * Convert an arbitrary HTML string into a JSX fragment body.
 * Returns the JSX as a string (without surrounding `<>` / `</>`).
 */
export function htmlToJsx(html: string, options: HtmlToJsxOptions = {}): string {
  const trimmed = html.trim();
  if (trimmed.length === 0) return '';

  // Parse as a fragment. xmlMode=false lets cheerio do HTML-ish parsing,
  // but with `decodeEntities: false` so attribute values stay raw.
  const $ = cheerio.load(`<root>${trimmed}</root>`, {
    xml: false,
    // @ts-expect-error - cheerio's types are flaky here; the option is valid.
    decodeEntities: false,
  });

  const root = $('root').first();
  if (root.length === 0) return '';

  const rootEl = root.get(0) as Element;
  const parts: string[] = [];
  for (const child of (rootEl.children ?? []) as AnyNode[]) {
    const out = renderNode(child, $, options, 0);
    if (out.length > 0) parts.push(out);
  }
  return parts.join('\n');
}

function renderNode(
  node: AnyNode,
  $: cheerio.CheerioAPI,
  options: HtmlToJsxOptions,
  depth: number,
): string {
  if (node.type === 'text') {
    return renderText((node as { data?: string }).data ?? '');
  }
  if (node.type === 'comment') {
    if (!options.preserveComments) return '';
    const raw = ((node as { data?: string }).data ?? '').replace(/\*\//g, '*\\/');
    return `{/* ${raw} */}`;
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    return renderElement(node as Element, $, options, depth);
  }
  // cdata, directive, doctype etc — skip.
  return '';
}

/**
 * HTML elements whose content the HTML parser keeps as a single raw-text node
 * rather than parsing further. `<script>` and `<style>` already have dedicated
 * handling. `<noscript>`, `<textarea>`, and `<title>` also fall into this
 * bucket and would otherwise leak raw HTML (e.g. `<img ...>`, `style="..."`)
 * into the JSX output via `renderText`.
 */
const RAW_TEXT_ELEMENTS = new Set(['noscript', 'textarea', 'title']);

/**
 * Text node serialisation. JSX treats `{` and `}` as expression delimiters,
 * so any literal braces in the source must be escaped via `{'{'}` / `{'}'}`.
 * `<` and `>` are already handled by the parser turning them into entities.
 */
function renderText(text: string): string {
  if (text.length === 0) return '';
  // Whitespace-only between block elements: keep a single space so JSX
  // doesn't collapse semantic spacing, but strip pure indentation noise.
  if (/^\s+$/.test(text)) {
    return text.includes('\n') ? '' : ' ';
  }
  return text.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}");
}

function renderElement(
  el: Element,
  $: cheerio.CheerioAPI,
  options: HtmlToJsxOptions,
  depth: number,
): string {
  const tag = el.tagName;
  const escapeHatch =
    (options.escapeHatchTags?.has(tag) ?? false) ||
    (options.shouldEscapeHatch?.(el) ?? false);

  if (escapeHatch) {
    const inner = $(el).html() ?? '';
    return `<div dangerouslySetInnerHTML={{ __html: ${quoteForJs(inner)} }} />`;
  }

  // <script> / <style> require dangerouslySetInnerHTML.
  if (tag === 'script' || tag === 'style') {
    return renderScriptOrStyle(el, tag);
  }

  // <noscript>, <textarea>, <title>: HTML parser keeps inner content as a
  // single raw-text node. Emit via dangerouslySetInnerHTML so any HTML inside
  // (e.g. `<img>` tracking pixels, inline `style="..."`) doesn't leak as
  // unparsed JSX. <noscript> contents are inert in a React app anyway.
  if (RAW_TEXT_ELEMENTS.has(tag)) {
    return renderRawTextElement(el, tag);
  }

  const attrs = renderAttributes(el.attribs ?? {});
  const isVoid = VOID_ELEMENTS.has(tag);
  const children = (el.children ?? []) as AnyNode[];

  if (isVoid || children.length === 0) {
    return isVoid ? `<${tag}${attrs} />` : `<${tag}${attrs}></${tag}>`;
  }

  const renderedChildren: string[] = [];
  for (const child of children) {
    const out = renderNode(child, $, options, depth + 1);
    if (out.length > 0) renderedChildren.push(out);
  }

  const childContent = renderedChildren.join('');
  return `<${tag}${attrs}>${childContent}</${tag}>`;
}

function renderScriptOrStyle(el: Element, tag: 'script' | 'style'): string {
  const attribs = { ...el.attribs };
  // The original text content (script source / style rules) lives as a
  // single child text node for these element types.
  let raw = '';
  for (const child of (el.children ?? []) as AnyNode[]) {
    if (child.type === 'text' || child.type === 'script' || child.type === 'style') {
      raw += (child as { data?: string }).data ?? '';
    }
  }

  if (raw.length === 0) {
    const attrs = renderAttributes(attribs);
    return `<${tag}${attrs} />`;
  }

  const attrs = renderAttributes(attribs);
  return `<${tag}${attrs} dangerouslySetInnerHTML={{ __html: ${quoteForJs(raw)} }} />`;
}

/**
 * Render an HTML raw-text element (`<noscript>`, `<textarea>`, `<title>`).
 * The parser keeps the inner content as a single text node, so we route it
 * through `dangerouslySetInnerHTML` rather than letting it leak unparsed
 * markup into the JSX output.
 *
 * For `<textarea>`, React normally wants the value via the `defaultValue`
 * prop, but since the captured HTML may include nested tags/entities the
 * dangerouslySetInnerHTML escape hatch is the safest 1:1 reproduction.
 */
function renderRawTextElement(el: Element, tag: string): string {
  const attribs = { ...el.attribs };
  let raw = '';
  for (const child of (el.children ?? []) as AnyNode[]) {
    if (child.type === 'text') {
      raw += (child as { data?: string }).data ?? '';
    }
  }
  const attrs = renderAttributes(attribs);
  if (raw.length === 0) {
    return `<${tag}${attrs}></${tag}>`;
  }
  return `<${tag}${attrs} dangerouslySetInnerHTML={{ __html: ${quoteForJs(raw)} }} />`;
}

function renderAttributes(attribs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(attribs)) {
    if (rawValue === undefined || rawValue === null) continue;
    const lower = rawKey.toLowerCase();

    // data-* and aria-* pass through verbatim.
    if (lower.startsWith('data-') || lower.startsWith('aria-')) {
      parts.push(`${rawKey}=${quoteForJsx(rawValue)}`);
      continue;
    }

    // style="color: red" -> style={{ color: 'red' }}
    if (lower === 'style') {
      const obj = parseInlineStyle(rawValue);
      if (Object.keys(obj).length > 0) {
        parts.push(`style={${serialiseStyleObject(obj)}}`);
      }
      continue;
    }

    // Boolean attrs: `disabled`, `checked`, etc. In JSX they're emitted as
    // `disabled` (true). Empty string and attribute-with-same-name-as-value
    // both signal "true".
    if (BOOLEAN_ATTRS.has(lower)) {
      const jsxName = ATTR_MAP[lower] ?? camelise(rawKey);
      if (rawValue === '' || rawValue === lower || rawValue === 'true') {
        parts.push(jsxName);
      } else {
        parts.push(`${jsxName}=${quoteForJsx(rawValue)}`);
      }
      continue;
    }

    const jsxKey =
      ATTR_MAP[lower] ?? (lower.startsWith('on') && lower.length > 2 ? rawKey : camelise(rawKey));
    parts.push(`${jsxKey}=${quoteForJsx(rawValue)}`);
  }
  return parts.length === 0 ? '' : ' ' + parts.join(' ');
}

/**
 * Camel-case a hyphenated attribute name. Used for unknown attrs not in
 * ATTR_MAP. Preserves a leading namespace prefix (e.g. `xml:`) by skipping
 * it.
 */
function camelise(name: string): string {
  if (!name.includes('-') && !name.includes(':')) return name;
  // Preserve namespaced custom attrs (xlink:, xml:) verbatim — they're rare
  // and JSX accepts them as strings.
  if (name.includes(':')) return name;
  return name.replace(/-([a-z0-9])/gi, (_m, c: string) => c.toUpperCase());
}

function parseInlineStyle(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Split on `;` but tolerate `;` inside url(...) or other paren groups.
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) parts.push(buf);

  for (const decl of parts) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const rawProp = decl.slice(0, idx).trim();
    const rawVal = decl.slice(idx + 1).trim();
    if (rawProp.length === 0) continue;
    const prop = rawProp.startsWith('--') ? rawProp : cssPropToJs(rawProp);
    out[prop] = rawVal;
  }
  return out;
}

function cssPropToJs(prop: string): string {
  // Vendor prefixes: -webkit-foo -> WebkitFoo.
  if (prop.startsWith('-')) {
    return prop
      .slice(1)
      .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
      .replace(/^([a-z])/, (_m, c: string) => c.toUpperCase());
  }
  return prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

function serialiseStyleObject(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const k = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    parts.push(`${k}: ${JSON.stringify(value)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * Quote an attribute value for JSX. Simple string -> "..."; values that
 * contain curly braces or other JSX-hostile chars are wrapped as a JS string
 * expression: {'...'}
 */
function quoteForJsx(value: string): string {
  if (!/["{}\\]/.test(value) && !/[\r\n]/.test(value)) {
    return `"${value.replace(/&/g, '&amp;')}"`;
  }
  return `{${quoteForJs(value)}}`;
}

/**
 * Quote an arbitrary string for inclusion as a JS string literal. Uses
 * single quotes, escaping `\`, `'`, and newlines.
 */
function quoteForJs(value: string): string {
  return (
    "'" +
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n') +
    "'"
  );
}

export const __internal = {
  parseInlineStyle,
  cssPropToJs,
  serialiseStyleObject,
  camelise,
  quoteForJs,
  quoteForJsx,
};
