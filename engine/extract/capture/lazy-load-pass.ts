/**
 * Lazy-load asset re-capture pass.
 *
 * The original capture window relies on initial network idle, which fires
 * before any IntersectionObserver / scroll-triggered resources kick in
 * (lazy <img loading="lazy">, react-intersection-observer hooks, videos
 * deferred until in-view, etc.). Without this pass, the asset manifest
 * misses every below-the-fold resource and the clone has broken media.
 *
 * Strategy:
 *   1. Wait for the page to actually be settled (caller's responsibility —
 *      we assume DOM is loaded and the initial networkidle already fired).
 *   2. Scroll in 200px increments to the bottom, pausing 500ms between
 *      steps so lazy-loaders have time to fire requests.
 *   3. After hitting the bottom, wait for networkidle once more to drain
 *      any in-flight tail requests.
 *   4. Scroll back to the top so a subsequent screenshot starts at 0.
 *
 * Network capture itself happens via Playwright's HAR recorder (and the
 * shared-context network-recorder in cdp/persistent modes), so the
 * additional requests are picked up automatically. This pass only needs to
 * trigger them.
 */

import type { Page } from 'playwright';

const DEFAULT_STEP_PX = 200;
const DEFAULT_STEP_WAIT_MS = 500;
const DEFAULT_NETWORK_IDLE_TIMEOUT_MS = 10_000;
const MAX_SCROLL_ITERATIONS = 500; // hard safety cap on runaway loops

export interface LazyLoadPassOptions {
  /** Pixels per scroll step. Default 200. */
  stepPx?: number;
  /** Wait between scroll steps (ms). Default 500. */
  stepWaitMs?: number;
  /** Final networkidle timeout (ms). Default 10000. */
  networkIdleTimeoutMs?: number;
}

export interface LazyLoadPassResult {
  scrollSteps: number;
  finalHeightPx: number;
  durationMs: number;
}

/**
 * Run the scroll-to-bottom lazy-load pass. Safe to call after initial load
 * completes — caller is responsible for sequencing it after page.goto and
 * the first waitForLoadState('networkidle').
 */
export async function runLazyLoadPass(
  page: Page,
  options: LazyLoadPassOptions = {},
): Promise<LazyLoadPassResult> {
  const stepPx = options.stepPx ?? DEFAULT_STEP_PX;
  const stepWaitMs = options.stepWaitMs ?? DEFAULT_STEP_WAIT_MS;
  const networkIdleTimeoutMs =
    options.networkIdleTimeoutMs ?? DEFAULT_NETWORK_IDLE_TIMEOUT_MS;

  const start = Date.now();

  let scrollSteps = 0;
  let lastTotalHeight = 0;

  // Loop: the document height can GROW during the scroll (lazy mounts add
  // more content), so re-read scrollHeight every iteration and stop only
  // when we have actually reached the current bottom AND the height has
  // stopped growing.
  for (let iteration = 0; iteration < MAX_SCROLL_ITERATIONS; iteration += 1) {
    const measurement = await page
      .evaluate(() => ({
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      }))
      .catch(() => null);

    if (!measurement) break;

    const { scrollY, innerHeight, scrollHeight } = measurement;
    const bottom = scrollY + innerHeight;
    const atBottom = bottom >= scrollHeight - 1;
    const heightStable = scrollHeight === lastTotalHeight;

    if (atBottom && heightStable) {
      lastTotalHeight = scrollHeight;
      break;
    }
    lastTotalHeight = scrollHeight;

    const nextY = Math.min(scrollY + stepPx, scrollHeight);
    await page.evaluate((y) => window.scrollTo(0, y), nextY).catch(() => {});
    await page.waitForTimeout(stepWaitMs);
    scrollSteps += 1;
  }

  // Final networkidle drain — gives lazy XHR/fetch + media requests time to
  // settle. Swallow the timeout: many sites keep a long-poll open and never
  // hit true idle, but the lazy resources we care about will already be in.
  await page
    .waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs })
    .catch(() => {});

  // Reset scroll so the subsequent full-page screenshot starts from origin.
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  return {
    scrollSteps,
    finalHeightPx: lastTotalHeight,
    durationMs: Date.now() - start,
  };
}
