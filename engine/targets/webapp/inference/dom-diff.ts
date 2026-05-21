/**
 * Compare two normalised DOM snapshots and classify the difference.
 *
 * "Overlay" = base body is fully present in target + target adds 1-2 new
 * top-level subtrees (modal/dropdown/portal). "inline-change" = something
 * inside the existing tree mutated, no new top-level subtree.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import type { DomDiff, DomDiffClassification, SerializedElement } from './types';

function serializeElement(el: any, $: any): SerializedElement {
  const attributes: Record<string, string> = {};
  const rawAttrs = (el.attribs ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries(rawAttrs)) attributes[k] = v;
  const $el = $(el);
  return {
    tag: (el.tagName as string) ?? 'div',
    attributes,
    innerHTML: $el.html() ?? '',
    outerHTML: $.html($el),
  };
}

function topLevelBodyChildren(html: string): { $: any; children: any[] } {
  const $ = cheerio.load(html, null, false);
  const body = $('body').length > 0 ? $('body') : $.root();
  const children: any[] = [];
  body.children().each((_i: number, el: any) => {
    if (el && el.type === 'tag') children.push(el);
  });
  return { $, children };
}

function fingerprintChild(el: any, $: any): string {
  const tag = (el.tagName as string) ?? 'div';
  const id = (el.attribs?.id as string) ?? '';
  const cls = (el.attribs?.class as string) ?? '';
  const role = (el.attribs?.role as string) ?? '';
  const html = $.html($(el));
  // Quick stable signature: tag + id + class + role + length bucket
  return `${tag}#${id}.${cls}[role=${role}][len=${html.length}]`;
}

function classify(
  added: SerializedElement[],
  removed: SerializedElement[],
): DomDiffClassification {
  if (added.length === 0 && removed.length === 0) return 'inline-change';
  if (removed.length === 0 && added.length > 0 && added.length <= 2) {
    return 'overlay';
  }
  if (added.length > 2 && removed.length > 2) return 'route-change';
  return 'mixed';
}

export function diffStates(baseDom: string, targetDom: string): DomDiff {
  const base = topLevelBodyChildren(baseDom);
  const target = topLevelBodyChildren(targetDom);

  const baseFingerprints = new Set(
    base.children.map((c) => fingerprintChild(c, base.$)),
  );
  const targetFingerprints = new Set(
    target.children.map((c) => fingerprintChild(c, target.$)),
  );

  const added: SerializedElement[] = [];
  for (const el of target.children) {
    const fp = fingerprintChild(el, target.$);
    if (!baseFingerprints.has(fp)) {
      added.push(serializeElement(el, target.$));
    }
  }

  const removed: SerializedElement[] = [];
  for (const el of base.children) {
    const fp = fingerprintChild(el, base.$);
    if (!targetFingerprints.has(fp)) {
      removed.push(serializeElement(el, base.$));
    }
  }

  return {
    added,
    removed,
    modifiedTextNodes: [],
    classification: classify(added, removed),
  };
}
