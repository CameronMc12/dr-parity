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
