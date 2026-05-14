/**
 * Assign each indexed CSS rule to zero or more components.
 *
 * Rules with no class selector OR with class selectors that no component
 * references go to the global bucket. Rules that share at least one class with
 * a component land in that component's bucket (and may land in multiple
 * components — that's expected and preserves cascade ordering identically per
 * component because we keep the original rule index order within each bucket).
 */

import type { AssignmentResult, ComponentInfo, RuleClassIndex } from './types';

export function assignRules(
  components: ComponentInfo[],
  ruleIndex: RuleClassIndex[],
): AssignmentResult {
  const perComponent = new Map<string, number[]>();
  for (const c of components) {
    perComponent.set(c.filePath, []);
  }

  const global: number[] = [];

  for (const r of ruleIndex) {
    if (r.hasNoClassSelector) {
      global.push(r.ruleIndex);
      continue;
    }
    let matchedAny = false;
    for (const c of components) {
      if (intersects(r.classes, c.classes)) {
        perComponent.get(c.filePath)!.push(r.ruleIndex);
        matchedAny = true;
      }
    }
    if (!matchedAny) {
      global.push(r.ruleIndex);
    }
  }

  return { perComponent, global };
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const v of small) {
    if (large.has(v)) return true;
  }
  return false;
}
