/**
 * Emit the conditional JSX that renders each overlay when its state is true.
 *
 * Pattern: `{stateVarOpen && (<div ref={ref}>...converted JSX...</div>)}`.
 *
 * For overlays with explicit-close-button dismissal we patch the close
 * button's onClick to call setter(false). For click-outside dismissal we
 * attach the ref to the overlay root.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { htmlToJsx } from '../../react/html-to-jsx';
import type { StateToggle } from '../inference/types';
import type { ToggleNames } from './name-deriver';

interface CloseButtonPlaceholder {
  marker: string;
  replacement: string;
}

function patchCloseButton(
  overlayHtml: string,
  closeButtonSelector: string,
  setter: string,
  marker: string,
): string {
  const $ = cheerio.load(overlayHtml, null, false);
  let target: any;
  try {
    if (closeButtonSelector.includes(':contains(')) {
      // Fallback: find button by text content
      const textMatch = /:contains\("([^"]+)"\)/.exec(closeButtonSelector);
      const text = textMatch?.[1] ?? '';
      target = $('button, a[role="button"]').filter((_i: number, el: any) => {
        return $(el).text().trim() === text;
      }).first();
    } else {
      target = $(closeButtonSelector).first();
    }
  } catch {
    return overlayHtml;
  }
  if (!target || target.length === 0) return overlayHtml;
  target.attr('data-dr-parity-handler', marker);
  return $.html();
}

export interface OverlayBlock {
  lines: string[];
}

function indentLines(input: string, prefix: string): string {
  return input.split('\n').map((l) => (l.length > 0 ? prefix + l : l)).join('\n');
}

export function emitOverlayBlocks(
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): OverlayBlock {
  const lines: string[] = [];

  pairs.forEach(({ toggle, names }, idx) => {
    const { stateVar, setter, refName } = names;
    const useRef = toggle.dismissStrategy === 'click-outside' || toggle.dismissStrategy === 'unknown';
    let overlayHtml = toggle.appearedRoot.outerHTML;

    let closeButtonReplacement: CloseButtonPlaceholder | null = null;
    if (
      (toggle.dismissStrategy === 'explicit-close-button' || toggle.dismissStrategy === 'unknown') &&
      toggle.closeButtonSelector
    ) {
      const marker = `__DR_PARITY_CLOSE_${idx}__`;
      overlayHtml = patchCloseButton(overlayHtml, toggle.closeButtonSelector, setter, marker);
      closeButtonReplacement = {
        marker,
        replacement: `onClick={() => ${setter}(false)}`,
      };
    }

    let jsx = htmlToJsx(overlayHtml).trim();

    if (closeButtonReplacement) {
      const attrRe = new RegExp(`data-dr-parity-handler="${closeButtonReplacement.marker}"`, 'g');
      jsx = jsx.replace(attrRe, closeButtonReplacement.replacement);
    }

    if (useRef) {
      // Inject ref={refName} onto the root JSX tag's opening
      jsx = jsx.replace(/^<(\w[\w-]*)/, `<$1 ref={${refName}}`);
    }

    lines.push(`      {${stateVar} && (`);
    lines.push(indentLines(jsx, '        '));
    lines.push(`      )}`);
  });

  return { lines };
}
