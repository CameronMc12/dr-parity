#!/usr/bin/env tsx
/**
 * CLI entry point for multi-page extraction.
 *
 * Usage:
 *   npx tsx scripts/extract-multi.ts <url> --crawl [--max-pages 10]
 *   npx tsx scripts/extract-multi.ts <url> --pages https://site.com/about,https://site.com/blog
 *   npx tsx scripts/extract-multi.ts <url>  (single page, same as scripts/extract.ts)
 */

import { chromium } from 'playwright';
import {
  discoverPages,
  detectSharedLayout,
  detectRoutePatterns,
} from '../engine/extract/multi-page';
import type {
  MultiPageMode,
  MultiPageResult,
  PageExtractionEntry,
} from '../engine/extract/multi-page';
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
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import type { Page } from 'playwright';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  url: string;
  mode: MultiPageMode;
  pageList: string[];
  maxPages: number;
  outputDir: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error(
      'Usage: npx tsx scripts/extract-multi.ts <url> [--pages url1,url2] [--crawl] [--max-pages 10] [--output dir]',
    );
    process.exit(1);
  }

  let mode: MultiPageMode = 'single';
  const pageList: string[] = [];
  let maxPages = 20;

  let outputDir = 'docs/research';
  const outputIdx = args.indexOf('--output');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputDir = args[outputIdx + 1];
  }

  const pagesArg = args.find((a) => a.startsWith('--pages='));
  if (pagesArg) {
    mode = 'multi-manual';
    const list = pagesArg.split('=')[1];
    if (list) {
      pageList.push(...list.split(',').filter(Boolean));
    }
  } else if (args.includes('--pages')) {
    const pagesIdx = args.indexOf('--pages');
    if (args[pagesIdx + 1] && !args[pagesIdx + 1].startsWith('--')) {
      mode = 'multi-manual';
      pageList.push(...args[pagesIdx + 1].split(',').filter(Boolean));
    }
  }

  if (args.includes('--crawl')) {
    mode = 'multi-crawl';
  }

  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  if (maxPagesArg) {
    maxPages = parseInt(maxPagesArg.split('=')[1], 10) || 20;
  } else {
    const maxIdx = args.indexOf('--max-pages');
    if (maxIdx !== -1 && args[maxIdx + 1]) {
      maxPages = parseInt(args[maxIdx + 1], 10) || 20;
    }
  }

  return {
    url,
    mode,
    pageList,
    maxPages,
    outputDir: resolve(outputDir),
  };
}

// ---------------------------------------------------------------------------
// Smart wait (duplicated from extract.ts for independence)
// ---------------------------------------------------------------------------

async function smartWait(page: Page, maxWait = 5000): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.waitForTimeout(Math.min(maxWait, 3000)),
  ]);

  await Promise.race([
    page
      .evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready)
      .catch(() => {}),
    page.waitForTimeout(1000),
  ]);
}

// ---------------------------------------------------------------------------
// Per-page extraction (reuses browser context)
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1440, height: 900 };

async function extractSinglePage(
  page: Page,
  url: string,
  outputDir: string,
): ReturnType<typeof mergeExtractionData> extends infer R ? Promise<R> : never {
  await injectAnimationMonitors(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await smartWait(page);

  const [scan, animations, fonts, assets, stylesheets, interactions] = await Promise.all([
    scanPage(page, { maxDepth: 8 }),
    detectAnimations(page, { scrollProbe: true, hoverProbe: true }),
    extractFonts(page, outputDir),
    collectAssets(page, { outputDir }),
    scrapeStylesheets(page),
    mapInteractions(page),
  ]);

  return mergeExtractionData({
    url,
    scan,
    animations,
    fonts,
    assets,
    interactions,
    stylesheets,
    viewport: VIEWPORT,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { url, mode, pageList, maxPages, outputDir } = parseArgs();

  console.log(`Multi-page extraction: ${url}`);
  console.log(`  Mode:       ${mode}`);
  console.log(`  Output:     ${outputDir}`);
  if (mode === 'multi-manual') console.log(`  Pages:      ${pageList.join(', ')}`);
  if (mode === 'multi-crawl') console.log(`  Max pages:  ${maxPages}`);
  console.log('');

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    // Fix esbuild __name helper
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__defProp = Object.defineProperty;
      (window as unknown as Record<string, unknown>).__name = (fn: unknown) => fn;
    });

    // Determine pages to extract
    let urls: string[];

    if (mode === 'multi-crawl') {
      console.log('Discovering pages...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await smartWait(page);
      urls = await discoverPages(page, url, maxPages);
      console.log(`  Found ${urls.length} pages`);
    } else if (mode === 'multi-manual') {
      urls = [url, ...pageList.filter((u) => u !== url)];
    } else {
      urls = [url];
    }

    // Extract each page
    const entries: PageExtractionEntry[] = [];
    const homePath = new URL(url).pathname;

    for (let i = 0; i < urls.length; i++) {
      const pageUrl = urls[i];
      const path = new URL(pageUrl).pathname;
      console.log(`\n  [${i + 1}/${urls.length}] Extracting: ${pageUrl}`);

      try {
        const pageData = await extractSinglePage(page, pageUrl, outputDir);
        entries.push({
          url: pageUrl,
          path: path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path,
          pageData,
          isHomepage: path === homePath || path === '/',
        });
        console.log(`    Done (${pageData.sections.length} sections)`);
      } catch (err) {
        console.error(`    Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Detect shared layout and route patterns
    const allPageData = entries.map((e) => e.pageData);
    const sharedLayout = entries.length > 1 ? detectSharedLayout(allPageData) : undefined;
    const allPaths = entries.map((e) => e.path);
    const routes = detectRoutePatterns(allPaths);

    const result: MultiPageResult = {
      pages: entries,
      sharedLayout,
      routes,
      totalPages: entries.length,
    };

    // Write output
    const jsonPath = join(outputDir, 'multi-page-data.json');
    await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log('\n  === MULTI-PAGE EXTRACTION SUMMARY ===');
    console.log(`  Pages extracted: ${entries.length}`);
    console.log(`  Routes detected: ${routes.length}`);
    if (sharedLayout) {
      console.log(`  Shared sections: ${sharedLayout.sharedSectionIds.length}`);
      if (sharedLayout.headerSelector) console.log(`  Header: ${sharedLayout.headerSelector}`);
      if (sharedLayout.footerSelector) console.log(`  Footer: ${sharedLayout.footerSelector}`);
      if (sharedLayout.navSelector) console.log(`  Nav: ${sharedLayout.navSelector}`);
    }
    for (const route of routes) {
      const label = route.isDynamic ? 'dynamic' : 'static';
      console.log(`    ${route.pattern} (${label}, ${route.pageCount} page${route.pageCount > 1 ? 's' : ''})`);
    }
    console.log(`  Output: ${jsonPath}`);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Multi-page extraction failed:', err);
  process.exit(1);
});
