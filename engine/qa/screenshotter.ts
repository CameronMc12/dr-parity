/**
 * Screenshot capture module for QA comparison.
 *
 * Takes full-page screenshots of both the original site and the local clone
 * across multiple viewports, saving them as PNGs for pixel-diff analysis.
 */

import type { Browser, Page } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { waitForAssetsToLoad, type AssetWaitOptions } from './asset-waiter';
import { applyContentMasks, type ContentMask } from './content-masker';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScreenshotSet {
  original: ViewportScreenshots;
  clone: ViewportScreenshots;
}

export interface ViewportScreenshots {
  desktop: string;
  tablet?: string;
  mobile?: string;
}

export interface ScreenshotOptions {
  originalUrl: string;
  cloneUrl: string;
  outputDir: string;
  viewports?: ViewportConfig[];
  fullPage?: boolean;
  /** Options for asset-load waiting before each capture. */
  assetWaitOptions?: AssetWaitOptions;
  /** Content masks to apply before capturing (hides dynamic content). */
  contentMasks?: ContentMask;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const NETWORK_IDLE_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFilename(site: 'original' | 'clone', viewport: string): string {
  return `${site}-${viewport}.png`;
}

async function takeScreenshot(
  browser: Browser,
  url: string,
  viewport: ViewportConfig,
  outputPath: string,
  fullPage: boolean,
  assetWaitOptions?: AssetWaitOptions,
  contentMasks?: ContentMask,
): Promise<string> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page: Page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: NETWORK_IDLE_TIMEOUT,
    });

    // Wait for fonts, images, and videos to finish loading
    await waitForAssetsToLoad(page, assetWaitOptions);

    // Mask dynamic content (timestamps, cookie banners, etc.)
    const restoreMasks = await applyContentMasks(page, contentMasks);

    try {
      await page.screenshot({ path: outputPath, fullPage });
    } finally {
      await restoreMasks();
    }
  } finally {
    await context.close();
  }

  return outputPath;
}

// ---------------------------------------------------------------------------
// Scroll frame capture (Item 5.7)
// ---------------------------------------------------------------------------

/**
 * Capture multiple frames of a page at evenly-spaced scroll positions.
 * Useful for comparing scroll animation progression between original and clone.
 */
export async function captureScrollFrames(
  page: Page,
  outputDir: string,
  frameCount?: number,
): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });

  const totalHeight = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  const frames = frameCount ?? 5;
  const paths: string[] = [];

  for (let i = 0; i < frames; i++) {
    const scrollY = frames > 1
      ? Math.round((totalHeight * i) / (frames - 1))
      : 0;
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(200);
    const path = join(outputDir, `frame-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path });
    paths.push(path);
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture screenshots of both the original site and the local clone across
 * the configured viewports.
 *
 * Returns file paths to all captured PNGs, grouped by site and viewport.
 */
export async function captureScreenshots(
  browser: Browser,
  options: ScreenshotOptions,
): Promise<ScreenshotSet> {
  const {
    originalUrl,
    cloneUrl,
    outputDir,
    viewports = DEFAULT_VIEWPORTS,
    fullPage = true,
    assetWaitOptions,
    contentMasks,
  } = options;

  await mkdir(outputDir, { recursive: true });

  const original: Record<string, string> = {};
  const clone: Record<string, string> = {};

  // Process each viewport sequentially to avoid resource contention
  for (const vp of viewports) {
    const originalPath = join(outputDir, buildFilename('original', vp.name));
    const clonePath = join(outputDir, buildFilename('clone', vp.name));

    // Capture original and clone in parallel for the same viewport
    const [origResult, cloneResult] = await Promise.all([
      takeScreenshot(browser, originalUrl, vp, originalPath, fullPage, assetWaitOptions, contentMasks),
      takeScreenshot(browser, cloneUrl, vp, clonePath, fullPage, assetWaitOptions, contentMasks),
    ]);

    original[vp.name] = origResult;
    clone[vp.name] = cloneResult;
  }

  return {
    original: {
      desktop: original['desktop'] ?? '',
      tablet: original['tablet'],
      mobile: original['mobile'],
    },
    clone: {
      desktop: clone['desktop'] ?? '',
      tablet: clone['tablet'],
      mobile: clone['mobile'],
    },
  };
}
