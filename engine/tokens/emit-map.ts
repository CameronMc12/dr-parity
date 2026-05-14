/**
 * Token map emitter for token-map.json.
 *
 * Produces a nested mapping from raw CSS value → `--token-name` per category.
 * Downstream `scope-styles.ts` consumes this to swap literal values for
 * `var(--token)` references in scoped component CSS.
 */

import type { CategorisedTokens, TokenMap } from './types';

export function buildTokenMap(tokens: CategorisedTokens): TokenMap {
  return {
    colors: indexEntries(tokens.colors),
    spacing: indexEntries(tokens.spacing),
    fontSizes: indexEntries(tokens.fontSizes),
    fontWeights: indexEntries(tokens.fontWeights),
    lineHeights: indexEntries(tokens.lineHeights),
    letterSpacings: indexEntries(tokens.letterSpacings),
    fontFamilies: indexEntries(tokens.fontFamilies),
    breakpoints: indexEntries(tokens.breakpoints),
    radius: indexEntries(tokens.radius),
    shadows: indexEntries(tokens.shadows),
  };
}

function indexEntries(
  entries: { name: string; value: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (e.value in out) continue;
    out[e.value] = `--${e.name}`;
  }
  return out;
}

export function emitTokenMapJson(map: TokenMap): string {
  return JSON.stringify(map, null, 2) + '\n';
}
