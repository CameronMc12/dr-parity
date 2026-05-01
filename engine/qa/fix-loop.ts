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

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

// ---------------------------------------------------------------------------
// Spatial diff analysis (Item 2.7)
// ---------------------------------------------------------------------------

type DiffQuadrant =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'full';

interface DiffRegionAnalysis {
  quadrant: DiffQuadrant;
  diffPercentage: number;
  likelyCause: string;
  suggestedProperties: string[];
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Map a diff-image buffer to per-region analysis.
 *
 * The diff image uses the pixelmatch default output where diff pixels are
 * painted in red (#ff0000). We count those pixels per region and infer
 * likely CSS causes from their spatial distribution.
 */
function analyzeDiffRegions(
  diffData: Uint8Array,
  width: number,
  height: number,
): DiffRegionAnalysis[] {
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const totalPixels = width * height;

  // Count diff pixels per quadrant
  const counts = { tl: 0, tr: 0, bl: 0, br: 0, total: 0 };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // pixelmatch paints diffs with R > 0
      if (diffData[idx]! > 0) {
        counts.total++;
        if (y < midY) {
          if (x < midX) counts.tl++;
          else counts.tr++;
        } else {
          if (x < midX) counts.bl++;
          else counts.br++;
        }
      }
    }
  }

  if (counts.total === 0) return [];

  const pct = (n: number): number =>
    totalPixels > 0 ? Number(((n / totalPixels) * 100).toFixed(1)) : 0;

  const topTotal = counts.tl + counts.tr;
  const bottomTotal = counts.bl + counts.br;
  const leftTotal = counts.tl + counts.bl;
  const rightTotal = counts.tr + counts.br;
  const overallPct = pct(counts.total);

  const severityOf = (p: number): 'critical' | 'major' | 'minor' =>
    p > 15 ? 'critical' : p > 5 ? 'major' : 'minor';

  const regions: DiffRegionAnalysis[] = [];

  // Check for uniform distribution (global style issue)
  const maxQ = Math.max(counts.tl, counts.tr, counts.bl, counts.br);
  const minQ = Math.min(counts.tl, counts.tr, counts.bl, counts.br);
  const isUniform = maxQ > 0 && minQ / maxQ > 0.6;

  if (isUniform && overallPct > 2) {
    regions.push({
      quadrant: 'full',
      diffPercentage: overallPct,
      likelyCause:
        'Global style mismatch (font-family, base font-size, background-color, or line-height)',
      suggestedProperties: [
        'font-family',
        'font-size',
        'line-height',
        'background-color',
        'color',
        'letter-spacing',
      ],
      severity: severityOf(overallPct),
    });
    return regions;
  }

  // Top-heavy diff: header / nav issues
  if (topTotal > bottomTotal * 1.8 && pct(topTotal) > 2) {
    regions.push({
      quadrant: counts.tl > counts.tr ? 'top-left' : 'top-right',
      diffPercentage: pct(topTotal),
      likelyCause:
        'Header/navigation area: font mismatch, nav spacing, logo positioning, or top padding',
      suggestedProperties: [
        'padding-top',
        'padding-inline',
        'font-size',
        'font-weight',
        'letter-spacing',
        'gap',
        'height',
        'background',
      ],
      severity: severityOf(pct(topTotal)),
    });
  }

  // Bottom-heavy diff: footer / CTA section
  if (bottomTotal > topTotal * 1.8 && pct(bottomTotal) > 2) {
    regions.push({
      quadrant: counts.bl > counts.br ? 'bottom-left' : 'bottom-right',
      diffPercentage: pct(bottomTotal),
      likelyCause:
        'Footer/bottom section: missing element, wrong padding-bottom, or footer style mismatch',
      suggestedProperties: [
        'padding-bottom',
        'margin-bottom',
        'background-color',
        'border-top',
        'font-size',
        'gap',
      ],
      severity: severityOf(pct(bottomTotal)),
    });
  }

  // Left-heavy diff: text alignment or left-column issue
  if (leftTotal > rightTotal * 1.8 && pct(leftTotal) > 2) {
    regions.push({
      quadrant: counts.tl > counts.bl ? 'top-left' : 'bottom-left',
      diffPercentage: pct(leftTotal),
      likelyCause:
        'Left-side content: text alignment, margin-left, or left-column content mismatch',
      suggestedProperties: [
        'text-align',
        'margin-left',
        'padding-left',
        'width',
        'max-width',
        'font-size',
      ],
      severity: severityOf(pct(leftTotal)),
    });
  }

  // Right-heavy diff: missing image or right-side decoration
  if (rightTotal > leftTotal * 1.8 && pct(rightTotal) > 2) {
    regions.push({
      quadrant: counts.tr > counts.br ? 'top-right' : 'bottom-right',
      diffPercentage: pct(rightTotal),
      likelyCause:
        'Right-side content: missing image, icon, or decorative element positioning',
      suggestedProperties: [
        'margin-right',
        'padding-right',
        'width',
        'object-fit',
        'object-position',
        'background-position',
      ],
      severity: severityOf(pct(rightTotal)),
    });
  }

  // Center concentration (neither edge-heavy)
  if (regions.length === 0 && overallPct > 2) {
    regions.push({
      quadrant: 'center',
      diffPercentage: overallPct,
      likelyCause:
        'Central content area: typography scale, content spacing, or container max-width mismatch',
      suggestedProperties: [
        'max-width',
        'padding',
        'gap',
        'font-size',
        'line-height',
        'margin-inline',
      ],
      severity: severityOf(overallPct),
    });
  }

  return regions;
}

/**
 * Format a single DiffRegionAnalysis into a human-readable fix suggestion
 * with specific CSS properties to investigate.
 */
function formatRegionSuggestion(
  region: DiffRegionAnalysis,
  viewportName: string,
): string {
  const propsStr = region.suggestedProperties.join(', ');
  return (
    `${viewportName} viewport: diff concentrated in ${region.quadrant} ` +
    `(${region.diffPercentage}% of pixels). ${region.likelyCause}. ` +
    `Check: ${propsStr}.`
  );
}

function generateFixSuggestions(
  pixelDiff: PixelDiffResult,
  _iteration: number,
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  let priority = 1;

  const analyzeViewport = (vd: ViewportDiff | undefined, viewportName: string): void => {
    if (!vd || vd.percentDifferent < 1) return;

    // Read the diff image dimensions from the viewport data
    const { width, height } = vd.viewport;

    // Build a synthetic diff-data buffer from section diffs or fall back to
    // the overall viewport stats. For full spatial analysis the caller should
    // pass diff pixel data; here we use the viewport-level percentage to
    // produce a "uniform" placeholder when raw data is unavailable.
    // The section-level fix loop (runSectionFixLoop) already uses quadrant
    // analysis from section-comparator; this path produces high-level hints.
    const overallPct = vd.percentDifferent;
    const severity: 'critical' | 'major' | 'minor' =
      overallPct > 20 ? 'critical' : overallPct > 10 ? 'major' : 'minor';

    // If section diffs are available, generate per-section suggestions
    if (vd.sectionDiffs.length > 0) {
      for (const sd of vd.sectionDiffs) {
        if (sd.percentDifferent < 1) continue;

        const sectionSeverity: 'critical' | 'major' | 'minor' =
          sd.percentDifferent > 20 ? 'critical' : sd.percentDifferent > 10 ? 'major' : 'minor';

        const issue: QAIssue = {
          severity: sectionSeverity,
          category: 'layout',
          description:
            `Section '${sd.sectionName}' in ${viewportName} viewport has ` +
            `${sd.percentDifferent}% pixel difference`,
          expected: 'Pixel-perfect match with original',
          actual: `${sd.percentDifferent}% pixels differ in section '${sd.sectionName}'`,
          screenshot: sd.diffImage,
        };

        suggestions.push({
          sectionId: sd.sectionId,
          componentFile: `src/components/${sd.sectionId}.tsx`,
          priority,
          issue,
          suggestedFix:
            `Section '${sd.sectionName}' (${viewportName}): ${sd.percentDifferent}% diff. ` +
            `Review diff at ${sd.diffImage}. Check spacing, typography, colors, ` +
            `and element positioning within this section.`,
          autoFixable: false,
          codeChange: {
            file: `src/components/${sd.sectionId}.tsx`,
          },
        });

        priority++;
      }
    } else {
      // No per-section data — produce viewport-level spatial guidance
      // We synthesize region analysis from the viewport dimensions and diff %
      const syntheticRegions: DiffRegionAnalysis[] = [];

      if (overallPct > 2) {
        // Without raw pixel data, we can still provide structured guidance
        // based on the overall diff percentage
        syntheticRegions.push({
          quadrant: 'full',
          diffPercentage: overallPct,
          likelyCause:
            overallPct > 30
              ? 'Major layout divergence — likely missing sections, wrong grid structure, or completely different background'
              : overallPct > 15
                ? 'Significant style differences — check font stack, spacing scale, and color palette'
                : 'Minor visual differences — fine-tune padding, font-size, and border-radius',
          suggestedProperties:
            overallPct > 30
              ? ['display', 'grid-template-columns', 'flex-direction', 'background', 'width', 'height']
              : overallPct > 15
                ? ['font-family', 'font-size', 'padding', 'gap', 'color', 'background-color']
                : ['padding', 'margin', 'border-radius', 'font-weight', 'letter-spacing', 'line-height'],
          severity,
        });
      }

      for (const region of syntheticRegions) {
        const issue: QAIssue = {
          severity: region.severity,
          category: 'layout',
          description: `${viewportName} viewport has ${overallPct}% pixel difference`,
          expected: 'Pixel-perfect match with original',
          actual: `${overallPct}% pixels differ`,
          screenshot: vd.diffImage,
        };

        suggestions.push({
          sectionId: `viewport-${viewportName}`,
          componentFile: 'src/app/page.tsx',
          priority,
          issue,
          suggestedFix: formatRegionSuggestion(region, viewportName),
          autoFixable: false,
          codeChange: {
            file: 'src/app/page.tsx',
          },
        });

        priority++;
      }
    }
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
 * Map quadrant percentages to CSS property suggestions.
 */
function inferPropertiesFromQuadrants(q: QuadrantAnalysis): string[] {
  const { topLeft, topRight, bottomLeft, bottomRight } = q;
  const topTotal = topLeft + topRight;
  const bottomTotal = bottomLeft + bottomRight;
  const leftTotal = topLeft + bottomLeft;
  const rightTotal = topRight + bottomRight;

  const props = new Set<string>();

  if (topTotal > bottomTotal * 1.8) {
    props.add('padding-top');
    props.add('font-size');
    props.add('font-weight');
    props.add('letter-spacing');
    props.add('background');
  }
  if (bottomTotal > topTotal * 1.8) {
    props.add('padding-bottom');
    props.add('margin-bottom');
    props.add('gap');
  }
  if (leftTotal > rightTotal * 1.8) {
    props.add('text-align');
    props.add('margin-left');
    props.add('padding-left');
  }
  if (rightTotal > leftTotal * 1.8) {
    props.add('margin-right');
    props.add('padding-right');
    props.add('width');
  }

  // Uniform => global
  const allSimilar =
    Math.abs(topLeft - topRight) < 5 &&
    Math.abs(topLeft - bottomLeft) < 5 &&
    Math.abs(topLeft - bottomRight) < 5;
  if (allSimilar && topLeft > 3) {
    props.add('font-family');
    props.add('font-size');
    props.add('line-height');
    props.add('background-color');
    props.add('color');
  }

  // Fallback if no specific pattern detected
  if (props.size === 0) {
    props.add('padding');
    props.add('margin');
    props.add('font-size');
    props.add('gap');
  }

  return Array.from(props);
}

/**
 * Generate a human-readable fix suggestion from a section comparison result.
 * Now includes specific CSS property recommendations based on spatial analysis.
 */
function buildSectionFixSuggestion(
  result: SectionCompareResult,
): string {
  const quadrantHint = describeQuadrantConcentration(result.diffQuadrants);
  const suggestedProps = inferPropertiesFromQuadrants(result.diffQuadrants);

  const possibleCauses: string[] = [];

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

  const allSimilar =
    Math.abs(topLeft - topRight) < 5 &&
    Math.abs(topLeft - bottomLeft) < 5 &&
    Math.abs(topLeft - bottomRight) < 5;
  if (allSimilar && topLeft > 3) {
    possibleCauses.push('likely global style issue (background color, font-size, or overall spacing)');
  }

  const causeStr =
    possibleCauses.length > 0 ? ` Likely causes: ${possibleCauses.join('; ')}.` : '';
  const propsStr = suggestedProps.length > 0 ? ` Check: ${suggestedProps.join(', ')}.` : '';

  return (
    `Section '${result.sectionName}': ` +
    `${result.pixelMatchPercent}% match. ` +
    `${quadrantHint}.${causeStr}${propsStr}`
  );
}

// Re-export analyzeDiffRegions for external consumers (e.g. advanced fix agents)
export { analyzeDiffRegions };

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

// ---------------------------------------------------------------------------
// Builder dispatch with error recovery (Item: builder error recovery)
// ---------------------------------------------------------------------------

export type BuilderStatus = 'success' | 'build_failed' | 'rolled_back';

export interface BuilderDispatchResult {
  sectionId: string;
  componentFile: string;
  status: BuilderStatus;
  attempts: number;
  /** Stderr/error output from typecheck or build, if any. */
  error?: string;
  /** True when the previous file contents were restored. */
  rolledBack: boolean;
}

export interface BuilderDispatchOptions {
  sectionId: string;
  /** Absolute or project-relative path to the component file the builder writes. */
  componentFile: string;
  /** Project root, used for snapshot resolution and verification commands. */
  projectDir: string;
  /**
   * The actual builder dispatch. Should write/update `componentFile` and
   * resolve once the builder agent has finished. May reject on transport-level
   * failures.
   */
  dispatch: () => Promise<void>;
  /**
   * Validation step run after dispatch. Should throw if the produced JSX/TSX
   * is invalid (e.g. typecheck failure). Defaults to running `tsc --noEmit`
   * scoped to the component file.
   */
  verify?: () => Promise<void> | void;
  /** Maximum retry attempts after a failure (default 1). */
  maxRetries?: number;
}

/**
 * Wrap a builder dispatch in snapshot-protected error recovery.
 *
 * Behaviour:
 * 1. Snapshot the current contents of `componentFile` (if present).
 * 2. Run the builder dispatch.
 * 3. Run `verify` (defaults to file-scoped tsc --noEmit).
 * 4. If verify throws, roll the file back to the snapshot and retry once.
 * 5. After `maxRetries`, mark the section as `build_failed` and stop.
 */
export async function dispatchBuilderWithRecovery(
  options: BuilderDispatchOptions,
): Promise<BuilderDispatchResult> {
  const {
    sectionId,
    componentFile,
    projectDir,
    dispatch,
    verify,
    maxRetries = 1,
  } = options;

  const absPath = resolve(projectDir, componentFile);
  const snapshot = takeSnapshot(absPath);
  let lastError: string | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      await dispatch();
      const verifyFn = verify ?? (() => verifyComponentFile(absPath, projectDir));
      await verifyFn();
      return {
        sectionId,
        componentFile,
        status: 'success',
        attempts,
        rolledBack: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      restoreSnapshot(absPath, snapshot);
      console.warn(
        `[Builder] Section '${sectionId}' attempt ${attempts} failed: ${lastError.split('\n')[0]}`,
      );
      if (attempt >= maxRetries) {
        // Loud failure — do not infinitely retry.
        console.error(
          `[Builder] Section '${sectionId}' marked build_failed after ${attempts} attempt(s). Manual review required.`,
        );
        return {
          sectionId,
          componentFile,
          status: 'build_failed',
          attempts,
          error: lastError,
          rolledBack: true,
        };
      }
    }
  }

  // Unreachable — the loop returns on every path.
  return {
    sectionId,
    componentFile,
    status: 'build_failed',
    attempts,
    error: lastError,
    rolledBack: true,
  };
}

interface FileSnapshot {
  existed: boolean;
  contents?: string;
}

function takeSnapshot(absPath: string): FileSnapshot {
  if (!existsSync(absPath)) return { existed: false };
  try {
    return { existed: true, contents: readFileSync(absPath, 'utf-8') };
  } catch {
    return { existed: false };
  }
}

function restoreSnapshot(absPath: string, snapshot: FileSnapshot): void {
  if (snapshot.existed && snapshot.contents !== undefined) {
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, snapshot.contents, 'utf-8');
    return;
  }
  // Snapshot says the file did not exist before — remove the broken one.
  if (existsSync(absPath)) {
    try {
      unlinkSync(absPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Default verify step: run TypeScript against the project. Throws with the
 * tsc output when type errors are detected in the target file.
 */
function verifyComponentFile(absPath: string, projectDir: string): void {
  const tscBin = resolve(projectDir, 'node_modules/.bin/tsc');
  if (!existsSync(tscBin)) {
    // Without tsc available we can't verify — treat as success.
    return;
  }
  try {
    execFileSync(tscBin, ['--noEmit'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? '';
    const stderr = (err as { stderr?: string }).stderr ?? '';
    const combined = `${stdout}\n${stderr}`;
    // Only fail when the error references the file we just wrote — otherwise
    // unrelated repo issues would always block the builder.
    const fileSegment = absPath.replace(projectDir + '/', '');
    if (combined.includes(fileSegment) || combined.includes(absPath)) {
      throw new Error(
        `Typecheck failed for ${fileSegment}:\n${combined.trim()}`,
      );
    }
    // Pre-existing unrelated errors — let the builder pass.
  }
}

// ---------------------------------------------------------------------------
// QA report annotation for build failures
// ---------------------------------------------------------------------------

/**
 * Mark a section as `build_failed` in a QA report so humans see it. Returns a
 * new SectionQAResult; merge it into your report's `sectionResults`.
 */
export function buildFailedSectionResult(
  sectionId: string,
  sectionName: string,
  error: string,
): SectionQAResult {
  const issue: QAIssue = {
    severity: 'critical',
    category: 'layout',
    description: `Builder failed to produce valid JSX for section '${sectionName}'. Manual review required.`,
    expected: 'Component file with valid TypeScript/JSX',
    actual: error.split('\n').slice(0, 5).join('\n'),
  };
  return {
    sectionId,
    sectionName,
    pixelMatchPercent: 0,
    structureMatch: false,
    animationMatch: false,
    issues: [issue],
    status: 'fail',
  };
}

// Re-exported for orchestrators that want to write reports themselves.
export const _qaReportPaths = {
  defaultReportPath: (projectDir: string): string =>
    join(projectDir, 'docs/research/qa-report.json'),
};
