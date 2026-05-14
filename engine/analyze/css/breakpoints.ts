/**
 * Breakpoint analysis.
 *
 * Walks every CssRule's `mediaQuery` and extracts `(min-width: X)` and
 * `(max-width: X)` thresholds. Results are deduped and sorted ascending by
 * pixel-equivalent value.
 */

import type { BreakpointEntry, CssRule } from './types';
import { parseDimension } from './dimensions';

const FEATURE_RE = /\((min-width|max-width)\s*:\s*([^)]+)\)/gi;

interface Acc {
  feature: 'min-width' | 'max-width';
  value: string;
  numeric: number;
  count: number;
}

export function analyseBreakpoints(rules: CssRule[]): BreakpointEntry[] {
  const map = new Map<string, Acc>();
  for (const rule of rules) {
    const mq = rule.mediaQuery;
    if (!mq) continue;
    FEATURE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FEATURE_RE.exec(mq)) !== null) {
      const feature = m[1].toLowerCase() as 'min-width' | 'max-width';
      const rawValue = m[2].trim();
      const dim = parseDimension(rawValue);
      if (!dim) continue;
      const pxValue = toPx(dim.value, dim.unit);
      const normalised = `${dim.value}${dim.unit || 'px'}`;
      const key = `${feature}|${normalised}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { feature, value: normalised, numeric: pxValue, count: 1 });
      }
    }
  }

  const out: BreakpointEntry[] = [...map.values()]
    .sort((a, b) => a.numeric - b.numeric || a.feature.localeCompare(b.feature))
    .map(({ feature, value, count }) => ({ feature, value, count }));
  return out;
}

function toPx(value: number, unit: string): number {
  switch (unit) {
    case '':
    case 'px':
      return value;
    case 'rem':
    case 'em':
      return value * 16;
    default:
      return value;
  }
}
