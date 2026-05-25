import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { captureAriaSnapshot } from './aria-snapshot';
import { computeCanonicalKey } from './canonical-key';
import { computeDomHash } from './dom-hash';
import type { StateNode, StateSourceKind } from './types';

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
  sourceKind: StateSourceKind = 'route',
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

  // ARIA snapshot — low-noise semantic signal. Defensive; may be null.
  const { ariaPath } = await captureAriaSnapshot(page, dir);

  // Composite canonical key — route + structural signature + dom hash.
  const canonicalKey = await computeCanonicalKey(page, hash);

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
    ariaPath: ariaPath ?? undefined,
    canonicalKey,
    sourceKind,
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
    ariaPath: ariaPath ?? undefined,
    canonicalKey,
    sourceKind,
  };

  return { node, rawHtml, normalisedHtml };
}
