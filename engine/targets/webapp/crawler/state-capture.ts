import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { computeDomHash } from './dom-hash';
import type { StateNode } from './types';

export type CapturedState = {
  node: StateNode;
  rawHtml: string;
  normalisedHtml: string;
};

export async function captureState(
  page: Page,
  outDir: string,
  stateIndex: number,
  depth: number,
): Promise<CapturedState> {
  const id = `state-${String(stateIndex).padStart(4, '0')}`;
  const dir = join(outDir, 'states', id);
  mkdirSync(dir, { recursive: true });

  const { hash, rawHtml, normalisedHtml } = await computeDomHash(page);

  const screenshotPath = join(dir, 'screenshot.png');
  await page
    .screenshot({ path: screenshotPath, fullPage: true, timeout: 5_000 })
    .catch(() => {
      // Some pages refuse full-page; fall back to viewport-only.
      return page.screenshot({ path: screenshotPath, fullPage: false, timeout: 5_000 });
    });

  const domPath = join(dir, 'dom.html');
  writeFileSync(domPath, normalisedHtml, 'utf8');
  writeFileSync(join(dir, 'dom-raw.html'), rawHtml, 'utf8');

  const url = page.url();
  const title = await page.title().catch(() => '');
  const capturedAt = new Date().toISOString();

  const meta = {
    id,
    url,
    title,
    depth,
    domHash: hash,
    capturedAt,
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  const node: StateNode = {
    id,
    url,
    domHash: hash,
    title,
    screenshotPath,
    domPath,
    capturedAt,
    depth,
  };

  return { node, rawHtml, normalisedHtml };
}
