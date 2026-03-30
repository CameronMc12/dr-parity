/**
 * QA, visual-diff, and comparison types.
 *
 * These types drive the iterative refinement loop: after each code-generation
 * pass the engine captures screenshots of the clone, compares them against the
 * original, scores the match, and produces actionable fix suggestions.
 */

import type { Rect } from './extraction';

// ---------------------------------------------------------------------------
// Top-level QA report
// ---------------------------------------------------------------------------

export interface QAReport {
  originalUrl: string;
  cloneUrl: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Overall fidelity score from 0 to 100. */
  overallScore: number;
  pixelDiff: PixelDiffResult;
  structureDiff: StructureDiffResult;
  sectionResults: SectionQAResult[];
  fixSuggestions: FixSuggestion[];
  /** Which refinement pass produced this report (1-based). */
  iteration: number;
  /** Whether the report meets the configured quality threshold. */
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Pixel-level comparison
// ---------------------------------------------------------------------------

export interface PixelDiffResult {
  desktop: ViewportDiff;
  tablet?: ViewportDiff;
  mobile?: ViewportDiff;
}

export interface ViewportDiff {
  viewport: { width: number; height: number };
  totalPixels: number;
  differentPixels: number;
  percentDifferent: number;
  /** File path to the original page screenshot. */
  originalScreenshot: string;
  /** File path to the clone page screenshot. */
  cloneScreenshot: string;
  /** File path to the diff-highlighted overlay image. */
  diffImage: string;
  sectionDiffs: SectionPixelDiff[];
}

export interface SectionPixelDiff {
  sectionId: string;
  sectionName: string;
  boundingRect: Rect;
  percentDifferent: number;
  /** File path to the cropped diff image for this section. */
  diffImage: string;
}

// ---------------------------------------------------------------------------
// Structural comparison
// ---------------------------------------------------------------------------

export interface StructureDiffResult {
  totalElements: { original: number; clone: number };
  /** Selectors present in the original but absent from the clone. */
  missingElements: string[];
  /** Selectors present in the clone but absent from the original. */
  extraElements: string[];
  textDifferences: TextDiff[];
  tagMismatches: TagMismatch[];
}

export interface TextDiff {
  selector: string;
  original: string;
  clone: string;
}

export interface TagMismatch {
  selector: string;
  originalTag: string;
  cloneTag: string;
}

// ---------------------------------------------------------------------------
// Per-section QA
// ---------------------------------------------------------------------------

export type SectionQAStatus = 'pass' | 'warning' | 'fail';

export interface SectionQAResult {
  sectionId: string;
  sectionName: string;
  /** Percentage of pixels that match (0-100). */
  pixelMatchPercent: number;
  structureMatch: boolean;
  animationMatch: boolean;
  issues: QAIssue[];
  status: SectionQAStatus;
}

// ---------------------------------------------------------------------------
// Issues & suggestions
// ---------------------------------------------------------------------------

export type QAIssueSeverity = 'critical' | 'major' | 'minor' | 'cosmetic';

export type QAIssueCategory =
  | 'layout'
  | 'color'
  | 'typography'
  | 'spacing'
  | 'animation'
  | 'content'
  | 'responsive';

export interface QAIssue {
  severity: QAIssueSeverity;
  category: QAIssueCategory;
  description: string;
  elementSelector?: string;
  expected: string;
  actual: string;
  /** Optional path to a cropped screenshot highlighting the issue. */
  screenshot?: string;
}

export interface FixSuggestion {
  sectionId: string;
  componentFile: string;
  /** Lower number = higher priority. */
  priority: number;
  issue: QAIssue;
  /** Human-readable description of the recommended fix. */
  suggestedFix: string;
  /** Whether the engine can apply this fix without human review. */
  autoFixable: boolean;
  codeChange?: {
    file: string;
    lineNumber?: number;
    oldCode?: string;
    newCode?: string;
  };
}
