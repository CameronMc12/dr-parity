#!/usr/bin/env tsx
/**
 * CLI entry point for section-by-section QA comparison.
 *
 * Usage:
 *   npx tsx scripts/qa-sections.ts <original-url> [--clone-url http://localhost:3000] [--threshold 95]
 *
 * Reads section positions from docs/research/page-data.json and compares each
 * section independently, printing per-section match scores and overall results.
 */

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import {
  compareSections,
  type SectionInfo,
  type SectionCompareResult,
} from '../engine/qa/section-comparator';
import { testHoverStates, type HoverTestResult } from '../engine/qa/hover-tester';
import { compareDomStructure } from '../engine/qa/dom-comparator';
import { ProgressReporter } from '../engine/utils/progress';
import type { PageData, SectionSpec } from '../engine/types/extraction';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface SectionQAArgs {
  originalUrl: string;
  cloneUrl: string;
  threshold: number;
  outputDir: string;
  testHover: boolean;
}

function parseArgs(): SectionQAArgs {
  const args = process.argv.slice(2);

  const originalUrl = args.find((a) => !a.startsWith('--'));
  if (!originalUrl) {
    console.error(
      'Usage: npx tsx scripts/qa-sections.ts <original-url> ' +
        '[--clone-url http://localhost:3000] [--threshold 95]',
    );
    process.exit(1);
  }

  let cloneUrl = 'http://localhost:3000';
  const cloneIdx = args.indexOf('--clone-url');
  if (cloneIdx !== -1 && args[cloneIdx + 1]) {
    cloneUrl = args[cloneIdx + 1];
  }

  let threshold = 95;
  const threshIdx = args.indexOf('--threshold');
  if (threshIdx !== -1 && args[threshIdx + 1]) {
    const parsed = Number(args[threshIdx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) {
      threshold = parsed;
    }
  }

  let outputDir = 'docs/design-references/qa-sections';
  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outputDir = args[outIdx + 1];
  }

  const testHover = args.includes('--test-hover');

  return { originalUrl, cloneUrl, threshold, outputDir: resolve(outputDir), testHover };
}

// ---------------------------------------------------------------------------
// Section extraction from page-data.json
// ---------------------------------------------------------------------------

function buildSectionInfoFromPageData(
  sections: SectionSpec[],
): SectionInfo[] {
  return sections
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.id,
      name: section.name,
      scrollY: section.boundingRect.top,
      height: section.boundingRect.height,
    }));
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function printReport(
  results: SectionCompareResult[],
  threshold: number,
): boolean {
  // Sort by section order (re-sort by scrollY since compareSections sorts by worst match)
  const sorted = [...results];

  const totalMatch = sorted.reduce((sum, r) => sum + r.pixelMatchPercent, 0);
  const overallScore =
    sorted.length > 0
      ? Number((totalMatch / sorted.length).toFixed(1))
      : 100;
  const failCount = sorted.filter((r) => !r.passed).length;
  const allPassed = failCount === 0;

  console.log('');
  console.log('Dr Parity Section QA');
  const separator = '\u2550'.repeat(40);
  console.log(separator);

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    const idx = String(i + 1).padStart(2, ' ');
    const name = r.sectionName.padEnd(20);
    const pct = `${r.pixelMatchPercent}%`;
    const icon = r.passed ? '\u2713' : '\u2717';
    const diffNote = r.passed ? '' : ` (diff: ${r.diffImagePath})`;
    console.log(
      `Section ${idx}: ${name} \u2192 ${pct} ${icon}${diffNote}`,
    );
  }

  console.log('');
  if (allPassed) {
    console.log(`Overall: ${overallScore}% \u2014 All sections pass!`);
  } else {
    console.log(
      `Overall: ${overallScore}% \u2014 ${failCount} section${failCount > 1 ? 's' : ''} need${failCount === 1 ? 's' : ''} fixes`,
    );
  }
  console.log('');

  return allPassed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { originalUrl, cloneUrl, threshold, outputDir, testHover } = parseArgs();

  const progress = new ProgressReporter(testHover ? 6 : 5);

  // Phase 1: Read page-data.json
  progress.startPhase('Loading page-data.json');
  const pageDataPath = join(process.cwd(), 'docs/research/page-data.json');
  let pageData: PageData;
  try {
    const raw = await readFile(pageDataPath, 'utf-8');
    pageData = JSON.parse(raw) as PageData;
  } catch {
    progress.failPhase(`Failed to read ${pageDataPath}`);
    console.error(
      'Run the extraction step first to generate docs/research/page-data.json',
    );
    process.exit(1);
  }

  if (!pageData.sections || pageData.sections.length === 0) {
    progress.failPhase('No sections found in page-data.json');
    process.exit(1);
  }

  const sections = buildSectionInfoFromPageData(pageData.sections);
  progress.endPhase(`${sections.length} sections loaded`);

  console.log(`  Original:  ${originalUrl}`);
  console.log(`  Clone:     ${cloneUrl}`);
  console.log(`  Threshold: ${threshold}%`);

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    // Phase 2: Compare sections
    progress.startPhase('Comparing sections');
    const results = await compareSections(browser, {
      originalUrl,
      cloneUrl,
      sections,
      outputDir,
      threshold,
    });
    progress.endPhase(`${results.length} sections compared`);

    // Phase 3: Write JSON report
    progress.startPhase('Writing report');
    const reportPath = join(outputDir, 'section-qa-report.json');
    await writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    progress.endPhase(reportPath);

    // Phase 4: Hover state testing (optional)
    if (testHover) {
      progress.startPhase('Testing hover states');
      const clonePage = await browser.newPage();
      await clonePage.goto(cloneUrl, { waitUntil: 'networkidle' });

      const hoverResults = await testHoverStates(clonePage, {
        outputDir,
      });

      await clonePage.close();

      if (hoverResults.length > 0) {
        console.log('');
        console.log('Hover State Testing:');
        for (const hr of hoverResults) {
          const propCount = Object.keys(hr.styleChanges).length;
          console.log(
            `  ${hr.elementSelector}: ${propCount} propert${propCount === 1 ? 'y' : 'ies'} change on hover`,
          );
          for (const [prop, change] of Object.entries(hr.styleChanges)) {
            console.log(`    ${prop}: ${change.before} \u2192 ${change.after}`);
          }
        }
      } else {
        console.log('\nHover State Testing: No hover effects detected.');
      }

      const hoverReportPath = join(outputDir, 'hover-test-report.json');
      await writeFile(hoverReportPath, JSON.stringify(hoverResults, null, 2), 'utf-8');
      progress.endPhase(`${hoverResults.length} elements with hover effects`);
    }

    // DOM structure comparison (Item 4.10)
    progress.startPhase('DOM structure comparison');
    {
      const context = browser.contexts()[0] ?? await browser.newContext();
      const origPage = await context.newPage();
      const clPage = await context.newPage();
      await Promise.all([
        origPage.goto(originalUrl, { waitUntil: 'networkidle' }),
        clPage.goto(cloneUrl, { waitUntil: 'networkidle' }),
      ]);

      const domDiff = await compareDomStructure(origPage, clPage);

      console.log('');
      console.log(
        `DOM Structure: ${domDiff.totalElements.original} orig \u2192 ${domDiff.totalElements.clone} clone`,
      );
      if (domDiff.missingElements.length > 0) {
        console.log(`  Missing: ${domDiff.missingElements.length} elements`);
      }
      if (domDiff.tagMismatches.length > 0) {
        console.log(`  Tag mismatches: ${domDiff.tagMismatches.length}`);
      }
      if (domDiff.textDifferences.length > 0) {
        console.log(`  Text diffs: ${domDiff.textDifferences.length}`);
      }

      const domReportPath = join(outputDir, 'dom-diff-report.json');
      await writeFile(domReportPath, JSON.stringify(domDiff, null, 2), 'utf-8');

      await origPage.close();
      await clPage.close();
    }
    progress.endPhase('DOM comparison complete');

    // Final phase: Format and print results
    progress.startPhase('Formatting results');
    const passed = printReport(results, threshold);
    progress.endPhase(passed ? 'ALL PASS' : 'SOME FAILURES');

    progress.summary();
    process.exit(passed ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Section QA failed:', err);
  process.exit(1);
});
