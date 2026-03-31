#!/usr/bin/env tsx
/**
 * CLI entry point for running the extraction pipeline.
 *
 * Usage:
 *   npx tsx scripts/extract.ts <url> [--output docs/research]
 *   npx tsx scripts/extract.ts <url> --dry-run
 *   npx tsx scripts/extract.ts <url> --only-sections=hero,footer
 *   npx tsx scripts/extract.ts <url> --only-sections=hero --from-cache=docs/research
 */

import { chromium, type Page } from 'playwright';
import {
  injectAnimationMonitors,
  detectAnimations,
} from '../engine/extract/playwright/animation-detector';
import { scanPage, scanPageBatched } from '../engine/extract/playwright/page-scanner';
import { extractFonts } from '../engine/extract/playwright/font-extractor';
import { collectAssets } from '../engine/extract/playwright/asset-collector';
import { mapInteractions } from '../engine/extract/playwright/interaction-mapper';
import { scrapeStylesheets } from '../engine/extract/playwright/stylesheet-scraper';
import { mergeExtractionData } from '../engine/extract/merge';
import { buildTopology } from '../engine/analyze/topology';
import { extractDesignTokens } from '../engine/analyze/design-tokens';
import { buildComponentTree } from '../engine/analyze/component-tree';
import { generateBuilderPrompts } from '../engine/generate/builder-prompts';
import { ExtractionCache } from '../engine/extract/cache';
import { CheckpointManager } from '../engine/extract/checkpoint';
import { ProgressReporter } from '../engine/utils/progress';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { PageData } from '../engine/types/extraction';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  url: string;
  outputDir: string;
  useCache: boolean;
  resume: boolean;
  dryRun: boolean;
  batchMode: boolean;
  onlySections: string[] | null;
  fromCache: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error(
      'Usage: npx tsx scripts/extract.ts <url> [--output docs/research] [--no-cache] [--resume] [--dry-run] [--batch] [--only-sections=id1,id2] [--from-cache=dir]',
    );
    process.exit(1);
  }

  let outputDir = 'docs/research';
  const outputFlagIdx = args.indexOf('--output');
  if (outputFlagIdx !== -1 && args[outputFlagIdx + 1]) {
    outputDir = args[outputFlagIdx + 1];
  }

  const useCache = !args.includes('--no-cache');
  const resume = args.includes('--resume');
  const dryRun = args.includes('--dry-run');
  const batchMode = args.includes('--batch');

  const onlySectionsArg = args.find((a) => a.startsWith('--only-sections='));
  const onlySections = onlySectionsArg
    ? onlySectionsArg.split('=')[1]?.split(',').filter(Boolean) ?? null
    : null;

  const fromCacheArg = args.find((a) => a.startsWith('--from-cache='));
  const fromCache = fromCacheArg ? fromCacheArg.split('=')[1] ?? null : null;

  return {
    url,
    outputDir: resolve(outputDir),
    useCache,
    resume,
    dryRun,
    batchMode,
    onlySections,
    fromCache,
  };
}

// ---------------------------------------------------------------------------
// Smart wait — replaces hardcoded 3s timeout after navigation
// ---------------------------------------------------------------------------

async function smartWait(page: Page, maxWait = 5000): Promise<void> {
  // Try networkidle first (with short timeout)
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.waitForTimeout(Math.min(maxWait, 3000)),
  ]);

  // Then wait for fonts
  await Promise.race([
    page
      .evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready)
      .catch(() => {}),
    page.waitForTimeout(1000),
  ]);

  // Check if DOM is stable (no mutations for 300ms)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 300);
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 1000);
      }),
  );
}

// ---------------------------------------------------------------------------
// Dry-run helpers
// ---------------------------------------------------------------------------

function estimateTime(elementCount: number, sectionCount: number): number {
  return Math.round(0.5 + elementCount * 0.01 + sectionCount * 2);
}

function countMediaInElements(
  elements: { media?: { type?: string }; children: typeof elements }[],
  type: string,
): number {
  let count = 0;
  for (const el of elements) {
    if (el.media?.type === type) count++;
    count += countMediaInElements(el.children, type);
  }
  return count;
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
    '- `page-data.json` \u2014 Complete extraction data',
    '- `prompts/` \u2014 Per-section builder prompt files with raw extraction data',
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

/** Batch size for parallel section screenshots. */
const SCREENSHOT_BATCH_SIZE = 5;

async function main(): Promise<void> {
  const { url, outputDir, useCache, resume, dryRun, batchMode, onlySections, fromCache } =
    parseArgs();

  console.log(`Extracting: ${url}`);
  console.log(`Output:     ${outputDir}`);
  if (dryRun) console.log('  Mode:    DRY RUN');
  if (batchMode) console.log('  Batch:   enabled (--batch)');
  if (!useCache) console.log('  Cache:   disabled (--no-cache)');
  if (resume) console.log('  Resume:  enabled (--resume)');
  if (onlySections) console.log(`  Sections: ${onlySections.join(', ')}`);
  if (fromCache) console.log(`  From cache: ${fromCache}`);
  console.log('');

  await mkdir(outputDir, { recursive: true });

  // Initialise cache & checkpoint managers
  const cache = new ExtractionCache(resolve(join(outputDir, '..', '..')));
  await cache.initialize();

  const checkpoint = new CheckpointManager(outputDir, url);
  if (resume) {
    const loaded = await checkpoint.load();
    if (loaded) {
      console.log(
        `Resuming from checkpoint. Completed: ${checkpoint.completedPhases.join(', ')}`,
      );
    }
  }

  // Determine phase count: dry-run = 4, full = 9
  const phaseCount = dryRun ? 4 : 9;
  const progress = new ProgressReporter(phaseCount);

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
    });
    const page = await context.newPage();

    // Fix esbuild __name helper not available in browser context.
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__defProp =
        Object.defineProperty;
      (window as unknown as Record<string, unknown>).__name = (
        fn: unknown,
      ) => fn;
    });

    // Phase 1: Inject animation monitors BEFORE navigation
    progress.startPhase('Injecting animation monitors');
    await injectAnimationMonitors(page);
    progress.endPhase();

    // Phase 2: Navigate
    progress.startPhase('Navigating to target');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await smartWait(page);
    progress.endPhase();

    // -----------------------------------------------------------------------
    // Phase 3: Scan (must be first — provides section data)
    // -----------------------------------------------------------------------
    progress.startPhase('Scanning page structure');
    let scan;
    if (resume && checkpoint.isCompleted('scan')) {
      scan =
        checkpoint.getPhaseData<Awaited<ReturnType<typeof scanPage>>>('scan');
    } else if (useCache) {
      scan = await cache.get<Awaited<ReturnType<typeof scanPage>>>(
        url,
        'scan',
      );
    }
    if (!scan) {
      // Use batched scanner for large pages (auto-detects 50+ sections, or forced via --batch)
      scan = await scanPageBatched(page, {
        maxDepth: 8,
        batchMode: batchMode || undefined,
      });
      await checkpoint.markCompleted('scan', scan);
      if (useCache) await cache.set(url, 'scan', scan);
    }
    progress.endPhase(
      `${scan.sections.length} sections, ${scan.totalElements} elements`,
    );

    // -----------------------------------------------------------------------
    // Dry-run: detect animations (fast) and print summary, then exit
    // -----------------------------------------------------------------------
    if (dryRun) {
      progress.startPhase('Detecting animations (dry-run probe)');
      const animationResult = await detectAnimations(page, {
        scrollProbe: true,
        hoverProbe: true,
      });
      progress.endPhase(`${animationResult.totalDetected} animations found`);

      progress.summary();

      const imageCount = scan.sections.reduce(
        (acc, s) => acc + countMediaInElements(s.elements, 'image'),
        0,
      );
      const videoCount = scan.sections.reduce(
        (acc, s) => acc + countMediaInElements(s.elements, 'video'),
        0,
      );

      console.log('');
      console.log('  \u2550\u2550\u2550 DRY RUN SUMMARY \u2550\u2550\u2550');
      console.log(`  URL: ${url}`);
      console.log(`  Sections: ${scan.sections.length}`);
      console.log(`  Elements: ${scan.totalElements}`);
      console.log(`  Estimated images: ${imageCount}`);
      console.log(`  Estimated videos: ${videoCount}`);
      console.log(
        `  Detected animations: ${animationResult.totalDetected}`,
      );
      console.log(
        `  Detected libraries: ${animationResult.libraries.map((l) => l.name).join(', ') || 'none'}`,
      );
      console.log(
        `  Smooth scroll: ${animationResult.globalScrollBehavior}`,
      );
      console.log(
        `  Estimated extraction time: ${estimateTime(scan.totalElements, scan.sections.length)}s`,
      );
      console.log(`  Estimated builders needed: ${scan.sections.length}`);
      console.log(
        '  \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550',
      );
      console.log('');
      console.log(
        '  Run without --dry-run to proceed with full extraction.',
      );

      await context.close();
      process.exit(0);
    }

    // -----------------------------------------------------------------------
    // Section filtering (--only-sections)
    // -----------------------------------------------------------------------
    if (onlySections) {
      const filteredSections = scan.sections.filter(
        (s) => onlySections.includes(s.id) || onlySections.includes(s.name),
      );
      if (filteredSections.length === 0) {
        console.error(
          `\n  No sections matched: ${onlySections.join(', ')}`,
        );
        console.log(
          '  Available sections:',
          scan.sections.map((s) => `${s.id} (${s.name})`).join(', '),
        );
        process.exit(1);
      }
      console.log(
        `  Filtering to ${filteredSections.length} sections: ${filteredSections.map((s) => s.name).join(', ')}`,
      );
      scan.sections = filteredSections;
    }

    // Load cached page-data if --from-cache is specified (for fonts/assets reuse)
    let cachedPageData: PageData | null = null;
    if (fromCache) {
      try {
        const raw = await readFile(
          join(resolve(fromCache), 'page-data.json'),
          'utf-8',
        );
        cachedPageData = JSON.parse(raw) as PageData;
        console.log('  Loaded cached page-data.json for fonts/assets');
      } catch {
        console.warn(
          '  Warning: --from-cache specified but page-data.json not found, running full extraction',
        );
      }
    }

    const shouldSkipHeavy = cachedPageData !== null && onlySections !== null;

    // -----------------------------------------------------------------------
    // Phase 4: Parallel extraction (animations, fonts, assets, stylesheets)
    // -----------------------------------------------------------------------
    progress.startPhase(
      'Running parallel extraction (animations, fonts, assets, stylesheets)',
    );

    let animations;
    if (resume && checkpoint.isCompleted('animations')) {
      animations =
        checkpoint.getPhaseData<
          Awaited<ReturnType<typeof detectAnimations>>
        >('animations');
    }

    let fonts;
    if (shouldSkipHeavy) {
      fonts = {
        fonts: cachedPageData!.fonts,
        downloadedFiles: [],
        googleFontsUsed: [],
        selfHostedFonts: [],
        systemFonts: [],
      };
    } else if (resume && checkpoint.isCompleted('fonts')) {
      fonts =
        checkpoint.getPhaseData<Awaited<ReturnType<typeof extractFonts>>>(
          'fonts',
        );
    } else if (useCache) {
      fonts = await cache.get<Awaited<ReturnType<typeof extractFonts>>>(
        url,
        'fonts',
      );
    }

    let assets;
    if (shouldSkipHeavy) {
      assets = {
        manifest: cachedPageData!.assets,
        totalDownloaded: 0,
        totalSize: 0,
        errors: [],
      };
    } else if (resume && checkpoint.isCompleted('assets')) {
      assets =
        checkpoint.getPhaseData<Awaited<ReturnType<typeof collectAssets>>>(
          'assets',
        );
    } else if (useCache) {
      assets = await cache.get<Awaited<ReturnType<typeof collectAssets>>>(
        url,
        'assets',
      );
    }

    let stylesheetResult;
    if (resume && checkpoint.isCompleted('stylesheets')) {
      stylesheetResult =
        checkpoint.getPhaseData<
          Awaited<ReturnType<typeof scrapeStylesheets>>
        >('stylesheets');
    } else if (useCache) {
      stylesheetResult = await cache.get<
        Awaited<ReturnType<typeof scrapeStylesheets>>
      >(url, 'stylesheets');
    }

    const parallelTasks: Promise<void>[] = [];

    if (!animations) {
      parallelTasks.push(
        detectAnimations(page, {
          scrollProbe: true,
          hoverProbe: true,
        }).then(async (r) => {
          animations = r;
          await checkpoint.markCompleted('animations', r);
        }),
      );
    }
    if (!fonts) {
      parallelTasks.push(
        extractFonts(page, outputDir).then(async (r) => {
          fonts = r;
          await checkpoint.markCompleted('fonts', r);
          if (useCache) await cache.set(url, 'fonts', r);
        }),
      );
    }
    if (!assets) {
      parallelTasks.push(
        collectAssets(page, { outputDir }).then(async (r) => {
          assets = r;
          await checkpoint.markCompleted('assets', r);
          if (useCache) await cache.set(url, 'assets', r);
        }),
      );
    }
    if (!stylesheetResult) {
      parallelTasks.push(
        scrapeStylesheets(page).then(async (r) => {
          stylesheetResult = r;
          await checkpoint.markCompleted('stylesheets', r);
          if (useCache) await cache.set(url, 'stylesheets', r);
        }),
      );
    }

    if (parallelTasks.length > 0) {
      await Promise.all(parallelTasks);
    }
    progress.endPhase();

    // -----------------------------------------------------------------------
    // Phase 5: Interactions (needs clean page state — never cached)
    // -----------------------------------------------------------------------
    progress.startPhase('Mapping interactions');
    let interactions;
    if (resume && checkpoint.isCompleted('interactions')) {
      interactions =
        checkpoint.getPhaseData<
          Awaited<ReturnType<typeof mapInteractions>>
        >('interactions');
    }
    if (!interactions) {
      interactions = await mapInteractions(page);
      await checkpoint.markCompleted('interactions', interactions);
    }
    progress.endPhase();

    // -----------------------------------------------------------------------
    // Phase 6: Screenshots — batched with reduced per-shot wait (100ms)
    // -----------------------------------------------------------------------
    progress.startPhase('Capturing section screenshots');
    const screenshotsDir = join(outputDir, 'screenshots');
    await mkdir(screenshotsDir, { recursive: true });

    let screenshotCount = 0;
    if (!(resume && checkpoint.isCompleted('screenshots'))) {
      for (
        let i = 0;
        i < scan.sections.length;
        i += SCREENSHOT_BATCH_SIZE
      ) {
        const batch = scan.sections.slice(i, i + SCREENSHOT_BATCH_SIZE);
        for (const section of batch) {
          try {
            await page.evaluate(
              (top: number) => window.scrollTo(0, top),
              section.boundingRect.top,
            );
            await page.waitForTimeout(100);
            const clipHeight = Math.min(section.boundingRect.height, 2000);
            if (clipHeight > 0) {
              await page.screenshot({
                path: join(screenshotsDir, `${section.id}.png`),
                clip: {
                  x: 0,
                  y: 0,
                  width: VIEWPORT.width,
                  height: Math.min(clipHeight, VIEWPORT.height),
                },
              });
              screenshotCount++;
            }
          } catch {
            // Section may be off-screen or zero-height — skip
          }
        }
      }

      // Full-page screenshot (skip if only-sections mode)
      if (!onlySections) {
        await page.screenshot({
          path: join(screenshotsDir, 'full-page.png'),
          fullPage: true,
        });
      }

      await checkpoint.markCompleted('screenshots');
    }
    progress.endPhase(`${screenshotCount} screenshots captured`);

    // -----------------------------------------------------------------------
    // Phase 7: Merge
    // -----------------------------------------------------------------------
    progress.startPhase('Merging extraction data');
    const pageData = mergeExtractionData({
      url,
      scan,
      animations: animations!,
      fonts: fonts!,
      assets: assets!,
      interactions: interactions!,
      stylesheets: stylesheetResult!,
      viewport: VIEWPORT,
    });
    progress.endPhase();

    // -----------------------------------------------------------------------
    // Phase 8: Write outputs
    // -----------------------------------------------------------------------
    progress.startPhase('Writing output files');
    const jsonPath = join(outputDir, 'page-data.json');
    const summaryPath = join(outputDir, 'EXTRACTION_SUMMARY.md');

    await Promise.all([
      writeFile(jsonPath, JSON.stringify(pageData, null, 2), 'utf-8'),
      writeFile(
        summaryPath,
        generateSummaryMarkdown(url, progress.elapsedMs),
        'utf-8',
      ),
    ]);

    await checkpoint.markCompleted('merge');
    progress.endPhase();

    // -----------------------------------------------------------------------
    // Phase 9: Generate builder prompts
    // -----------------------------------------------------------------------
    progress.startPhase('Generating builder prompts');
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

    await checkpoint.markCompleted('prompts');
    progress.endPhase(`${prompts.length} prompts in docs/research/prompts/`);

    // Clean checkpoint on successful completion
    await checkpoint.clear();

    await context.close();

    progress.summary();
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
