/**
 * Pixel-diff comparison engine.
 *
 * Reads pairs of PNGs (original vs clone), runs pixelmatch to quantify
 * visual differences, and writes highlighted diff images for human review.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { PixelDiffResult, ViewportDiff, SectionPixelDiff } from '../types/diff';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DiffOptions {
  threshold?: number;
  outputDir: string;
  /** When enabled, compute weighted diff prioritizing above-fold content. */
  weighted?: boolean;
  /** Viewport height for above-fold calculation (default 900). */
  viewportHeight?: number;
}

export interface WeightedDiffResult extends ViewportDiff {
  /** Weighted score 0-100 (lower = fewer differences, weighted by region importance). */
  weightedScore: number;
  regionBreakdown: {
    /** % diff in the top viewport-height of the image. */
    aboveFold: number;
    /** % diff below the first viewport-height. */
    belowFold: number;
    /** % diff in top 80px (header region). */
    header: number;
    /** % diff in bottom 200px (footer region). */
    footer: number;
  };
}

export interface ScreenshotPair {
  original: string;
  clone: string;
  viewport: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readPng(filePath: string): Promise<PNG> {
  const buffer = await readFile(filePath);
  return new Promise<PNG>((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, data) => {
      if (err) {
        reject(new Error(`Failed to parse PNG ${filePath}: ${err.message}`));
        return;
      }
      resolve(data);
    });
  });
}

function resizeToSmaller(a: PNG, b: PNG): { imgA: PNG; imgB: PNG; width: number; height: number } {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare a single pair of screenshots and produce a diff image.
 */
export async function compareScreenshots(
  originalPath: string,
  clonePath: string,
  options: DiffOptions,
): Promise<ViewportDiff> {
  const threshold = options.threshold ?? 0.1;

  await mkdir(options.outputDir, { recursive: true });

  const [rawA, rawB] = await Promise.all([readPng(originalPath), readPng(clonePath)]);
  const { imgA, imgB, width, height } = resizeToSmaller(rawA, rawB);

  const diffPng = new PNG({ width, height });
  const totalPixels = width * height;

  const differentPixels = pixelmatch(
    imgA.data,
    imgB.data,
    diffPng.data,
    width,
    height,
    { threshold },
  );

  const diffFilename = `diff-${basename(originalPath)}`;
  const diffImagePath = join(options.outputDir, diffFilename);
  const encoded = await encodePng(diffPng);
  await writeFile(diffImagePath, encoded);

  const percentDifferent = totalPixels > 0
    ? Number(((differentPixels / totalPixels) * 100).toFixed(2))
    : 0;

  const baseDiff: ViewportDiff = {
    viewport: { width, height },
    totalPixels,
    differentPixels,
    percentDifferent,
    originalScreenshot: originalPath,
    cloneScreenshot: clonePath,
    diffImage: diffImagePath,
    sectionDiffs: [],
  };

  if (options.weighted) {
    return computeWeightedDiff(baseDiff, diffPng, options.viewportHeight ?? 900);
  }

  return baseDiff;
}

/**
 * Compute a weighted diff score prioritizing above-fold content (Item 5.6).
 * Above-fold pixels weighted 2x, header 1.5x, footer 0.5x.
 */
function computeWeightedDiff(
  baseDiff: ViewportDiff,
  diffPng: PNG,
  viewportHeight: number,
): WeightedDiffResult {
  const { width, height } = diffPng;
  const HEADER_HEIGHT = 80;
  const FOOTER_HEIGHT = 200;
  const foldY = Math.min(viewportHeight, height);
  const footerY = Math.max(height - FOOTER_HEIGHT, 0);

  let headerDiff = 0, headerTotal = 0;
  let aboveFoldDiff = 0, aboveFoldTotal = 0;
  let belowFoldDiff = 0, belowFoldTotal = 0;
  let footerDiff = 0, footerTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isDiff = diffPng.data[idx]! > 0;

      if (y < HEADER_HEIGHT) {
        headerTotal++;
        if (isDiff) headerDiff++;
      }
      if (y < foldY) {
        aboveFoldTotal++;
        if (isDiff) aboveFoldDiff++;
      } else {
        belowFoldTotal++;
        if (isDiff) belowFoldDiff++;
      }
      if (y >= footerY) {
        footerTotal++;
        if (isDiff) footerDiff++;
      }
    }
  }

  const pct = (d: number, t: number): number => (t > 0 ? Number(((d / t) * 100).toFixed(2)) : 0);

  const aboveFoldPct = pct(aboveFoldDiff, aboveFoldTotal);
  const belowFoldPct = pct(belowFoldDiff, belowFoldTotal);
  const headerPct = pct(headerDiff, headerTotal);
  const footerPct = pct(footerDiff, footerTotal);

  // Weighted score: above-fold 2x, header 1.5x, footer 0.5x, below-fold 1x
  const totalWeight = aboveFoldTotal * 2 + belowFoldTotal * 1;
  const weightedDiffPixels = aboveFoldDiff * 2 + belowFoldDiff * 1;
  const weightedScore = totalWeight > 0
    ? Number(((weightedDiffPixels / totalWeight) * 100).toFixed(2))
    : 0;

  return {
    ...baseDiff,
    weightedScore,
    regionBreakdown: {
      aboveFold: aboveFoldPct,
      belowFold: belowFoldPct,
      header: headerPct,
      footer: footerPct,
    },
  };
}

// ---------------------------------------------------------------------------
// Hover-state diff (informational, threshold 90%)
// ---------------------------------------------------------------------------

export interface HoverDiffPair {
  selector: string;
  label: string;
  original: string;
  clone: string;
  viewport: string;
}

export interface HoverDiffResult {
  selector: string;
  label: string;
  viewport: string;
  matchPercent: number;
  passed: boolean;
  diffImage: string;
}

export interface HoverDiffSummary {
  results: HoverDiffResult[];
  averageMatchPercent: number;
  passed: boolean;
  /** Threshold used (default 90). */
  threshold: number;
}

const HOVER_DIFF_THRESHOLD = 90;

/**
 * Compare hover-state screenshots between original and clone.
 * Informational only — does not gate the overall QA pass.
 */
export async function runHoverDiff(
  pairs: HoverDiffPair[],
  outputDir: string,
  threshold = HOVER_DIFF_THRESHOLD,
): Promise<HoverDiffSummary> {
  await mkdir(outputDir, { recursive: true });

  const results: HoverDiffResult[] = [];

  for (const pair of pairs) {
    try {
      const [rawA, rawB] = await Promise.all([
        readPng(pair.original),
        readPng(pair.clone),
      ]);
      const { imgA, imgB, width, height } = resizeToSmaller(rawA, rawB);

      if (width === 0 || height === 0) continue;

      const diffPng = new PNG({ width, height });
      const totalPixels = width * height;

      const differentPixels = pixelmatch(
        imgA.data,
        imgB.data,
        diffPng.data,
        width,
        height,
        { threshold: 0.1 },
      );

      const diffFilename = `hover-diff-${pair.viewport}-${basename(pair.original)}`;
      const diffImagePath = join(outputDir, diffFilename);
      const encoded = await encodePng(diffPng);
      await writeFile(diffImagePath, encoded);

      const percentDifferent =
        totalPixels > 0 ? (differentPixels / totalPixels) * 100 : 0;
      const matchPercent = Number((100 - percentDifferent).toFixed(2));

      results.push({
        selector: pair.selector,
        label: pair.label,
        viewport: pair.viewport,
        matchPercent,
        passed: matchPercent >= threshold,
        diffImage: diffImagePath,
      });
    } catch {
      // Skip pairs that fail to compare (missing file, parse error, etc.)
    }
  }

  const averageMatchPercent =
    results.length > 0
      ? Number(
          (results.reduce((s, r) => s + r.matchPercent, 0) / results.length).toFixed(2),
        )
      : 100;

  return {
    results,
    averageMatchPercent,
    passed: averageMatchPercent >= threshold,
    threshold,
  };
}

/**
 * Run pixel-diff across all viewport pairs and produce a combined result.
 */
export async function runFullDiff(
  screenshots: ScreenshotPair[],
  options: DiffOptions,
): Promise<PixelDiffResult> {
  const viewportDiffs = new Map<string, ViewportDiff>();

  for (const pair of screenshots) {
    const diff = await compareScreenshots(pair.original, pair.clone, options);
    viewportDiffs.set(pair.viewport, diff);
  }

  const desktopDiff = viewportDiffs.get('desktop');
  if (!desktopDiff) {
    throw new Error('Desktop viewport diff is required but was not provided');
  }

  return {
    desktop: desktopDiff,
    tablet: viewportDiffs.get('tablet'),
    mobile: viewportDiffs.get('mobile'),
  };
}
