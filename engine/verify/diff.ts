import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Viewport, ViewportResult } from './types';

const PIXELMATCH_THRESHOLD = 0.1;

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

function encodePng(png: PNG): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    png
      .pack()
      .on('data', (chunk: Buffer) => chunks.push(chunk as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function cropToSize(src: PNG, width: number, height: number): PNG {
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
}

export interface DiffInput {
  viewport: Viewport;
  clonePath: string;
  rebuiltPath: string;
}

export async function diffShot(
  input: DiffInput,
  thresholdRatio: number,
): Promise<ViewportResult> {
  const { viewport, clonePath, rebuiltPath } = input;
  let clonePng: PNG;
  let rebuiltPng: PNG;
  try {
    [clonePng, rebuiltPng] = await Promise.all([readPng(clonePath), readPng(rebuiltPath)]);
  } catch (err) {
    throw new Error(
      `Failed to load screenshots (viewport=${viewport.name}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const width = Math.min(clonePng.width, rebuiltPng.width);
  const height = Math.min(clonePng.height, rebuiltPng.height);
  if (width === 0 || height === 0) {
    throw new Error(
      `Empty screenshot dimensions (viewport=${viewport.name} clone=${clonePng.width}x${clonePng.height} rebuilt=${rebuiltPng.width}x${rebuiltPng.height})`,
    );
  }

  const a = cropToSize(clonePng, width, height);
  const b = cropToSize(rebuiltPng, width, height);
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
  });

  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? mismatchedPixels / totalPixels : 0;
  const diffPath = join(dirname(clonePath), 'diff.png');

  try {
    const buf = await encodePng(diff);
    await writeFile(diffPath, buf);
  } catch (err) {
    throw new Error(
      `Failed to write diff image (viewport=${viewport.name} file=${diffPath}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return {
    name: viewport.name,
    width: viewport.width,
    height: viewport.height,
    dsf: viewport.dsf,
    cloneShot: clonePath,
    rebuiltShot: rebuiltPath,
    diffShot: diffPath,
    mismatchedPixels,
    totalPixels,
    diffRatio,
    pass: diffRatio <= thresholdRatio,
  };
}
