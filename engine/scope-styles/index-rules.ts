/**
 * Read css-rules.json and, for each rule, extract every class name that
 * appears anywhere in its selector. Selectors with no class hits are flagged
 * so the assigner can route them straight to the global stylesheet.
 *
 * We intentionally use a simple regex pass rather than a full selector parser:
 * the upstream extractor has already split selector lists on top-level commas,
 * so every selector here is a single compound selector. Quoted strings inside
 * `[attr="value"]` are stripped first to avoid false positives.
 */

import type { CssRule } from '../analyze/css/types';
import type { RuleClassIndex } from './types';

const CLASS_RE = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
const STRING_RE = /(['"])(?:\\.|(?!\1).)*\1/g;

export function indexRules(rules: CssRule[]): RuleClassIndex[] {
  return rules.map((rule, ruleIndex) => {
    const classes = extractClassesFromSelector(rule.selector);
    return {
      ruleIndex,
      classes,
      hasNoClassSelector: classes.size === 0,
    };
  });
}

export function extractClassesFromSelector(selector: string): Set<string> {
  const sanitized = selector.replace(STRING_RE, '""');
  const out = new Set<string>();
  CLASS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLASS_RE.exec(sanitized)) !== null) {
    out.add(match[1]);
  }
  return out;
}
