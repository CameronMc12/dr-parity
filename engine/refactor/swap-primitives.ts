import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import {
  PLACEHOLDER_COMPONENT_ATTR,
  PLACEHOLDER_COMPONENT_TAG,
  PLACEHOLDER_SELF_CLOSE_ATTR,
} from './post-process';
import type { PrimitiveMap, PrimitiveMapEntry } from './types';

export interface PrimitiveSwapResult {
  swapped: boolean;
  primitiveName?: string;
  blockedByProtection?: boolean;
}

interface PrimitiveResolution {
  entry: PrimitiveMapEntry;
  matchedClass: string | null;
  source: 'class' | 'tag';
}

function getClassList(el: Element): string[] {
  const cls = el.attribs?.class;
  if (!cls) return [];
  return cls.split(/\s+/).filter(Boolean);
}

function resolveByClass(
  classList: string[],
  byClass: Record<string, PrimitiveMapEntry>,
): PrimitiveResolution | null {
  const matches: Array<{ matched: string; entry: PrimitiveMapEntry }> = [];
  for (const c of classList) {
    const e = byClass[c];
    if (e) matches.push({ matched: c, entry: e });
  }
  if (matches.length === 0) return null;

  const chosenPrimitive = matches[0].entry.primitive;
  const relevant = matches.filter((m) => m.entry.primitive === chosenPrimitive);

  let variant: string | null = null;
  let size: string | null = null;
  let baseMatched: string | null = null;
  for (const m of relevant) {
    if (m.entry.variant !== null) variant = m.entry.variant;
    if (m.entry.size !== null) size = m.entry.size;
    if (m.entry.variant === null && m.entry.size === null) baseMatched = m.matched;
  }
  if (baseMatched === null) baseMatched = relevant[0].matched;

  return {
    entry: { primitive: chosenPrimitive, variant, size },
    matchedClass: baseMatched,
    source: 'class',
  };
}

function resolveByTag(
  tag: string,
  byTag: Record<string, PrimitiveMapEntry>,
): PrimitiveResolution | null {
  const entry = byTag[tag];
  if (!entry) return null;
  return { entry, matchedClass: null, source: 'tag' };
}

function buildPropString(
  el: Element,
  resolution: PrimitiveResolution,
  defaultTag: string | null,
): string {
  const attrs = { ...(el.attribs ?? {}) };
  const props: string[] = [];

  if (resolution.entry.variant) {
    props.push(`variant="${resolution.entry.variant}"`);
  }
  if (resolution.entry.size) {
    props.push(`size="${resolution.entry.size}"`);
  }

  const originalTag = el.tagName.toLowerCase();
  if (
    resolution.source === 'class' &&
    defaultTag !== null &&
    originalTag !== defaultTag.toLowerCase()
  ) {
    props.push(`as="${originalTag}"`);
  }

  if (resolution.source === 'class' && attrs.class) {
    const remaining = attrs.class
      .split(/\s+/)
      .filter(Boolean)
      .filter((c) => c !== resolution.matchedClass);
    if (remaining.length > 0) {
      props.push(`class="${escapeAttr(remaining.join(' '))}"`);
    }
    delete attrs.class;
  } else if (resolution.source === 'tag' && attrs.class) {
    props.push(`class="${escapeAttr(attrs.class)}"`);
    delete attrs.class;
  }

  for (const [name, value] of Object.entries(attrs)) {
    props.push(`${name}="${escapeAttr(value)}"`);
  }

  return props.length > 0 ? ' ' + props.join(' ') : '';
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

export function trySwapPrimitive(
  $: CheerioAPI,
  el: Element,
  map: PrimitiveMap,
  isProtected = false,
): PrimitiveSwapResult {
  const classList = getClassList(el);
  const byClassResolution = resolveByClass(classList, map.byClass);
  const tag = el.tagName.toLowerCase();
  const byTagResolution = byClassResolution ? null : resolveByTag(tag, map.byTag);

  const resolution = byClassResolution ?? byTagResolution;
  if (!resolution) return { swapped: false };

  if (isProtected) {
    if (resolution.source === 'tag') {
      console.warn(
        `[refactor] byTag "${tag}" → ${resolution.entry.primitive} blocked by protection (custom element or JS-bound ancestor)`,
      );
    }
    return { swapped: false, blockedByProtection: true };
  }

  const componentName = resolution.entry.primitive;
  const propString = buildPropString(el, resolution, null);
  const markerAttr = `${PLACEHOLDER_COMPONENT_ATTR}="${escapeAttr(componentName)}"`;

  const innerHtml = $(el).html() ?? '';
  let replacement: string;
  if (innerHtml.trim().length === 0) {
    replacement = `<${PLACEHOLDER_COMPONENT_TAG} ${markerAttr} ${PLACEHOLDER_SELF_CLOSE_ATTR}="1"${propString}></${PLACEHOLDER_COMPONENT_TAG}>`;
  } else {
    replacement = `<${PLACEHOLDER_COMPONENT_TAG} ${markerAttr}${propString}>${innerHtml}</${PLACEHOLDER_COMPONENT_TAG}>`;
  }

  $(el).replaceWith(replacement);
  return { swapped: true, primitiveName: componentName };
}
