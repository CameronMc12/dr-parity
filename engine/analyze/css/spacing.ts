/**
 * Spacing analysis.
 *
 * Pulls dimension values out of `margin*`, `padding*`, `gap`, position offsets,
 * and width/height. Splits shorthand values (e.g. `8px 16px`) into their
 * components. Clusters within a 5 percent tolerance per unit.
 */

import type { CssRule, SpacingClusterEntry } from './types';
import { parseSpacingDimensions, formatDimension } from './dimensions';

interface SpacingHit {
  value: number;
  unit: string;
  selector: string;
  prop: string;
}

const SPACING_PROP_RE = /^(margin|padding)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$/;
const RECT_PROPS = new Set(['top', 'right', 'bottom', 'left', 'inset', 'inset-block', 'inset-inline', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'gap', 'row-gap', 'column-gap']);

export function analyseSpacing(rules: CssRule[]): SpacingClusterEntry[] {
  const hits: SpacingHit[] = [];

  for (const rule of rules) {
    for (const decl of rule.declarations) {
      const prop = decl.prop.toLowerCase();
      if (!isSpacingProp(prop)) continue;
      const dims = parseSpacingDimensions(decl.value);
      for (const dim of dims) {
        hits.push({
          value: dim.value,
          unit: dim.unit,
          selector: rule.selector,
          prop,
        });
      }
    }
  }

  return clusterHits(hits);
}

function isSpacingProp(prop: string): boolean {
  if (SPACING_PROP_RE.test(prop)) return true;
  if (RECT_PROPS.has(prop)) return true;
  return false;
}

function clusterHits(hits: SpacingHit[]): SpacingClusterEntry[] {
  const byUnit = new Map<string, SpacingHit[]>();
  for (const hit of hits) {
    const arr = byUnit.get(hit.unit);
    if (arr) arr.push(hit);
    else byUnit.set(hit.unit, [hit]);
  }

  const clusters: SpacingClusterEntry[] = [];
  for (const [unit, group] of byUnit) {
    group.sort((a, b) => a.value - b.value);
    let current: { centre: number; count: number; selectors: string[]; contexts: Set<string> } | null = null;
    for (const hit of group) {
      if (current && withinTolerance(current.centre, hit.value, 0.05)) {
        current.centre = (current.centre * current.count + hit.value) / (current.count + 1);
        current.count++;
        current.contexts.add(hit.prop);
        if (current.selectors.length < 5 && !current.selectors.includes(hit.selector)) {
          current.selectors.push(hit.selector);
        }
      } else {
        if (current) clusters.push(materialise(current, unit));
        current = {
          centre: hit.value,
          count: 1,
          selectors: [hit.selector],
          contexts: new Set([hit.prop]),
        };
      }
    }
    if (current) clusters.push(materialise(current, unit));
  }

  clusters.sort((a, b) => {
    const ua = unitOrder(a.value);
    const ub = unitOrder(b.value);
    if (ua !== ub) return ua - ub;
    return parseFloat(a.value) - parseFloat(b.value);
  });

  return clusters;
}

function materialise(
  current: { centre: number; count: number; selectors: string[]; contexts: Set<string> },
  unit: string,
): SpacingClusterEntry {
  return {
    value: formatDimension(current.centre, unit),
    count: current.count,
    contexts: [...current.contexts].sort(),
    selectors: current.selectors,
  };
}

function withinTolerance(centre: number, candidate: number, tol: number): boolean {
  if (centre === 0) return Math.abs(candidate) < tol;
  return Math.abs(candidate - centre) / Math.abs(centre) <= tol;
}

const UNIT_RANK: Record<string, number> = {
  '': 0, px: 1, rem: 2, em: 3, '%': 4, vw: 5, vh: 6, vmin: 7, vmax: 8, ch: 9,
};

function unitOrder(value: string): number {
  const match = /[a-z%]+$/i.exec(value);
  const unit = match ? match[0].toLowerCase() : '';
  return UNIT_RANK[unit] ?? 99;
}
