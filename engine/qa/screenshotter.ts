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
import {
  applyContentMasks,
  type ContentMask,
  type MaskFireReport,
  type MaskViewport,
} from './content-masker';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScreenshotSet {
  original: ViewportScreenshots;
  clone: ViewportScreenshots;
  /** Mask fire reports keyed by `{site}-{viewport}`. */
  maskReports?: Record<string, MaskFireReport[]>;
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

interface TakeScreenshotResult {
  path: string;
  maskReports: MaskFireReport[];
}

async function takeScreenshot(
  browser: Browser,
  url: string,
  viewport: ViewportConfig,
  outputPath: string,
  fullPage: boolean,
  assetWaitOptions?: AssetWaitOptions,
  contentMasks?: ContentMask,
): Promise<TakeScreenshotResult> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page: Page = await context.newPage();

  let maskReports: MaskFireReport[] = [];

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: NETWORK_IDLE_TIMEOUT,
    });

    // Wait for fonts, images, and videos to finish loading
    await waitForAssetsToLoad(page, assetWaitOptions);

    // Mask dynamic content (timestamps, cookie banners, etc.)
    const viewportName = viewport.name as MaskViewport;
    const { cleanup, fired } = await applyContentMasks(
      page,
      contentMasks,
      viewportName,
    );
    maskReports = fired;

    try {
      await page.screenshot({ path: outputPath, fullPage });
    } finally {
      await cleanup();
    }
  } finally {
    await context.close();
  }

  return { path: outputPath, maskReports };
}

// ---------------------------------------------------------------------------
// Hover state capture
// ---------------------------------------------------------------------------

/** CSS properties whose change in a `:hover` rule indicates a meaningful visual diff. */
const HOVER_RELEVANT_PROPERTIES = new Set([
  'transform',
  'background',
  'background-color',
  'background-image',
  'color',
  'box-shadow',
  'opacity',
  'border',
  'border-color',
  'filter',
  'scale',
]);

export interface HoverStateScreenshot {
  selector: string;
  /** Element label (textContent or aria-label, truncated). */
  label: string;
  /** Path to the captured hover screenshot PNG. */
  path: string;
  viewport: string;
}

export interface HoverStyleRule {
  selector: string;
  properties: Record<string, string>;
}

export interface CaptureHoverOptions {
  /** Output directory for hover screenshots. */
  outputDir: string;
  /** Extracted stylesheet rules; the helper picks out `:hover` rules. */
  hoverRules?: HoverStyleRule[];
  /** Optional explicit selectors (overrides hoverRules detection). */
  selectors?: string[];
  /** Cap on number of elements to hover. Default 30. */
  maxElements?: number;
  /** Padding (px) around element bounding box. Default 20. */
  paddingPx?: number;
  /** Wait time (ms) for the hover transition. Default 400. */
  hoverWaitMs?: number;
  /** Viewport name for screenshot filename. */
  viewport?: string;
}

/**
 * Find selectors that have a `:hover` rule changing a visually-relevant property.
 * Reads from already-extracted stylesheet data — no live DOM detection needed.
 */
export function findHoverCandidateSelectors(
  hoverRules: HoverStyleRule[],
): string[] {
  const candidates = new Set<string>();
  for (const rule of hoverRules) {
    if (!rule.selector.includes(':hover')) continue;

    const hasRelevant = Object.keys(rule.properties).some((prop) =>
      HOVER_RELEVANT_PROPERTIES.has(prop.toLowerCase()),
    );
    if (!hasRelevant) continue;

    // Strip pseudo-class and other compound selectors (split on comma for multi-selector rules)
    for (const part of rule.selector.split(',')) {
      const baseSelector = part
        .replace(/:hover\b/g, '')
        .replace(/:focus\b/g, '')
        .replace(/:active\b/g, '')
        .trim();
      if (baseSelector.length > 0) candidates.add(baseSelector);
    }
  }
  return Array.from(candidates);
}

/**
 * Hover each candidate element on `page`, wait for transitions to settle, and
 * capture a tight bounding-box screenshot.
 *
 * Caps at `maxElements` (default 30) to keep QA runs fast.
 */
export async function captureHoverStates(
  page: Page,
  options: CaptureHoverOptions,
): Promise<HoverStateScreenshot[]> {
  const {
    outputDir,
    hoverRules = [],
    selectors,
    maxElements = 30,
    paddingPx = 20,
    hoverWaitMs = 400,
    viewport = 'desktop',
  } = options;

  await mkdir(outputDir, { recursive: true });

  const candidateSelectors =
    selectors && selectors.length > 0
      ? selectors
      : findHoverCandidateSelectors(hoverRules);

  if (candidateSelectors.length === 0) return [];

  const results: HoverStateScreenshot[] = [];
  const seen = new Set<string>();

  for (const selector of candidateSelectors) {
    if (results.length >= maxElements) break;

    let locator;
    try {
      locator = page.locator(selector).first();
    } catch {
      continue;
    }

    // Skip if not visible
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const box = await locator.boundingBox().catch(() => null);
    if (!box || box.width <= 0 || box.height <= 0) continue;

    // Dedupe by bounding-box position to avoid re-capturing the same element
    const key = `${Math.round(box.x)}-${Math.round(box.y)}-${Math.round(box.width)}-${Math.round(box.height)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 1000 });
      await locator.hover({ timeout: 1000 });
      await page.waitForTimeout(hoverWaitMs);
    } catch {
      continue;
    }

    // Recompute box AFTER hover (transform may move it)
    const hoveredBox = await locator.boundingBox().catch(() => null);
    if (!hoveredBox) continue;

    const clip = {
      x: Math.max(0, hoveredBox.x - paddingPx),
      y: Math.max(0, hoveredBox.y - paddingPx),
      width: hoveredBox.width + paddingPx * 2,
      height: hoveredBox.height + paddingPx * 2,
    };

    const label = await locator
      .evaluate((el) => {
        const text = (el.textContent ?? '').trim().slice(0, 40);
        return text.length > 0 ? text : (el as HTMLElement).getAttribute('aria-label') ?? el.tagName;
      })
      .catch(() => 'unknown');

    const safeLabel = String(results.length).padStart(3, '0');
    const filename = `hover-${viewport}-${safeLabel}.png`;
    const filepath = join(outputDir, filename);

    try {
      await page.screenshot({ path: filepath, clip });
      results.push({ selector, label, path: filepath, viewport });
    } catch {
      // skip
    }

    // Move mouse away to reset hover state for next iteration
    await page.mouse.move(0, 0).catch(() => {});
    await page.waitForTimeout(50);
  }

  return results;
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
  const maskReports: Record<string, MaskFireReport[]> = {};

  // Process each viewport sequentially to avoid resource contention
  for (const vp of viewports) {
    const originalPath = join(outputDir, buildFilename('original', vp.name));
    const clonePath = join(outputDir, buildFilename('clone', vp.name));

    // Capture original and clone in parallel for the same viewport
    const [origResult, cloneResult] = await Promise.all([
      takeScreenshot(browser, originalUrl, vp, originalPath, fullPage, assetWaitOptions, contentMasks),
      takeScreenshot(browser, cloneUrl, vp, clonePath, fullPage, assetWaitOptions, contentMasks),
    ]);

    original[vp.name] = origResult.path;
    clone[vp.name] = cloneResult.path;
    maskReports[`original-${vp.name}`] = origResult.maskReports;
    maskReports[`clone-${vp.name}`] = cloneResult.maskReports;
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
    maskReports,
  };
}
