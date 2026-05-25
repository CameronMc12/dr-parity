import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

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

/**
 * Build an ignore-mask from two consecutive reference loads. Any pixel that
 * differs between the two reference screenshots is non-deterministic
 * (timestamps, avatars, random ids, animations) and is excluded from scoring.
 * Returns a Uint8Array where 1 = ignore this pixel.
 */
function buildIgnoreMask(refA: PNG, refB: PNG, width: number, height: number): Uint8Array {
  const a = cropToSize(refA, width, height);
  const b = cropToSize(refB, width, height);
  const mask = new Uint8Array(width * height);
  const maskDiff = new PNG({ width, height });
  pixelmatch(a.data, b.data, maskDiff.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
    diffMask: true,
  });
  // diffMask draws differing pixels with alpha > 0 over a transparent bg.
  for (let i = 0; i < width * height; i++) {
    if (maskDiff.data[i * 4 + 3]! > 0) mask[i] = 1;
  }
  return mask;
}

export type MaskedDiffResult = {
  mismatchedPixels: number;
  totalPixels: number;
  maskedPixels: number;
  /** 0..1 visual similarity: 1 - (mismatch / (total - masked)). */
  visualScore: number;
  diffPath: string;
};

export type MaskedDiffInput = {
  /** Candidate screenshot. */
  candidatePath: string;
  /** Reference screenshot (the one scored against the candidate). */
  referencePath: string;
  /** Second reference load used to derive the non-determinism mask. */
  referencePathB: string;
  /** Where to write the diff image. */
  diffPath: string;
};

/**
 * Pixel-diff candidate vs reference with a non-determinism ignore-mask.
 * The mask is the set of pixels that differ between two reference loads.
 */
export async function maskedDiff(input: MaskedDiffInput): Promise<MaskedDiffResult> {
  const { candidatePath, referencePath, referencePathB, diffPath } = input;
  const [candPng, refPng, refPngB] = await Promise.all([
    readPng(candidatePath),
    readPng(referencePath),
    readPng(referencePathB),
  ]);

  const width = Math.min(candPng.width, refPng.width, refPngB.width);
  const height = Math.min(candPng.height, refPng.height, refPngB.height);
  if (width === 0 || height === 0) {
    throw new Error(
      `Empty screenshot dimensions (cand=${candPng.width}x${candPng.height} ref=${refPng.width}x${refPng.height})`,
    );
  }

  const ignoreMask = buildIgnoreMask(refPng, refPngB, width, height);
  let maskedPixels = 0;
  for (let i = 0; i < ignoreMask.length; i++) maskedPixels += ignoreMask[i]!;

  const cand = cropToSize(candPng, width, height);
  const ref = cropToSize(refPng, width, height);
  const diff = new PNG({ width, height });

  const rawMismatch = pixelmatch(cand.data, ref.data, diff.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
  });

  // Re-count mismatches excluding masked pixels, and grey out masked regions
  // in the diff image so the report reader can see what was ignored.
  let mismatchedPixels = 0;
  for (let i = 0; i < width * height; i++) {
    const isDiffPixel = diff.data[i * 4]! === 255 && diff.data[i * 4 + 1]! === 0;
    if (ignoreMask[i] === 1) {
      diff.data[i * 4] = 200;
      diff.data[i * 4 + 1] = 200;
      diff.data[i * 4 + 2] = 0;
      diff.data[i * 4 + 3] = 120;
      continue;
    }
    if (isDiffPixel) mismatchedPixels++;
  }
  // rawMismatch is retained for parity with the base diff util but masked
  // counting above is authoritative.
  void rawMismatch;

  const totalPixels = width * height;
  const scoredPixels = totalPixels - maskedPixels;
  const visualScore = scoredPixels > 0 ? 1 - mismatchedPixels / scoredPixels : 1;

  const buf = await encodePng(diff);
  await writeFile(diffPath, buf);

  return {
    mismatchedPixels,
    totalPixels,
    maskedPixels,
    visualScore: Math.max(0, Math.min(1, visualScore)),
    diffPath,
  };
}
