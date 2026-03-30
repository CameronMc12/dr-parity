#!/usr/bin/env tsx
/**
 * CLI entry point for running QA pixel-diff comparison.
 *
 * Usage:
 *   npx tsx scripts/qa.ts <original-url> [--clone-url http://localhost:3000] [--threshold 5]
 */

import { chromium } from 'playwright';
import { captureScreenshots } from '../engine/qa/screenshotter';
import { runFullDiff, type ScreenshotPair } from '../engine/qa/pixel-diff';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import type { PixelDiffResult, ViewportDiff } from '../engine/types/diff';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface QAArgs {
  originalUrl: string;
  cloneUrl: string;
  threshold: number;
  outputDir: string;
}

function parseArgs(): QAArgs {
  const args = process.argv.slice(2);

  const originalUrl = args.find((a) => !a.startsWith('--'));
  if (!originalUrl) {
    console.error(
      'Usage: npx tsx scripts/qa.ts <original-url> [--clone-url http://localhost:3000] [--threshold 5]',
    );
    process.exit(1);
  }

  let cloneUrl = 'http://localhost:3000';
  const cloneIdx = args.indexOf('--clone-url');
  if (cloneIdx !== -1 && args[cloneIdx + 1]) {
    cloneUrl = args[cloneIdx + 1];
  }

  let threshold = 5;
  const threshIdx = args.indexOf('--threshold');
  if (threshIdx !== -1 && args[threshIdx + 1]) {
    const parsed = Number(args[threshIdx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) {
      threshold = parsed;
    }
  }

  let outputDir = 'docs/design-references/qa';
  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outputDir = args[outIdx + 1];
  }

  return { originalUrl, cloneUrl, threshold, outputDir: resolve(outputDir) };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatViewportLine(name: string, diff: ViewportDiff | undefined): string {
  if (!diff) return '';

  const matchPercent = (100 - diff.percentDifferent).toFixed(1);
  const diffPercent = diff.percentDifferent.toFixed(1);
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const padded = `${label}:`.padEnd(9);
  const warning = diff.percentDifferent > 5 ? ' !!!' : '';

  return `  ${padded} ${matchPercent}% match (${diffPercent}% diff)${warning}`;
}

function printReport(result: PixelDiffResult, threshold: number): boolean {
  const diffs: ViewportDiff[] = [result.desktop];
  if (result.tablet) diffs.push(result.tablet);
  if (result.mobile) diffs.push(result.mobile);

  const avgDiff = diffs.reduce((sum, d) => sum + d.percentDifferent, 0) / diffs.length;
  const overallMatch = Number((100 - avgDiff).toFixed(1));
  const passed = overallMatch >= 100 - threshold;

  console.log('');
  console.log('  Dr Parity QA Report');
  console.log('  ==============================');
  console.log(formatViewportLine('desktop', result.desktop));
  if (result.tablet) console.log(formatViewportLine('tablet', result.tablet));
  if (result.mobile) console.log(formatViewportLine('mobile', result.mobile));
  console.log('');
  console.log(`  Overall: ${overallMatch}% — ${passed ? 'PASS' : 'FAIL'}`);
  console.log('');

  return passed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { originalUrl, cloneUrl, threshold, outputDir } = parseArgs();

  console.log(`Original: ${originalUrl}`);
  console.log(`Clone:    ${cloneUrl}`);
  console.log(`Threshold: ${threshold}%`);
  console.log('');

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Capture screenshots
    console.log('Capturing screenshots...');
    const screenshots = await captureScreenshots(browser, {
      originalUrl,
      cloneUrl,
      outputDir,
    });

    // 2. Build pairs
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
    console.log('Running pixel-diff...');
    const result = await runFullDiff(pairs, { outputDir });

    // 4. Write report JSON
    const reportPath = join(outputDir, 'qa-report.json');
    await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Report saved: ${reportPath}`);

    // 5. Print summary and exit
    const passed = printReport(result, threshold);
    process.exit(passed ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('QA failed:', err);
  process.exit(1);
});
