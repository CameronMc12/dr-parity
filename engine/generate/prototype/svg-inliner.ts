/**
 * Walks an ElementSpec tree and collects any inline `<svg>` strings.
 *
 * Hard rule from spec: no emoji as icons. Whenever the source DOM has an
 * `<svg>`, copy the markup verbatim (cleaned of data-* noise) so the prototype
 * renders real SVG, not Unicode glyphs.
 */

import type { ElementSpec } from '../../types/extraction';

export interface InlinedSvg {
  /** Stable id derived from element id/classes, used as React key. */
  id: string;
  /** Cleaned SVG markup ready to embed directly in JSX. */
  markup: string;
}

export function collectInlineSvgs(element: ElementSpec, acc: InlinedSvg[] = []): InlinedSvg[] {
  if (element.tag.toLowerCase() === 'svg' && element.innerHTML) {
    acc.push({
      id: element.id ?? element.classes[0] ?? `svg-${acc.length}`,
      markup: cleanSvg(reconstructSvg(element)),
    });
  }
  for (const child of element.children) collectInlineSvgs(child, acc);
  return acc;
}

/** Rebuild `<svg>...</svg>` from the ElementSpec (attributes + innerHTML). */
export function reconstructSvg(element: ElementSpec): string {
  const attrs = Object.entries(element.attributes)
    .filter(([k]) => !k.startsWith('data-'))
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(' ');
  const open = attrs ? `<svg ${attrs}>` : '<svg>';
  return `${open}${element.innerHTML ?? ''}</svg>`;
}

export function cleanSvg(raw: string): string {
  let svg = raw.trim();
  svg = svg.replace(/\s+data-[a-z-]+="[^"]*"/gi, '');
  // Default to currentColor when nothing is set, so token-driven CSS wins.
  if (!/<svg[^>]*\sfill=/i.test(svg)) svg = svg.replace(/<svg/i, '<svg fill="currentColor"');
  return svg;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}
