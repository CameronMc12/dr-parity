#!/usr/bin/env tsx
/**
 * CLI entry point for running the extraction pipeline.
 *
 * Usage:
 *   npx tsx scripts/extract.ts <url> [--output docs/research]
 */

import { chromium } from 'playwright';
import {
  injectAnimationMonitors,
  detectAnimations,
} from '../engine/extract/playwright/animation-detector';
import { scanPage } from '../engine/extract/playwright/page-scanner';
import { extractFonts } from '../engine/extract/playwright/font-extractor';
import { collectAssets } from '../engine/extract/playwright/asset-collector';
import { mapInteractions } from '../engine/extract/playwright/interaction-mapper';
import { mergeExtractionData } from '../engine/extract/merge';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { url: string; outputDir: string } {
  const args = process.argv.slice(2);

  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error('Usage: npx tsx scripts/extract.ts <url> [--output docs/research]');
    process.exit(1);
  }

  let outputDir = 'docs/research';
  const outputFlagIdx = args.indexOf('--output');
  if (outputFlagIdx !== -1 && args[outputFlagIdx + 1]) {
    outputDir = args[outputFlagIdx + 1];
  }

  return { url, outputDir: resolve(outputDir) };
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function generateSummaryMarkdown(url: string, durationMs: number): string {
  const seconds = (durationMs / 1000).toFixed(1);
  return [
    '# Extraction Summary',
    '',
    `**URL:** ${url}`,
    `**Date:** ${new Date().toISOString()}`,
    `**Duration:** ${seconds}s`,
    '',
    '## Output Files',
    '',
    '- `page-data.json` — Complete extraction data',
    '',
    '## Next Steps',
    '',
    '1. Review extracted data in `page-data.json`',
    '2. Run the QA comparison: `npx tsx scripts/qa.ts <url>`',
    '3. Iterate on the clone until pixel-diff passes',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1440, height: 900 };

async function main(): Promise<void> {
  const { url, outputDir } = parseArgs();
  const startTime = Date.now();

  console.log(`Extracting: ${url}`);
  console.log(`Output:     ${outputDir}`);
  console.log('');

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
    });
    const page = await context.newPage();

    // Inject animation monitors BEFORE navigation
    console.log('[1/6] Injecting animation monitors...');
    await injectAnimationMonitors(page);

    // Navigate
    console.log('[2/6] Navigating to target...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Run extraction steps
    console.log('[3/6] Scanning page structure...');
    const scan = await scanPage(page);

    console.log('[4/6] Running parallel extraction (animations, fonts, assets, interactions)...');
    const [animations, fonts, assets, interactions] = await Promise.all([
      detectAnimations(page),
      extractFonts(page, outputDir),
      collectAssets(page, { outputDir }),
      mapInteractions(page),
    ]);

    // Merge all results
    console.log('[5/6] Merging extraction data...');
    const pageData = mergeExtractionData({
      url,
      scan,
      animations,
      fonts,
      assets,
      interactions,
      viewport: VIEWPORT,
    });

    // Write outputs
    console.log('[6/6] Writing output files...');
    const jsonPath = join(outputDir, 'page-data.json');
    const summaryPath = join(outputDir, 'EXTRACTION_SUMMARY.md');

    const durationMs = Date.now() - startTime;

    await Promise.all([
      writeFile(jsonPath, JSON.stringify(pageData, null, 2), 'utf-8'),
      writeFile(summaryPath, generateSummaryMarkdown(url, durationMs), 'utf-8'),
    ]);

    await context.close();

    const seconds = (durationMs / 1000).toFixed(1);
    console.log('');
    console.log(`Extraction complete in ${seconds}s`);
    console.log(`  JSON:    ${jsonPath}`);
    console.log(`  Summary: ${summaryPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
