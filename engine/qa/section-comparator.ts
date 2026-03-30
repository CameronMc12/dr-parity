/**
 * Section-by-section QA comparison engine.
 *
 * Instead of comparing entire full-page screenshots, this module scrolls to
 * each logical section of the page and compares the viewport-sized capture of
 * the original against the clone. This produces granular, per-section match
 * scores so fix agents know exactly which part of the page to focus on.
 */

import type { Browser, Page } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SectionCompareResult {
  sectionId: string;
  sectionName: string;
  pixelMatchPercent: number;
  diffImagePath: string;
  originalScreenshot: string;
  cloneScreenshot: string;
  passed: boolean;
  /** Which quadrants have the highest diff density (for fix guidance). */
  diffQuadrants: QuadrantAnalysis;
}

export interface SectionCompareOptions {
  originalUrl: string;
  cloneUrl: string;
  sections: SectionInfo[];
  outputDir: string;
  /** Minimum pixel-match percent to pass (default 95). */
  threshold?: number;
  /** pixelmatch color-distance threshold 0-1 (default 0.1). */
  pixelmatchThreshold?: number;
}

export interface SectionInfo {
  id: string;
  name: string;
  /** Scroll position (px from top) to reach this section. */
  scrollY: number;
  /** Section height in px. */
  height: number;
  /** Viewport height to capture (default 900). */
  viewportHeight?: number;
}

export interface QuadrantAnalysis {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 95;
const DEFAULT_PIXELMATCH_THRESHOLD = 0.1;
const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;
const SETTLE_DELAY_MS = 500;
const NETWORK_IDLE_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodePng(png: PNG): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    png
      .pack()
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function decodePng(buffer: Buffer): Promise<PNG> {
  return new Promise<PNG>((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, data) => {
      if (err) {
        reject(new Error(`Failed to parse PNG: ${err.message}`));
        return;
      }
      resolve(data);
    });
  });
}

/**
 * Crop both images to the smaller common dimensions so pixelmatch doesn't
 * throw on size mismatches (e.g. slightly different section heights).
 */
function normalizeToCommonSize(
  a: PNG,
  b: PNG,
): { imgA: PNG; imgB: PNG; width: number; height: number } {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);

  const crop = (src: PNG): PNG => {
    if (src.width === width && src.height === height) return src;
    const cropped = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * src.width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        cropped.data[dstIdx] = src.data[srcIdx]!;
        cropped.data[dstIdx + 1] = src.data[srcIdx + 1]!;
        cropped.data[dstIdx + 2] = src.data[srcIdx + 2]!;
        cropped.data[dstIdx + 3] = src.data[srcIdx + 3]!;
      }
    }
    return cropped;
  };

  return { imgA: crop(a), imgB: crop(b), width, height };
}

/**
 * Analyze which quadrants of the diff image contain the most differences.
 * Returns the percentage of differing pixels within each quadrant.
 */
function analyzeQuadrants(
  diffData: Uint8Array,
  width: number,
  height: number,
): QuadrantAnalysis {
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  let tlDiff = 0;
  let tlTotal = 0;
  let trDiff = 0;
  let trTotal = 0;
  let blDiff = 0;
  let blTotal = 0;
  let brDiff = 0;
  let brTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // pixelmatch writes diff pixels as non-zero in R channel
      const isDiff = diffData[idx]! > 0;

      if (y < midY) {
        if (x < midX) {
          tlTotal++;
          if (isDiff) tlDiff++;
        } else {
          trTotal++;
          if (isDiff) trDiff++;
        }
      } else {
        if (x < midX) {
          blTotal++;
          if (isDiff) blDiff++;
        } else {
          brTotal++;
          if (isDiff) brDiff++;
        }
      }
    }
  }

  const pct = (diff: number, total: number): number =>
    total > 0 ? Number(((diff / total) * 100).toFixed(1)) : 0;

  return {
    topLeft: pct(tlDiff, tlTotal),
    topRight: pct(trDiff, trTotal),
    bottomLeft: pct(blDiff, blTotal),
    bottomRight: pct(brDiff, brTotal),
  };
}

async function openAndNavigate(
  browser: Browser,
  url: string,
  viewportHeight: number,
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: viewportHeight },
  });
  const page = await context.newPage();
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: NETWORK_IDLE_TIMEOUT,
  });
  // Let post-load animations settle
  await page.waitForTimeout(1000);
  return page;
}

async function scrollAndCapture(
  page: Page,
  scrollY: number,
): Promise<Buffer> {
  await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(SETTLE_DELAY_MS);
  return page.screenshot({ fullPage: false });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare individual sections between the original and clone site.
 *
 * Opens both URLs, scrolls to each section's position, takes viewport
 * screenshots, and runs pixelmatch to quantify visual differences.
 *
 * Results are sorted worst-match-first so fix agents prioritize the
 * sections that need the most work.
 */
export async function compareSections(
  browser: Browser,
  options: SectionCompareOptions,
): Promise<SectionCompareResult[]> {
  const {
    originalUrl,
    cloneUrl,
    sections,
    outputDir,
    threshold = DEFAULT_THRESHOLD,
    pixelmatchThreshold = DEFAULT_PIXELMATCH_THRESHOLD,
  } = options;

  await mkdir(outputDir, { recursive: true });

  // Open both pages in parallel
  const defaultVpHeight =
    sections[0]?.viewportHeight ?? VIEWPORT_HEIGHT;

  const [originalPage, clonePage] = await Promise.all([
    openAndNavigate(browser, originalUrl, defaultVpHeight),
    openAndNavigate(browser, cloneUrl, defaultVpHeight),
  ]);

  const results: SectionCompareResult[] = [];

  try {
    for (const section of sections) {
      const vpHeight = section.viewportHeight ?? VIEWPORT_HEIGHT;

      // Resize viewports if this section specifies a different height
      if (vpHeight !== defaultVpHeight) {
        await Promise.all([
          originalPage.setViewportSize({ width: VIEWPORT_WIDTH, height: vpHeight }),
          clonePage.setViewportSize({ width: VIEWPORT_WIDTH, height: vpHeight }),
        ]);
      }

      // Scroll and capture both pages in parallel
      const [origBuffer, cloneBuffer] = await Promise.all([
        scrollAndCapture(originalPage, section.scrollY),
        scrollAndCapture(clonePage, section.scrollY),
      ]);

      // Save individual screenshots
      const origPath = join(outputDir, `original-${section.id}.png`);
      const clonePath = join(outputDir, `clone-${section.id}.png`);
      await Promise.all([
        writeFile(origPath, origBuffer),
        writeFile(clonePath, cloneBuffer),
      ]);

      // Decode and normalize
      const [origPng, clonePng] = await Promise.all([
        decodePng(origBuffer),
        decodePng(cloneBuffer),
      ]);
      const { imgA, imgB, width, height } = normalizeToCommonSize(origPng, clonePng);

      // Run pixelmatch
      const diffPng = new PNG({ width, height });
      const totalPixels = width * height;
      const differentPixels = pixelmatch(
        imgA.data,
        imgB.data,
        diffPng.data,
        width,
        height,
        { threshold: pixelmatchThreshold },
      );

      // Save diff image
      const diffPath = join(outputDir, `diff-${section.id}.png`);
      const diffEncoded = await encodePng(diffPng);
      await writeFile(diffPath, diffEncoded);

      // Compute match percentage
      const matchPercent =
        totalPixels > 0
          ? Number(((1 - differentPixels / totalPixels) * 100).toFixed(1))
          : 100;

      // Analyze diff distribution across quadrants
      const diffQuadrants = analyzeQuadrants(diffPng.data, width, height);

      results.push({
        sectionId: section.id,
        sectionName: section.name,
        pixelMatchPercent: matchPercent,
        diffImagePath: diffPath,
        originalScreenshot: origPath,
        cloneScreenshot: clonePath,
        passed: matchPercent >= threshold,
        diffQuadrants,
      });
    }
  } finally {
    // Close the browser contexts (pages are owned by contexts)
    await Promise.all([
      originalPage.context().close(),
      clonePage.context().close(),
    ]);
  }

  // Sort worst match first so fix agents tackle biggest issues first
  return results.sort((a, b) => a.pixelMatchPercent - b.pixelMatchPercent);
}
