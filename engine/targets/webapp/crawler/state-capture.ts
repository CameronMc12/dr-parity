import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { captureAriaSnapshot } from './aria-snapshot';
import { computeCanonicalKey } from './canonical-key';
import { collectStylesheets } from './css-collect';
import { injectStyles } from './css-inject';
import { computeDomHash } from './dom-hash';
import { dumpState } from './state-dump';
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

  // L1 style preservation — inject the page's REAL stylesheets (with @media,
  // @keyframes, :hover/:focus, :root custom props intact) into a self-contained
  // dom-styled.html. Fully guarded: a CSS-collection failure must NEVER break a
  // capture. dom.html and dom-raw.html stay untouched as the pristine captures.
  try {
    const sheets = await collectStylesheets(page);
    if (sheets.length > 0) {
      const { html, injectedCount, skippedDuplicates, truncated, totalBytes } = injectStyles(
        rawHtml,
        sheets,
      );
      writeFileSync(join(dir, 'dom-styled.html'), html, 'utf8');
      if (truncated) {
        console.warn(
          `[crawl] css truncated for ${id}: ${injectedCount} sheets, ${totalBytes} bytes (cap hit), ${skippedDuplicates} dupes`,
        );
      }
    }
  } catch (err) {
    console.warn(
      `[crawl] css-preserve skipped for ${id}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ARIA snapshot — low-noise semantic signal. Defensive; may be null.
  const { ariaPath } = await captureAriaSnapshot(page, dir);

  // L2 runtime state dump — NGXS + React island snapshots. Fully guarded: a
  // dump failure must NEVER break a state capture, so it is logged LOUDLY and
  // skipped. dumpState self-heals (re-discovers stores when the SPA wiped the
  // window.__PARITY__ stash), so a snapshot should land on every state. We
  // always write state.json when ANY data came back and log the source so a
  // silent empty-dump regression is visible in the run log.
  try {
    const dump = await dumpState(page);
    const hasData = dump.source.length > 0 || dump.ngxs !== undefined || dump.react !== undefined;
    if (hasData) {
      writeFileSync(join(dir, 'state.json'), JSON.stringify(dump, null, 2), 'utf8');
    } else {
      console.warn(`[crawl] state-dump EMPTY for ${id} (no stores re-discovered) — no state.json`);
    }
  } catch (err) {
    console.error(
      `[crawl] state-dump FAILED for ${id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
    );
  }

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
