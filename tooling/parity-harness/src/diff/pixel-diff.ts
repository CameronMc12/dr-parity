import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { ShellRegion } from '../config.js';

export interface PixelDiffResult {
  score: number;       // 1 - (diffPixels / totalPixels)
  diffPixels: number;
  totalPixels: number;
  diffPng: Buffer;     // PNG buffer of the diff image
  maskedOraclePng?: Buffer; // only set when mask was applied
  maskedReactPng?: Buffer;  // only set when mask was applied
}

/**
 * Resolves shell regions to concrete pixel rectangles given the canvas height.
 */
export function resolveRegions(
  regions: ShellRegion[],
  canvasHeight: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  return regions.map(r => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h === 'fullHeight' ? canvasHeight : r.h,
  }));
}

/**
 * Applies a shell mask to a PNG in-place.
 * Every pixel NOT covered by any of the resolved regions is set to solid black (0,0,0,255).
 * Returns the mutated PNG (same reference).
 */
export function applyShellMask(
  png: PNG,
  regions: Array<{ x: number; y: number; w: number; h: number }>,
): PNG {
  const { width, height, data } = png;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const inRegion = regions.some(
        r => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h,
      );
      if (!inRegion) {
        const idx = (py * width + px) * 4;
        data[idx]     = 0;   // R
        data[idx + 1] = 0;   // G
        data[idx + 2] = 0;   // B
        data[idx + 3] = 255; // A — fully opaque black
      }
    }
  }
  return png;
}

/**
 * Compares two PNG buffers with pixelmatch.
 * Images are padded to the same dimensions before comparison
 * (taller oracle vs shorter react clone is common early in development).
 *
 * When shellRegions is provided, pixels outside the shell are blacked out
 * on both images before comparison so only shell-chrome pixels are scored.
 *
 * Returns score in [0, 1] where 1.0 = identical.
 */
export function pixelDiff(
  oracleBuf: Buffer,
  reactBuf: Buffer,
  perPixelThreshold = 0.1,
  shellRegions?: ShellRegion[],
): PixelDiffResult {
  const oracle = PNG.sync.read(oracleBuf);
  const react = PNG.sync.read(reactBuf);

  const width = Math.max(oracle.width, react.width);
  const height = Math.max(oracle.height, react.height);
  const totalPixels = width * height;

  // Pad both images to the same canvas (extra pixels default to transparent = 0)
  const paddedOracle = padPng(oracle, width, height);
  const paddedReact = padPng(react, width, height);

  let maskedOraclePng: Buffer | undefined;
  let maskedReactPng: Buffer | undefined;

  if (shellRegions && shellRegions.length > 0) {
    const resolved = resolveRegions(shellRegions, height);
    applyShellMask(paddedOracle, resolved);
    applyShellMask(paddedReact, resolved);
    maskedOraclePng = PNG.sync.write(paddedOracle);
    maskedReactPng = PNG.sync.write(paddedReact);
  }

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    paddedOracle.data,
    paddedReact.data,
    diff.data,
    width,
    height,
    { threshold: perPixelThreshold },
  );

  const score = totalPixels === 0 ? 1 : 1 - diffPixels / totalPixels;
  const diffPng = PNG.sync.write(diff);

  return { score, diffPixels, totalPixels, diffPng, maskedOraclePng, maskedReactPng };
}

function padPng(src: PNG, targetW: number, targetH: number): PNG {
  if (src.width === targetW && src.height === targetH) return src;
  const out = new PNG({ width: targetW, height: targetH });
  // Fill with zeros (transparent)
  out.data.fill(0);
  PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
  return out;
}
