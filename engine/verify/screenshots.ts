import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { Viewport } from './types';

const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const SETTLE_DELAY_MS = 2_000;

export interface CapturedShot {
  viewport: Viewport;
  clonePath: string;
  rebuiltPath: string;
}

async function captureOne(
  context: BrowserContext,
  url: string,
  outPath: string,
  label: string,
  viewportName: string,
): Promise<void> {
  let page: Page | null = null;
  try {
    page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Timeout/i.test(msg)) {
        throw new Error(`Navigation failed (${label} ${viewportName} url=${url}): ${msg}`);
      }
    }
    await page.waitForTimeout(SETTLE_DELAY_MS);
    await page.screenshot({ path: outPath, fullPage: true });
  } catch (err) {
    throw new Error(
      `Screenshot failed (${label} viewport=${viewportName} url=${url} file=${outPath}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

export async function captureAll(
  browser: Browser,
  cloneUrl: string,
  rebuiltUrl: string,
  viewports: Viewport[],
  outDir: string,
): Promise<CapturedShot[]> {
  const shots: CapturedShot[] = [];
  for (const viewport of viewports) {
    const viewportDir = join(outDir, viewport.name);
    await mkdir(viewportDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dsf,
    });

    try {
      const clonePath = join(viewportDir, 'clone.png');
      const rebuiltPath = join(viewportDir, 'rebuilt.png');
      await captureOne(context, cloneUrl, clonePath, 'clone', viewport.name);
      await captureOne(context, rebuiltUrl, rebuiltPath, 'rebuilt', viewport.name);
      shots.push({ viewport, clonePath, rebuiltPath });
    } finally {
      try {
        await context.close();
      } catch {}
    }
  }
  return shots;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}
