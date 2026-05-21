/**
 * Detect how an overlay closes: an explicit close button, the Escape key,
 * or a click on the backdrop. Falls back to `'unknown'`.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import type { StateEdge } from '../crawler/types';
import type { DismissStrategy } from './types';

const CLOSE_TEXT_RE = /^(×|x|✕|✖|close|cancel|dismiss)$/i;

export interface DismissResult {
  strategy: DismissStrategy;
  closeButtonSelector?: string;
}

function findCloseButton(toggleSubtreeHtml: string): string | undefined {
  const $ = cheerio.load(toggleSubtreeHtml, null, false);

  const ariaMatch = $('[aria-label*="close" i], [aria-label*="dismiss" i], [aria-label*="cancel" i]');
  if (ariaMatch.length > 0) {
    const el = ariaMatch.first();
    const id = el.attr('id');
    if (id) return `#${id}`;
    const label = el.attr('aria-label') ?? '';
    return `[aria-label="${label}"]`;
  }

  let textMatchSel: string | undefined;
  $('button, a[role="button"]').each((_i: number, el: any) => {
    if (textMatchSel) return;
    const text = $(el).text().trim();
    if (CLOSE_TEXT_RE.test(text)) {
      const id = $(el).attr('id');
      if (id) {
        textMatchSel = `#${id}`;
        return;
      }
      const tag = el.tagName ?? 'button';
      textMatchSel = `${tag}:contains("${text}")`;
    }
  });
  return textMatchSel;
}

export function detectDismissStrategy(
  toggleStateId: string,
  toggleSubtreeHtml: string,
  edges: StateEdge[],
): DismissResult {
  const closeButtonSelector = findCloseButton(toggleSubtreeHtml);
  if (closeButtonSelector) {
    return { strategy: 'explicit-close-button', closeButtonSelector };
  }

  for (const edge of edges) {
    if (edge.fromStateId !== toggleStateId) continue;
    if (
      edge.interaction.kind === 'keyboard' &&
      edge.interaction.keyCombo?.toLowerCase() === 'escape'
    ) {
      return { strategy: 'escape' };
    }
    const sel = edge.interaction.selector.toLowerCase();
    if (sel === 'body' || sel.includes('backdrop') || sel.includes('overlay')) {
      return { strategy: 'click-outside' };
    }
  }

  return { strategy: 'unknown' };
}
