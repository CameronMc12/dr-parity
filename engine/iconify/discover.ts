import { readFile } from 'node:fs/promises';
import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { CapturedSvg } from './types';

function attrsToRecord(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = (el.attribs ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function firstNonEmptyClass(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

function buildParentSelector($: CheerioAPI, $svg: Cheerio<Element>): string {
  const parent = $svg.parent();
  if (parent.length === 0) return '';
  const parentEl = parent.get(0);
  if (!parentEl || parentEl.type !== 'tag') return '';

  const tag = parentEl.tagName;
  const classAttr = parentEl.attribs?.class;
  const idAttr = parentEl.attribs?.id;

  let selector = tag;
  if (idAttr) selector += `#${idAttr}`;
  if (classAttr) {
    const cls = classAttr.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    if (cls) selector += `.${cls}`;
  }
  void $;
  return selector;
}

export async function discoverSvgs(htmlPath: string): Promise<CapturedSvg[]> {
  const html = await readFile(htmlPath, 'utf-8');
  const $ = load(html, { xmlMode: false });

  const captured: CapturedSvg[] = [];

  $('svg').each((_, raw) => {
    const el = raw as Element;
    const $svg = $(el);

    const attrs = attrsToRecord(el);
    const innerHTML = $svg.html() ?? '';
    const outerHTMLValue = $.html($svg);
    const outerHTML = typeof outerHTMLValue === 'string' ? outerHTMLValue : '';

    const parent = $svg.parent();
    const parentClassRaw =
      parent.length > 0 ? (parent.get(0) as Element).attribs?.class : undefined;

    captured.push({
      outerHTML,
      innerHTML,
      attributes: attrs,
      ariaLabel: attrs['aria-label'] ?? null,
      dataIcon: attrs['data-icon'] ?? null,
      dataName: attrs['data-name'] ?? null,
      firstClass: firstNonEmptyClass(attrs.class),
      parentClass: parentClassRaw ?? null,
      parentSelector: buildParentSelector($, $svg),
    });
  });

  return captured;
}
