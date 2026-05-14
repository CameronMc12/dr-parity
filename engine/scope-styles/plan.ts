/**
 * Write a non-destructive "what would happen" plan for scope-styles.
 *
 * Safe mode emits this JSON instead of mutating .astro files or writing
 * base.css. The plan records which rule indices would land on each component
 * and which would go global, but no source files are touched.
 *
 * Token substitutions are left as an empty array in safe mode: substitution
 * rewrites declaration values inline during aggressive emit, and the safe
 * pipeline never reads the token map.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CssRule } from '../analyze/css/types';
import type {
  AssignmentResult,
  ComponentInfo,
  ScopeStylesPlan,
} from './types';

export interface WritePlanOptions {
  analysisDir: string;
  rules: CssRule[];
  assignment: AssignmentResult;
  components: ComponentInfo[];
}

export function writePlan(options: WritePlanOptions): string {
  const { analysisDir, assignment, components } = options;

  const planComponents = components.map((c) => ({
    file: c.filePath,
    assignedRuleIndices: assignment.perComponent.get(c.filePath) ?? [],
  }));

  const plan: ScopeStylesPlan = {
    mode: 'analysis-only',
    components: planComponents,
    globalRuleIndices: assignment.global,
    tokenSubstitutions: [],
  };

  mkdirSync(analysisDir, { recursive: true });
  const planPath = join(analysisDir, 'scope-styles-plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  return planPath;
}
