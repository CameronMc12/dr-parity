/**
 * Iterative QA fix loop.
 *
 * Orchestrates repeated screenshot-capture and pixel-diff cycles, producing
 * a QAReport after each iteration. The loop stops when the fidelity score
 * exceeds the configured threshold or the maximum number of iterations is
 * reached.
 *
 * This module does NOT auto-fix code. It identifies WHAT needs fixing and
 * WHERE, producing FixSuggestions that Claude Code agents consume.
 */

import type { Browser } from 'playwright';
import type {
  QAReport,
  FixSuggestion,
  ViewportDiff,
  PixelDiffResult,
  StructureDiffResult,
  SectionQAResult,
  QAIssue,
} from '../types/diff';
import { captureScreenshots } from './screenshotter';
import { runFullDiff, type ScreenshotPair } from './pixel-diff';
import {
  compareSections,
  type SectionInfo,
  type SectionCompareResult,
  type QuadrantAnalysis,
} from './section-comparator';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FixLoopOptions {
  originalUrl: string;
  cloneUrl: string;
  projectDir: string;
  maxIterations?: number;
  passThreshold?: number;
  outputDir?: string;
}

export interface FixLoopResult {
  iterations: QAReport[];
  finalScore: number;
  passed: boolean;
  totalFixesApplied: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_PASS_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeOverallScore(pixelDiff: PixelDiffResult): number {
  const diffs: ViewportDiff[] = [pixelDiff.desktop];
  if (pixelDiff.tablet) diffs.push(pixelDiff.tablet);
  if (pixelDiff.mobile) diffs.push(pixelDiff.mobile);

  const totalPercent = diffs.reduce((sum, d) => sum + d.percentDifferent, 0);
  const avgDiffPercent = totalPercent / diffs.length;

  return Number((100 - avgDiffPercent).toFixed(1));
}

function buildSectionResults(pixelDiff: PixelDiffResult): SectionQAResult[] {
  // Aggregate section diffs across viewports
  const sectionMap = new Map<string, number[]>();

  const collectSections = (vd: ViewportDiff | undefined): void => {
    if (!vd) return;
    for (const sd of vd.sectionDiffs) {
      const existing = sectionMap.get(sd.sectionId) ?? [];
      existing.push(sd.percentDifferent);
      sectionMap.set(sd.sectionId, existing);
    }
  };

  collectSections(pixelDiff.desktop);
  collectSections(pixelDiff.tablet);
  collectSections(pixelDiff.mobile);

  return Array.from(sectionMap.entries()).map(([sectionId, diffs]) => {
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const matchPercent = Number((100 - avgDiff).toFixed(1));
    const status = matchPercent >= 95 ? 'pass' : matchPercent >= 85 ? 'warning' : 'fail';

    return {
      sectionId,
      sectionName: sectionId,
      pixelMatchPercent: matchPercent,
      structureMatch: true,
      animationMatch: true,
      issues: [],
      status,
    };
  });
}

function generateFixSuggestions(
  pixelDiff: PixelDiffResult,
  iteration: number,
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  let priority = 1;

  const analyzeViewport = (vd: ViewportDiff | undefined, viewportName: string): void => {
    if (!vd || vd.percentDifferent < 1) return;

    const issue: QAIssue = {
      severity: vd.percentDifferent > 20 ? 'critical' : vd.percentDifferent > 10 ? 'major' : 'minor',
      category: 'layout',
      description: `${viewportName} viewport has ${vd.percentDifferent}% pixel difference`,
      expected: 'Pixel-perfect match with original',
      actual: `${vd.percentDifferent}% pixels differ`,
      screenshot: vd.diffImage,
    };

    suggestions.push({
      sectionId: `viewport-${viewportName}`,
      componentFile: 'src/app/page.tsx',
      priority,
      issue,
      suggestedFix: `Review diff image at ${vd.diffImage} and adjust layout/styling for ${viewportName} viewport`,
      autoFixable: false,
    });

    priority++;
  };

  analyzeViewport(pixelDiff.desktop, 'desktop');
  analyzeViewport(pixelDiff.tablet, 'tablet');
  analyzeViewport(pixelDiff.mobile, 'mobile');

  return suggestions;
}

function buildEmptyStructureDiff(): StructureDiffResult {
  return {
    totalElements: { original: 0, clone: 0 },
    missingElements: [],
    extraElements: [],
    textDifferences: [],
    tagMismatches: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the iterative QA comparison loop.
 *
 * Each iteration:
 * 1. Captures screenshots of original vs clone
 * 2. Runs pixel-diff analysis
 * 3. Generates a QAReport with score and suggestions
 * 4. Stops early if the score meets the pass threshold
 *
 * The returned FixSuggestions are consumed by Claude Code agents for
 * targeted code fixes. This module never modifies code directly.
 */
export async function runFixLoop(
  browser: Browser,
  options: FixLoopOptions,
): Promise<FixLoopResult> {
  const {
    originalUrl,
    cloneUrl,
    projectDir,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    passThreshold = DEFAULT_PASS_THRESHOLD,
    outputDir = `${projectDir}/docs/design-references/qa`,
  } = options;

  const iterations: QAReport[] = [];
  let finalScore = 0;
  let passed = false;

  for (let i = 1; i <= maxIterations; i++) {
    const iterationDir = `${outputDir}/iteration-${i}`;

    // 1. Capture screenshots
    const screenshots = await captureScreenshots(browser, {
      originalUrl,
      cloneUrl,
      outputDir: iterationDir,
    });

    // 2. Build pairs for diffing
    const pairs: ScreenshotPair[] = [
      { original: screenshots.original.desktop, clone: screenshots.clone.desktop, viewport: 'desktop' },
    ];

    if (screenshots.original.tablet && screenshots.clone.tablet) {
      pairs.push({ original: screenshots.original.tablet, clone: screenshots.clone.tablet, viewport: 'tablet' });
    }
    if (screenshots.original.mobile && screenshots.clone.mobile) {
      pairs.push({ original: screenshots.original.mobile, clone: screenshots.clone.mobile, viewport: 'mobile' });
    }

    // 3. Run pixel-diff
    const pixelDiff = await runFullDiff(pairs, {
      outputDir: iterationDir,
      threshold: 0.1,
    });

    // 4. Compute score
    const overallScore = computeOverallScore(pixelDiff);
    finalScore = overallScore;
    passed = overallScore >= (100 - passThreshold);

    // 5. Build report
    const sectionResults = buildSectionResults(pixelDiff);
    const fixSuggestions = passed ? [] : generateFixSuggestions(pixelDiff, i);

    const report: QAReport = {
      originalUrl,
      cloneUrl,
      timestamp: new Date().toISOString(),
      overallScore,
      pixelDiff,
      structureDiff: buildEmptyStructureDiff(),
      sectionResults,
      fixSuggestions,
      iteration: i,
      passed,
    };

    iterations.push(report);

    // Log progress
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[QA Iteration ${i}/${maxIterations}] Score: ${overallScore}% — ${status}`);

    if (passed) {
      console.log(`Target threshold met (>= ${100 - passThreshold}%). Stopping.`);
      break;
    }

    if (fixSuggestions.length > 0) {
      console.log(`Fix suggestions (${fixSuggestions.length}):`);
      for (const s of fixSuggestions) {
        console.log(`  [${s.issue.severity}] ${s.issue.description}`);
      }
    }

    if (i < maxIterations) {
      console.log('Waiting for fixes before next iteration...');
    }
  }

  return {
    iterations,
    finalScore,
    passed,
    totalFixesApplied: 0,
  };
}

// ---------------------------------------------------------------------------
// Section-by-section fix loop
// ---------------------------------------------------------------------------

export interface SectionFixLoopOptions {
  originalUrl: string;
  cloneUrl: string;
  sections: SectionInfo[];
  projectDir: string;
  /** Max fix iterations per failing section (default 2). */
  maxIterationsPerSection?: number;
  /** Pixel-match percent to consider a section passing (default 95). */
  passThreshold?: number;
  outputDir?: string;
}

export interface SectionFixLoopResult {
  sectionResults: SectionFixResult[];
  overallScore: number;
  allPassed: boolean;
}

export interface SectionFixResult {
  sectionId: string;
  sectionName: string;
  iterations: number;
  finalMatchPercent: number;
  passed: boolean;
  fixSuggestions: string[];
}

// ---------------------------------------------------------------------------
// Section fix-loop helpers
// ---------------------------------------------------------------------------

const DEFAULT_SECTION_MAX_ITERATIONS = 2;
const DEFAULT_SECTION_PASS_THRESHOLD = 95;

/**
 * Describe which quadrant(s) contain the most diff pixels, producing a
 * human-readable hint so fix agents know WHERE to look.
 */
function describeQuadrantConcentration(q: QuadrantAnalysis): string {
  const entries: Array<{ label: string; value: number }> = [
    { label: 'top-left', value: q.topLeft },
    { label: 'top-right', value: q.topRight },
    { label: 'bottom-left', value: q.bottomLeft },
    { label: 'bottom-right', value: q.bottomRight },
  ];

  // Sort descending by diff density
  entries.sort((a, b) => b.value - a.value);

  const dominant = entries[0]!;
  if (dominant.value < 1) return 'Diff is evenly distributed (no dominant region)';

  const significantRegions = entries
    .filter((e) => e.value >= dominant.value * 0.5 && e.value > 1)
    .map((e) => `${e.label} (${e.value}%)`)
    .join(', ');

  return `Diff concentrated in: ${significantRegions}`;
}

/**
 * Generate a human-readable fix suggestion from a section comparison result.
 */
function buildSectionFixSuggestion(
  result: SectionCompareResult,
): string {
  const quadrantHint = describeQuadrantConcentration(result.diffQuadrants);

  const possibleCauses: string[] = [];

  // Infer likely causes from quadrant patterns
  const { topLeft, topRight, bottomLeft, bottomRight } = result.diffQuadrants;
  const topTotal = topLeft + topRight;
  const bottomTotal = bottomLeft + bottomRight;
  const leftTotal = topLeft + bottomLeft;
  const rightTotal = topRight + bottomRight;

  if (topTotal > bottomTotal * 2) {
    possibleCauses.push('likely missing/wrong header element, background image, or top padding');
  }
  if (bottomTotal > topTotal * 2) {
    possibleCauses.push('likely wrong bottom spacing, missing element, or footer mismatch');
  }
  if (leftTotal > rightTotal * 2) {
    possibleCauses.push('likely text positioning or left-column content mismatch');
  }
  if (rightTotal > leftTotal * 2) {
    possibleCauses.push('likely missing right-side visual, image, or decoration');
  }

  // Uniform diff suggests global issues
  const allSimilar =
    Math.abs(topLeft - topRight) < 5 &&
    Math.abs(topLeft - bottomLeft) < 5 &&
    Math.abs(topLeft - bottomRight) < 5;
  if (allSimilar && topLeft > 3) {
    possibleCauses.push('likely global style issue (background color, font-size, or overall spacing)');
  }

  const causeStr =
    possibleCauses.length > 0 ? ` (${possibleCauses.join('; ')})` : '';

  return (
    `Section '${result.sectionName}' at scroll ${0}: ` +
    `${result.pixelMatchPercent}% match. ` +
    `${quadrantHint}${causeStr}`
  );
}

// ---------------------------------------------------------------------------
// Public API — Section fix loop
// ---------------------------------------------------------------------------

/**
 * Run a section-by-section QA comparison and fix loop.
 *
 * For each section in topology order:
 * 1. Compare original vs clone at the section's scroll position
 * 2. If the section passes the threshold, move on
 * 3. If it fails, generate a fix suggestion and log it
 * 4. After external fixes are applied, re-compare (up to maxIterationsPerSection)
 *
 * This module does NOT apply fixes. It identifies what needs fixing and where,
 * producing human-readable suggestions that Claude Code agents consume.
 */
export async function runSectionFixLoop(
  browser: Browser,
  options: SectionFixLoopOptions,
): Promise<SectionFixLoopResult> {
  const {
    originalUrl,
    cloneUrl,
    sections,
    projectDir,
    maxIterationsPerSection = DEFAULT_SECTION_MAX_ITERATIONS,
    passThreshold = DEFAULT_SECTION_PASS_THRESHOLD,
    outputDir = `${projectDir}/docs/design-references/qa-sections`,
  } = options;

  const sectionResults: SectionFixResult[] = [];

  for (const section of sections) {
    let currentIteration = 0;
    let lastMatchPercent = 0;
    let passed = false;
    const fixSuggestions: string[] = [];

    while (currentIteration < maxIterationsPerSection) {
      currentIteration++;
      const iterDir = `${outputDir}/iteration-${currentIteration}`;

      // Compare just this one section
      const results = await compareSections(browser, {
        originalUrl,
        cloneUrl,
        sections: [section],
        outputDir: iterDir,
        threshold: passThreshold,
      });

      const result = results[0];
      if (!result) {
        console.error(`[Section QA] No result for section '${section.name}'`);
        break;
      }

      lastMatchPercent = result.pixelMatchPercent;
      passed = result.passed;

      const status = passed ? 'PASS' : 'FAIL';
      console.log(
        `[Section QA] ${section.name} — iteration ${currentIteration}: ` +
          `${lastMatchPercent}% match — ${status}`,
      );

      if (passed) break;

      // Generate fix suggestion
      const suggestion = buildSectionFixSuggestion(result);
      fixSuggestions.push(suggestion);
      console.log(`  Fix suggestion: ${suggestion}`);

      if (currentIteration < maxIterationsPerSection) {
        console.log(`  Waiting for fixes before re-comparing '${section.name}'...`);
      }
    }

    sectionResults.push({
      sectionId: section.id,
      sectionName: section.name,
      iterations: currentIteration,
      finalMatchPercent: lastMatchPercent,
      passed,
      fixSuggestions,
    });
  }

  const totalMatch = sectionResults.reduce((sum, r) => sum + r.finalMatchPercent, 0);
  const overallScore =
    sectionResults.length > 0
      ? Number((totalMatch / sectionResults.length).toFixed(1))
      : 100;
  const allPassed = sectionResults.every((r) => r.passed);

  return { sectionResults, overallScore, allPassed };
}
