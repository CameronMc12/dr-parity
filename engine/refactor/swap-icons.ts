import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { normaliseHtmlForCompare } from './load-maps';
import {
  PLACEHOLDER_ICON_ATTR,
  PLACEHOLDER_ICON_TAG,
} from './post-process';
import type { NormalisedSwapEntry } from './types';

const PRESERVED_ATTR_PREFIXES = ['id', 'role', 'style', 'data-', 'aria-'];

function shouldPreserveAttr(name: string): boolean {
  const lower = name.toLowerCase();
  for (const p of PRESERVED_ATTR_PREFIXES) {
    if (lower === p || lower.startsWith(p)) return true;
  }
  return false;
}

function buildIconAttrString($: CheerioAPI, el: Element): string {
  const attrs = el.attribs ?? {};
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (!shouldPreserveAttr(name)) continue;
    parts.push(`${name}="${escapeAttr(value)}"`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

export interface IconSwapResult {
  swapped: boolean;
  iconName?: string;
  blockedByProtection?: boolean;
}

export function trySwapIcon(
  $: CheerioAPI,
  el: Element,
  normalisedIndex: NormalisedSwapEntry[],
  isProtected = false,
): IconSwapResult {
  if (el.tagName.toLowerCase() !== 'svg') return { swapped: false };

  const outer = $.html(el);
  const key = normaliseHtmlForCompare(outer);

  const match = normalisedIndex.find((entry) => entry.normalisedKey === key);
  if (!match) return { swapped: false };

  if (isProtected) {
    return { swapped: false, blockedByProtection: true };
  }

  const attrString = buildIconAttrString($, el);
  const markerAttr = `${PLACEHOLDER_ICON_ATTR}="${escapeAttr(match.pascalName)}"`;
  const replacement = `<${PLACEHOLDER_ICON_TAG} ${markerAttr}${attrString}></${PLACEHOLDER_ICON_TAG}>`;
  $(el).replaceWith(replacement);

  return { swapped: true, iconName: match.pascalName };
}
