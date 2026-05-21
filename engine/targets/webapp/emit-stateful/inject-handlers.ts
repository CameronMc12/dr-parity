/**
 * Inject onClick handlers into the base HTML at the trigger selectors,
 * then convert to JSX. Operating on HTML (before JSX conversion) lets us
 * use real CSS selectors via cheerio instead of regex on JSX.
 *
 * Trick: cheerio doesn't preserve attribute values containing braces well,
 * so we insert a placeholder string and substitute it after htmlToJsx
 * runs. The placeholder is unique per toggle.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { htmlToJsx } from '../../react/html-to-jsx';
import type { StateToggle } from '../inference/types';
import type { ToggleNames } from './name-deriver';

interface Placeholder {
  marker: string;
  replacement: string;
}

function safeSelector(selector: string): string | null {
  const trimmed = selector.trim();
  if (trimmed.length === 0) return null;
  // cheerio's selector engine doesn't support :scope or pseudo-elements;
  // anything non-CSS is bypassed.
  if (trimmed.startsWith('text=') || trimmed.includes(':contains(')) return null;
  return trimmed;
}

export interface InjectedJsx {
  jsx: string;
  /** Toggles whose selector failed to match anything; logged for review. */
  unmatched: string[];
}

export function injectTriggerHandlers(
  baseHtml: string,
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): InjectedJsx {
  if (pairs.length === 0) {
    return { jsx: htmlToJsx(baseHtml), unmatched: [] };
  }

  const $ = cheerio.load(baseHtml, null, false);
  const placeholders: Placeholder[] = [];
  const unmatched: string[] = [];

  pairs.forEach(({ toggle, names }, idx) => {
    const sel = safeSelector(toggle.triggerSelector);
    if (!sel) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    let target: any;
    try {
      target = $(sel).first();
    } catch {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    if (!target || target.length === 0) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    const marker = `__DR_PARITY_ONCLICK_${idx}__`;
    target.attr('data-dr-parity-handler', marker);
    placeholders.push({
      marker,
      replacement: `onClick={() => ${names.setter}(true)}`,
    });
  });

  const patchedHtml = $.html();
  let jsx = htmlToJsx(patchedHtml);

  for (const ph of placeholders) {
    const attrRe = new RegExp(`data-dr-parity-handler="${ph.marker}"`, 'g');
    jsx = jsx.replace(attrRe, ph.replacement);
  }

  return { jsx, unmatched };
}
