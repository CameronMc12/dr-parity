/**
 * Asset load verification for QA screenshots.
 *
 * Waits for fonts, images, and video metadata to load before capturing
 * screenshots, ensuring visual fidelity instead of relying on fixed timeouts.
 */

import type { Page } from 'playwright';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AssetWaitOptions {
  /** Max time (ms) to wait for all images to load. Default 10 000. */
  imageTimeout?: number;
  /** Max time (ms) to wait for fonts to be ready. Default 8 000. */
  fontTimeout?: number;
  /** Max time (ms) to wait for video metadata. Default 15 000. */
  videoTimeout?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_IMAGE_TIMEOUT = 10_000;
const DEFAULT_FONT_TIMEOUT = 8_000;
const DEFAULT_VIDEO_TIMEOUT = 15_000;
const PER_ASSET_TIMEOUT = 5_000;
const SETTLE_DELAY = 300;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wait for all visual assets (fonts, images, videos) to finish loading.
 *
 * Replaces fixed `page.waitForTimeout(1000)` calls with content-aware
 * waiting that adapts to the actual page payload. Each asset category
 * has its own timeout so a single slow video does not block the entire
 * pipeline indefinitely.
 */
export async function waitForAssetsToLoad(
  page: Page,
  options?: AssetWaitOptions,
): Promise<void> {
  const {
    imageTimeout = DEFAULT_IMAGE_TIMEOUT,
    fontTimeout = DEFAULT_FONT_TIMEOUT,
    videoTimeout = DEFAULT_VIDEO_TIMEOUT,
  } = options ?? {};

  // 1. Wait for web fonts
  await Promise.race([
    page.evaluate(() => document.fonts.ready),
    page.waitForTimeout(fontTimeout),
  ]).catch(() => {
    /* swallow — font timeout is non-fatal */
  });

  // 2. Wait for all <img> elements to finish loading
  await Promise.race([
    page.evaluate((perAssetMs: number) => {
      const images = Array.from(document.querySelectorAll('img'));
      return Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve());
            img.addEventListener('error', () => resolve());
            setTimeout(resolve, perAssetMs);
          });
        }),
      );
    }, PER_ASSET_TIMEOUT),
    page.waitForTimeout(imageTimeout),
  ]).catch(() => {
    /* swallow — image timeout is non-fatal */
  });

  // 3. Wait for <video> elements to have at least metadata loaded
  await Promise.race([
    page.evaluate((perAssetMs: number) => {
      const videos = Array.from(document.querySelectorAll('video'));
      return Promise.all(
        videos.map((v) => {
          if (v.readyState >= 1) return Promise.resolve();
          return new Promise<void>((resolve) => {
            v.addEventListener('loadedmetadata', () => resolve());
            v.addEventListener('error', () => resolve());
            setTimeout(resolve, perAssetMs);
          });
        }),
      );
    }, PER_ASSET_TIMEOUT),
    page.waitForTimeout(videoTimeout),
  ]).catch(() => {
    /* swallow — video timeout is non-fatal */
  });

  // 4. Small settle time for layout reflow after late-loading assets
  await page.waitForTimeout(SETTLE_DELAY);
}
