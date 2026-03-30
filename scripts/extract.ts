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
import { scrapeStylesheets } from '../engine/extract/playwright/stylesheet-scraper';
import { mergeExtractionData } from '../engine/extract/merge';
import { buildTopology } from '../engine/analyze/topology';
import { extractDesignTokens } from '../engine/analyze/design-tokens';
import { buildComponentTree } from '../engine/analyze/component-tree';
import { generateBuilderPrompts } from '../engine/generate/builder-prompts';
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
    '- `prompts/` — Per-section builder prompt files with raw extraction data',
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

    // Fix esbuild __name helper not available in browser context.
    // When tsx (esbuild) compiles TypeScript, it injects a `__name()` helper
    // for function declarations. Playwright's page.evaluate() serialises
    // callbacks into the browser where that helper doesn't exist.
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__defProp = Object.defineProperty;
      (window as unknown as Record<string, unknown>).__name = (fn: unknown) => fn;
    });

    // Inject animation monitors BEFORE navigation
    console.log('[1/8] Injecting animation monitors...');
    await injectAnimationMonitors(page);

    // Navigate — use domcontentloaded instead of networkidle to avoid
    // timeouts on pages with long-polling / streaming connections.
    console.log('[2/8] Navigating to target...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000); // Wait for JS to initialise

    // Run extraction steps — scan must be first (provides section data)
    console.log('[3/8] Scanning page structure...');
    const scan = await scanPage(page, { maxDepth: 8 });

    // These can run in parallel — they read from the page independently
    console.log('[4/8] Running parallel extraction (animations, fonts, assets, stylesheets)...');
    const [animations, fonts, assets, stylesheetResult] = await Promise.all([
      detectAnimations(page, { scrollProbe: true, hoverProbe: true }),
      extractFonts(page, outputDir),
      collectAssets(page, { outputDir }),
      scrapeStylesheets(page),
    ]);

    // Interactions need the page in a clean state, run after parallel batch
    console.log('[5/8] Mapping interactions...');
    const interactions = await mapInteractions(page);

    // Screenshot each section
    console.log('[6/8] Capturing section screenshots...');
    const screenshotsDir = join(outputDir, 'screenshots');
    await mkdir(screenshotsDir, { recursive: true });

    for (const section of scan.sections) {
      try {
        await page.evaluate(
          (top: number) => window.scrollTo(0, top),
          section.boundingRect.top,
        );
        await page.waitForTimeout(300);
        await page.screenshot({
          path: join(screenshotsDir, `${section.id}.png`),
          clip: {
            x: 0,
            y: 0,
            width: VIEWPORT.width,
            height: Math.min(section.boundingRect.height, 2000),
          },
        });
      } catch {
        // Section may be off-screen or zero-height — skip
      }
    }

    // Full-page screenshot
    await page.screenshot({
      path: join(screenshotsDir, 'full-page.png'),
      fullPage: true,
    });

    // Merge all results
    console.log('[7/8] Merging extraction data...');
    const pageData = mergeExtractionData({
      url,
      scan,
      animations,
      fonts,
      assets,
      interactions,
      stylesheets: stylesheetResult,
      viewport: VIEWPORT,
    });

    // Write outputs
    console.log('[8/8] Writing output files...');
    const jsonPath = join(outputDir, 'page-data.json');
    const summaryPath = join(outputDir, 'EXTRACTION_SUMMARY.md');

    const durationMs = Date.now() - startTime;

    await Promise.all([
      writeFile(jsonPath, JSON.stringify(pageData, null, 2), 'utf-8'),
      writeFile(summaryPath, generateSummaryMarkdown(url, durationMs), 'utf-8'),
    ]);

    // Run analysis and generate builder prompts
    console.log('Generating builder prompts...');
    const projectDir = resolve(join(outputDir, '..', '..'));
    const tokens = extractDesignTokens(pageData);
    const componentTree = buildComponentTree(pageData);
    buildTopology(pageData);

    const allComponents = [
      componentTree.root,
      ...componentTree.root.children,
    ];

    const prompts = await generateBuilderPrompts({
      projectDir,
      pageData,
      tokens,
      components: allComponents,
    });

    console.log(`Generated ${prompts.length} builder prompts in docs/research/prompts/`);

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
