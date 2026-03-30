/**
 * Screenshot capture module for QA comparison.
 *
 * Takes full-page screenshots of both the original site and the local clone
 * across multiple viewports, saving them as PNGs for pixel-diff analysis.
 */

import type { Browser, Page } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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

    // Allow any post-load animations to settle
    await page.waitForTimeout(1000);

    await page.screenshot({ path: outputPath, fullPage });
  } finally {
    await context.close();
  }

  return outputPath;
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
      takeScreenshot(browser, originalUrl, vp, originalPath, fullPage),
      takeScreenshot(browser, cloneUrl, vp, clonePath, fullPage),
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
