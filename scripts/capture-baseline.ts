#!/usr/bin/env tsx
/**
 * Capture a PRISTINE clean baseline of ClickUp's List view + shell for an
 * exact-structure React rebuild.
 *
 * Launches the persistent profile (already authenticated), navigates to the
 * seed List URL, discovers the runtime stores, runs `sanityReset(page)` to
 * close every transient panel and return the icon rail to the default Spaces
 * sidebar, settles, then captures ONE pristine state into
 * `docs/research/clickup-parity/baseline/`:
 *
 *   dom-styled.html  real CSS inlined via css-collect + css-inject
 *   dom-raw.html     verbatim outerHTML of the live document
 *   screenshot.png   1440x900 viewport screenshot
 *   state.json       NGXS + React island store dump
 *   meta.json        capture metadata + leak-verification result
 *
 * Reuses the existing crawler capture modules so the output matches the
 * pipeline. Does NOT run a full crawl.
 *
 * Usage:
 *   npm run capture:baseline
 *   npm run capture:baseline -- --url=<listUrl> --out=<dir>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { collectStylesheets } from '../engine/targets/webapp/crawler/css-collect';
import { injectStyles } from '../engine/targets/webapp/crawler/css-inject';
import { computeDomHash } from '../engine/targets/webapp/crawler/dom-hash';
import { waitForSteadyState } from '../engine/targets/webapp/crawler/overlay-settle';
import { sanityReset } from '../engine/targets/webapp/crawler/sanity-reset';
import { discoverStores, dumpState } from '../engine/targets/webapp/crawler/state-dump';

const DEFAULT_URL = 'https://app.clickup.com/90152566819/v/l/li/901523751540';
const DEFAULT_OUT = join('docs', 'research', 'clickup-parity', 'baseline');
const VIEWPORT = { width: 1440, height: 900 };

/**
 * Chat/Home-panel leak markers that MUST be absent from a clean baseline.
 *
 * NOTE: "Add Channel" is intentionally NOT a text marker here. It appears in
 * ClickUp's DEFAULT List view chrome (the SyncUp button + the
 * `location-header__add-channel-button`), so its presence does NOT indicate the
 * polluting Chat sidebar. The Chat-sidebar leak is detected structurally below
 * via the chat-room / chat-sidebar / home-sidebar DOM markers, which are absent
 * in the default Spaces sidebar.
 */
const LEAK_MARKERS = [
  'Direct Messages',
  'New message',
] as const;

/**
 * Space-Overview dashboard markers. The List URL can resolve to the space's
 * default Overview tab (Recent / Docs / Bookmarks / Folders / Lists dashboard)
 * instead of the List view task grid. These DOM markers prove the Overview
 * dashboard is mounted and MUST be absent from a List-view baseline.
 */
const OVERVIEW_MARKERS: Array<{ name: string; needle: string }> = [
  { name: 'overview add-doc button', needle: 'add-doc-button' },
  { name: 'overview bookmarks widget', needle: 'grid-layout-item-breadcrumbs__Bookmarks' },
];

/**
 * Structural markers proving a leaking secondary panel (chat/home) OR an open
 * task-detail panel / command palette. Each needle targets a CONTAINER that
 * only exists when the unwanted UI is actually mounted — not an always-present
 * toolbar button.
 */
const STRUCTURAL_LEAKS: Array<{ name: string; needle: string }> = [
  { name: 'chat sidebar panel', needle: 'data-chmln="chat-sidebar' },
  { name: 'home sidebar panel', needle: 'data-chmln="home-sidebar' },
  { name: 'chat room list', needle: 'data-test="chat-room' },
  { name: 'chat sidebar item', needle: 'data-test="chat-sidebar' },
  { name: 'open task-detail panel', needle: 'task-view__container' },
  { name: 'command palette', needle: 'data-test="command-palette' },
];

type CliArgs = { url: string; out: string; userDataDir: string };

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    url: DEFAULT_URL,
    out: DEFAULT_OUT,
    userDataDir: join(homedir(), '.config', 'playwright-pinterest'),
  };
  for (const raw of argv) {
    if (raw.startsWith('--url=')) args.url = raw.slice('--url='.length);
    else if (raw.startsWith('--out=')) args.out = raw.slice('--out='.length);
    else if (raw.startsWith('--user-data-dir=')) args.userDataDir = raw.slice('--user-data-dir='.length);
    else throw new Error(`Unknown flag: ${raw}`);
  }
  return args;
}

type LeakReport = {
  clean: boolean;
  textMarkers: Array<{ marker: string; present: boolean }>;
  structuralMarkers: Array<{ marker: string; present: boolean }>;
  overviewMarkers: Array<{ marker: string; present: boolean }>;
  activeViewIsList: boolean;
  taskRowCount: number;
};

function verifyClean(html: string, activeViewIsList: boolean, taskRowCount: number): LeakReport {
  const textMarkers = LEAK_MARKERS.map((marker) => ({
    marker,
    present: html.includes(marker),
  }));
  const structuralMarkers = STRUCTURAL_LEAKS.map(({ name, needle }) => ({
    marker: name,
    present: html.includes(needle),
  }));
  const overviewMarkers = OVERVIEW_MARKERS.map(({ name, needle }) => ({
    marker: name,
    present: html.includes(needle),
  }));
  const clean =
    textMarkers.every((m) => !m.present) &&
    structuralMarkers.every((m) => !m.present) &&
    overviewMarkers.every((m) => !m.present) &&
    activeViewIsList &&
    taskRowCount > 1;
  return { clean, textMarkers, structuralMarkers, overviewMarkers, activeViewIsList, taskRowCount };
}

/**
 * Reads, from the LIVE page, whether the active view tab is "List" and how many
 * task rows are currently rendered. The active tab carries the
 * `cu-data-view-item_selected` class; its label lives in
 * `.cu-data-view-item__name-text`. Task rows are `cu-task-row` elements.
 */
async function readViewState(page: Page): Promise<{ activeView: string; taskRowCount: number }> {
  const script = `(() => {
    var active = '';
    var tabs = document.querySelectorAll('.cu-data-view-item');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].className.indexOf('cu-data-view-item_selected') !== -1) {
        var name = tabs[i].querySelector('.cu-data-view-item__name-text');
        active = name ? (name.textContent || '').trim() : '';
        break;
      }
    }
    var rows = document.querySelectorAll('cu-task-row, .cu-task-row').length;
    return { activeView: active, taskRowCount: rows };
  })()`;
  const result = (await page
    .evaluate(script)
    .catch(() => ({ activeView: '', taskRowCount: 0 }))) as {
    activeView: string;
    taskRowCount: number;
  };
  return { activeView: result.activeView ?? '', taskRowCount: result.taskRowCount ?? 0 };
}

/**
 * Clicks the "List" view tab and waits for the task grid to render. The List URL
 * can resolve to the space's default Overview tab, so an explicit click is
 * required to land on the List view. Verifies by polling the live active-view
 * label until it reads "List" (bounded). Returns the final view state.
 */
async function selectListView(page: Page): Promise<{ activeView: string; taskRowCount: number }> {
  const listTab = page.locator('[data-test="data-view-item__List"]').first();
  if (await listTab.count().catch(() => 0)) {
    await listTab.click({ timeout: 5_000 }).catch(() => {});
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(400);
    const state = await readViewState(page);
    if (state.activeView === 'List' && state.taskRowCount > 1) return state;
  }
  return readViewState(page);
}

async function captureBaseline(page: Page, outDir: string, url: string): Promise<LeakReport> {
  mkdirSync(outDir, { recursive: true });

  const view = await readViewState(page);
  const { hash, rawHtml } = await computeDomHash(page);

  await page
    .screenshot({ path: join(outDir, 'screenshot.png'), fullPage: false, timeout: 8_000 })
    .catch(() => {});

  writeFileSync(join(outDir, 'dom-raw.html'), rawHtml, 'utf8');

  let styledHtml = rawHtml;
  try {
    const sheets = await collectStylesheets(page);
    if (sheets.length > 0) {
      const { html } = injectStyles(rawHtml, sheets);
      styledHtml = html;
    }
  } catch (err) {
    console.warn(`[baseline] css-preserve skipped: ${msg(err)}`);
  }
  writeFileSync(join(outDir, 'dom-styled.html'), styledHtml, 'utf8');

  try {
    const dump = await dumpState(page);
    writeFileSync(join(outDir, 'state.json'), JSON.stringify(dump, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[baseline] state-dump failed: ${msg(err)}`);
  }

  const report = verifyClean(styledHtml, view.activeView === 'List', view.taskRowCount);

  const meta = {
    url,
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    domHash: hash,
    activeView: view.activeView,
    taskRowCount: view.taskRowCount,
    leakVerification: report,
  };
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  return report;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[baseline] url         : ${args.url}`);
  console.log(`[baseline] out         : ${args.out}`);
  console.log(`[baseline] profile     : ${args.userDataDir}`);

  const context = await chromium.launchPersistentContext(args.userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: VIEWPORT,
    serviceWorkers: 'block',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForSteadyState(page, { timeoutMs: 15_000 });

    console.log('[baseline] discovering stores…');
    const stores = await discoverStores(page);
    console.log(`[baseline] stores      : ngxs=${stores.ngxs} react=${stores.react}`);

    console.log('[baseline] sanity reset…');
    await sanityReset(page);
    await waitForSteadyState(page, { timeoutMs: 8_000 });

    console.log('[baseline] selecting List view tab…');
    const view = await selectListView(page);
    console.log(`[baseline] activeView  : ${view.activeView || '(none)'} | taskRows=${view.taskRowCount}`);
    await waitForSteadyState(page, { timeoutMs: 8_000 });

    console.log('[baseline] capturing…');
    let report = await captureBaseline(page, args.out, args.url);

    // Re-capture once if a leak or wrong view survived the first attempt.
    if (!report.clean) {
      console.warn('[baseline] not clean after first attempt — re-running reset + List select');
      await sanityReset(page);
      await selectListView(page);
      await waitForSteadyState(page, { timeoutMs: 8_000 });
      report = await captureBaseline(page, args.out, args.url);
    }

    console.log('\n[baseline] leak verification:');
    for (const m of report.textMarkers) {
      console.log(`  ${m.present ? 'FOUND ✗' : 'absent ✓'}  "${m.marker}"`);
    }
    for (const m of report.structuralMarkers) {
      console.log(`  ${m.present ? 'FOUND ✗' : 'absent ✓'}  ${m.marker}`);
    }
    for (const m of report.overviewMarkers) {
      console.log(`  ${m.present ? 'FOUND ✗' : 'absent ✓'}  overview: ${m.marker}`);
    }
    console.log('\n[baseline] view verification:');
    console.log(`  active view = List : ${report.activeViewIsList ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  cu-task-row count  : ${report.taskRowCount} ${report.taskRowCount > 1 ? '✓' : '✗'}`);
    console.log(`\n[baseline] CLEAN: ${report.clean ? 'YES ✓' : 'NO ✗'}`);
    console.log(`[baseline] files in: ${args.out}`);

    if (!report.clean) process.exitCode = 1;
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[baseline] fatal:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
