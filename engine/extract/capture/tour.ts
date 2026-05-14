import type { Page } from 'playwright';

const SCROLL_STEP_PX = 200;
const SCROLL_WAIT_MS = 200;
const HOVER_WAIT_MS = 100;
const HOVER_LIMIT = 30;
const NETWORK_IDLE_TIMEOUT_MS = 5000;

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {});
}

async function scrollTopToBottom(page: Page): Promise<void> {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
  if (!totalHeight) return;

  let y = 0;
  while (y < totalHeight) {
    await page.evaluate((pos) => window.scrollTo(0, pos), y).catch(() => {});
    await page.waitForTimeout(SCROLL_WAIT_MS);
    y += SCROLL_STEP_PX;
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(SCROLL_WAIT_MS);
}

async function hoverInteractive(page: Page): Promise<void> {
  const handles = await page
    .locator('a, button, [role="button"], nav *')
    .elementHandles()
    .catch(() => []);

  const limited = handles.slice(0, HOVER_LIMIT);
  for (const handle of limited) {
    try {
      await handle.hover({ timeout: 1000 });
      await page.waitForTimeout(HOVER_WAIT_MS);
    } catch {
      /* swallow per-element errors */
    }
  }
  for (const handle of handles) {
    try {
      await handle.dispose();
    } catch {
      /* noop */
    }
  }
}

export async function runTour(page: Page): Promise<void> {
  try {
    await scrollTopToBottom(page);
  } catch (err) {
    console.error('[tour] scroll failed:', err);
  }

  await waitForIdle(page);

  try {
    await hoverInteractive(page);
  } catch (err) {
    console.error('[tour] hover failed:', err);
  }

  await waitForIdle(page);
}
