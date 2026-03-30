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
import type { PageData, SectionSpec } from '../engine/types/extraction';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface SectionQAArgs {
  originalUrl: string;
  cloneUrl: string;
  threshold: number;
  outputDir: string;
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

  return { originalUrl, cloneUrl, threshold, outputDir: resolve(outputDir) };
}

// ---------------------------------------------------------------------------
// Section extraction from page-data.json
// ---------------------------------------------------------------------------

function buildSectionInfoFromPageData(sections: SectionSpec[]): SectionInfo[] {
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
    sorted.length > 0 ? Number((totalMatch / sorted.length).toFixed(1)) : 100;
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
    console.log(`Section ${idx}: ${name} \u2192 ${pct} ${icon}${diffNote}`);
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
  const { originalUrl, cloneUrl, threshold, outputDir } = parseArgs();

  // Read page-data.json
  const pageDataPath = join(process.cwd(), 'docs/research/page-data.json');
  let pageData: PageData;
  try {
    const raw = await readFile(pageDataPath, 'utf-8');
    pageData = JSON.parse(raw) as PageData;
  } catch {
    console.error(`Failed to read ${pageDataPath}`);
    console.error(
      'Run the extraction step first to generate docs/research/page-data.json',
    );
    process.exit(1);
  }

  if (!pageData.sections || pageData.sections.length === 0) {
    console.error('No sections found in page-data.json');
    process.exit(1);
  }

  const sections = buildSectionInfoFromPageData(pageData.sections);

  console.log(`Original:  ${originalUrl}`);
  console.log(`Clone:     ${cloneUrl}`);
  console.log(`Threshold: ${threshold}%`);
  console.log(`Sections:  ${sections.length}`);
  console.log('');

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    console.log('Comparing sections...');
    const results = await compareSections(browser, {
      originalUrl,
      cloneUrl,
      sections,
      outputDir,
      threshold,
    });

    // Write JSON report
    const reportPath = join(outputDir, 'section-qa-report.json');
    await writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`Report saved: ${reportPath}`);

    // Print formatted results
    const passed = printReport(results, threshold);
    process.exit(passed ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Section QA failed:', err);
  process.exit(1);
});
