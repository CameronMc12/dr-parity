/**
 * Shared types for the scope-styles pipeline.
 *
 * Consumes css-rules.json from extract-css and (optionally) token-map.json from
 * extract-tokens, and emits per-component scoped style blocks plus a global
 * stylesheet.
 */

import type { CssRule } from '../analyze/css/types';

export interface ComponentInfo {
  /** Absolute path to the .astro file. */
  filePath: string;
  /** Display name (file basename without extension). */
  name: string;
  /** Distinct CSS class names referenced inside the component markup. */
  classes: Set<string>;
}

export interface RuleClassIndex {
  /** Index in the original css-rules.json array. */
  ruleIndex: number;
  /** Distinct class names parsed out of the selector. May be empty. */
  classes: Set<string>;
  /** True when the rule has no class selector at all. */
  hasNoClassSelector: boolean;
}

export interface AssignmentResult {
  /** Map from component file path to ordered list of rule indices owned. */
  perComponent: Map<string, number[]>;
  /** Rule indices that did not land on any component (global rules). */
  global: number[];
}

export interface FlattenedTokenEntry {
  /** Token name without the leading `--`. */
  name: string;
  /** Original value as written in the token map. */
  value: string;
  /** Token category, used to bias substitution priority. */
  category: string;
}

export interface SubstitutionStats {
  /** Total number of value replacements performed across all rules. */
  totalReplacements: number;
}

export interface ScopeStylesSummary {
  componentsProcessed: number;
  rulesAssignedAvg: number;
  rulesAssignedMax: number;
  globalRules: number;
  tokenSubstitutions: number;
}

export interface RewrittenRule {
  rule: CssRule;
  declarations: CssRule['declarations'];
}

export type ScopeStylesMode = 'safe' | 'aggressive';

export interface ScopeStylesPlanComponent {
  file: string;
  assignedRuleIndices: number[];
}

export interface ScopeStylesPlanTokenSubstitution {
  rule: number;
  declaration: number;
  from: string;
  to: string;
}

export interface ScopeStylesPlan {
  mode: 'analysis-only';
  components: ScopeStylesPlanComponent[];
  globalRuleIndices: number[];
  tokenSubstitutions: ScopeStylesPlanTokenSubstitution[];
}
