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

  return {
    viewport: { width, height },
    totalPixels,
    differentPixels,
    percentDifferent,
    originalScreenshot: originalPath,
    cloneScreenshot: clonePath,
    diffImage: diffImagePath,
    sectionDiffs: [],
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
