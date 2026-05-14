import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { CapturedSvg, NormalisedSvg } from './types';

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function serialiseAttributes(attrs: Record<string, string>): string {
  const entries = Object.entries(attrs)
    .map(([k, v]) => [k, collapseWhitespace(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([k, v]) => `${k}="${v}"`).join(' ');
}

function walkNode(node: AnyNode): string {
  if (node.type === 'text') {
    return collapseWhitespace((node as unknown as { data: string }).data ?? '');
  }
  if (
    node.type !== 'tag' &&
    node.type !== 'script' &&
    node.type !== 'style'
  ) {
    return '';
  }
  const el = node as Element;
  const attrs = serialiseAttributes(
    (el.attribs ?? {}) as Record<string, string>,
  );
  const children = (el.children ?? [])
    .map((c) => walkNode(c as AnyNode))
    .join('');
  const open = attrs ? `<${el.tagName} ${attrs}>` : `<${el.tagName}>`;
  return `${open}${children}</${el.tagName}>`;
}

function normaliseInner(innerHTML: string): string {
  const $ = load(`<root>${innerHTML}</root>`, { xmlMode: true });
  const root = $('root').get(0);
  if (!root) return '';
  return (root.children ?? [])
    .map((c) => walkNode(c as AnyNode))
    .join('');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

export function normaliseSvg(captured: CapturedSvg): NormalisedSvg {
  const attrString = serialiseAttributes(captured.attributes);
  const innerString = normaliseInner(captured.innerHTML);
  const normalisedHTML = `<svg ${attrString}>${innerString}</svg>`;
  const hash = hashContent(normalisedHTML);
  return { ...captured, normalisedHTML, hash };
}

export function normaliseAll(items: CapturedSvg[]): NormalisedSvg[] {
  return items.map(normaliseSvg);
}
