import type { BrowserContext } from 'playwright';
import { VIEWPORT } from '../config.js';

/**
 * Navigates to url in a new page in the given context, waits settleMs,
 * then takes a full-page screenshot. Returns the raw PNG buffer.
 */
export async function captureScreenshot(
  context: BrowserContext,
  url: string,
  settleMs: number,
): Promise<Buffer> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(settleMs);
    const buf = await page.screenshot({ fullPage: true });
    return buf;
  } finally {
    await page.close();
  }
}
