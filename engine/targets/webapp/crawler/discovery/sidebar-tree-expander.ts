/**
 * Sidebar tree-expander.
 *
 * Phase-2 page-time discovery pass. After the crawler has navigated to the
 * start URL and the sidebar DOM is present, this routine force-expands every
 * collapsed `cdk-tree-node[aria-expanded="false"]` inside the ClickUp sidebar
 * so the workspace's view links (Spaces → Folders → Lists → Views) become
 * concrete `<a href="/<workspace>/v/<type>/<viewId>">` anchors in the DOM.
 *
 * Why this exists: the diagnostic `docs/V2.0/08-clickup-failure-attribution.md`
 * attributes ~40% of the original crawl failure to the collapsed sidebar.
 * The api-hierarchy traverser (Phase 1) closed the other ~60% by mining
 * captured network bodies; this pass closes the remaining ~40% by reading
 * real DOM links the user would otherwise have to click open manually.
 *
 * Algorithm:
 *   1. Open the sidebar if it is in collapsed-shell mode
 *      (`.cu-simple-bar__container_collapsed`).
 *   2. Loop:
 *      a. Query every `cdk-tree-node[role="treeitem"][aria-expanded="false"]`
 *         inside `[data-test="simple-sidebar"]`.
 *      b. For each: scroll into view, click. If click fails or the element
 *         is detached, fall back to focus + Enter.
 *      c. Wait a brief settle for lazy children to render.
 *      d. Stop when no new collapsed nodes appeared for an iteration OR the
 *         iteration cap is reached.
 *   3. Extract every `<a href="/<workspace>/v/<type>/<viewId>">` inside the
 *      sidebar and return a deduped `RouteSeed[]` at `confidence: 'strict'`
 *      (the URL was assembled by ClickUp itself — no inference).
 *
 * Safety:
 *   - All Playwright calls are wrapped + swallowed; a faulty expand never
 *     bubbles into the crawler.
 *   - The expander operates with bounded iterations and a per-iteration
 *     no-progress guard, so it cannot loop indefinitely.
 *   - The expander does NOT navigate. It only mutates sidebar disclosure
 *     state. The crawler's frontier handles every visit after this returns.
 */

import type { Page } from 'playwright';

import {
  CONFIDENCE_RANK,
  PRIORITY_NEW_ROUTE,
  type RouteSeed,
} from './types';

const LOG_PREFIX = '[sidebar-tree-expander]';

/** Sidebar root + tree-row selectors. Verified against captured ClickUp DOM. */
const SIDEBAR_HOST_SELECTOR = '[data-test="simple-sidebar"]';
const COLLAPSED_SHELL_SELECTOR = '.cu-simple-bar__container_collapsed';
const EXPAND_SHELL_BUTTON_SELECTOR = '[data-test="simple-bar__expand-sidebar-button"]';
const COLLAPSED_TREE_ROW_SELECTOR = 'cdk-tree-node[role="treeitem"][aria-expanded="false"]';
const VIEW_ANCHOR_SELECTOR = 'a[href*="/v/"]';

/** Bound the expansion loop. The diagnostic sidebar has ~3 levels x ~14 sibling lists. */
const MAX_ITERATIONS = 20;
const PER_ITERATION_SETTLE_MS = 200;
const SIDEBAR_PRESENCE_TIMEOUT_MS = 5_000;
const PER_CLICK_TIMEOUT_MS = 1_500;

/** Type-segment-aware URL parser; mirrors the api-hierarchy-traverser map. */
function bucketForSegment(segment: string): string {
  switch (segment) {
    case 'l':
      return 'list';
    case 'b':
      return 'board';
    case 't':
      return 'table';
    case 'c':
      return 'calendar';
    case 'g':
      return 'gantt';
    case 'tl':
    case 'li':
      return 'timeline';
    case 'dc':
      return 'doc';
    default:
      return segment;
  }
}

export type ExpandStats = {
  iterations: number;
  totalCollapsedClicked: number;
  finalCollapsedRemaining: number;
  anchorsExtracted: number;
  uniqueSeeds: number;
};

/**
 * Open the sidebar shell if it is in collapsed mode. No-op when already open.
 * Errors are swallowed so a missing button never blocks the pass.
 */
async function openSidebarShell(page: Page): Promise<void> {
  try {
    const collapsedShellCount = await page.locator(COLLAPSED_SHELL_SELECTOR).count();
    if (collapsedShellCount === 0) return;
    const expandButton = page.locator(EXPAND_SHELL_BUTTON_SELECTOR).first();
    if ((await expandButton.count()) === 0) return;
    await expandButton.click({ timeout: PER_CLICK_TIMEOUT_MS });
    await page.waitForTimeout(PER_ITERATION_SETTLE_MS);
  } catch (err) {
    console.log(
      `${LOG_PREFIX} openSidebarShell skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Click every collapsed tree row currently visible inside the sidebar. Returns
 * the number of nodes successfully flipped from `aria-expanded="false"` to
 * `"true"` in this single pass. The caller loops until no further progress.
 */
async function clickAllCollapsedRows(page: Page): Promise<{
  clicked: number;
  remaining: number;
}> {
  const rows = page.locator(`${SIDEBAR_HOST_SELECTOR} ${COLLAPSED_TREE_ROW_SELECTOR}`);
  const initialCount = await rows.count().catch(() => 0);
  if (initialCount === 0) return { clicked: 0, remaining: 0 };

  let clicked = 0;
  // Iterate by index but re-resolve each time: clicking a row mutates the DOM
  // and may detach later indices. We tolerate that by catching per-row errors.
  for (let i = 0; i < initialCount; i++) {
    const row = page.locator(`${SIDEBAR_HOST_SELECTOR} ${COLLAPSED_TREE_ROW_SELECTOR}`).nth(i);
    try {
      if ((await row.count()) === 0) continue;
      await row.scrollIntoViewIfNeeded({ timeout: PER_CLICK_TIMEOUT_MS });
      await row.click({ timeout: PER_CLICK_TIMEOUT_MS, force: false });
      clicked++;
    } catch {
      // Fall back to focus + Enter (some CDK tree rows ignore plain clicks).
      try {
        await row.focus({ timeout: PER_CLICK_TIMEOUT_MS });
        await page.keyboard.press('Enter');
        clicked++;
      } catch {
        /* swallow — the next iteration will try fresh-resolved rows */
      }
    }
  }
  const remaining = await page
    .locator(`${SIDEBAR_HOST_SELECTOR} ${COLLAPSED_TREE_ROW_SELECTOR}`)
    .count()
    .catch(() => 0);
  return { clicked, remaining };
}

/**
 * Extract every `<a href="/{workspace}/v/{type}/{viewId}">` anchor inside the
 * sidebar and return a deduped `RouteSeed[]`. Dedup key is the absolute URL.
 */
async function collectSidebarAnchors(page: Page, origin: string): Promise<RouteSeed[]> {
  const hrefs = await page
    .locator(`${SIDEBAR_HOST_SELECTOR} ${VIEW_ANCHOR_SELECTOR}`)
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? '')
        .filter((href) => href.length > 0),
    )
    .catch(() => [] as string[]);

  const out = new Map<string, RouteSeed>();
  const VIEW_URL_PATTERN = /^\/[0-9]+\/v\/([a-z]+)\/([a-zA-Z0-9-]+)/;
  for (const href of hrefs) {
    const m = VIEW_URL_PATTERN.exec(href);
    if (!m) continue;
    const segment = m[1];
    const viewId = m[2];
    let absolute: string;
    try {
      absolute = new URL(href, origin).toString();
    } catch {
      continue;
    }
    if (out.has(absolute)) continue;
    const seed: RouteSeed = {
      url: absolute,
      priority: PRIORITY_NEW_ROUTE + CONFIDENCE_RANK.strict,
      sourceTag: 'sidebar-tree-expander',
      viewId,
      viewType: bucketForSegment(segment),
      confidence: 'strict',
    };
    out.set(absolute, seed);
  }
  return Array.from(out.values());
}

/**
 * Force-expand the ClickUp sidebar tree and collect every view-link anchor.
 *
 * Returns `RouteSeed[]` ready to merge into the crawler frontier, plus stats
 * for the log line. Never throws — errors are logged and swallowed.
 *
 * @param page    Playwright page handle. Must be on an authenticated ClickUp
 *                workspace route (e.g. `/<wsId>/home` or `/<wsId>/inbox`).
 * @param origin  Origin used to absolutise any relative `<a href>` (e.g.
 *                `https://app.clickup.com`).
 */
export async function expandSidebarTree(
  page: Page,
  origin: string,
): Promise<{ seeds: RouteSeed[]; stats: ExpandStats }> {
  const stats: ExpandStats = {
    iterations: 0,
    totalCollapsedClicked: 0,
    finalCollapsedRemaining: 0,
    anchorsExtracted: 0,
    uniqueSeeds: 0,
  };

  // Wait for the sidebar host. Bail (with empty seeds) if it never appears —
  // the crawler will continue via its DOM-only frontier.
  try {
    await page.waitForSelector(SIDEBAR_HOST_SELECTOR, {
      timeout: SIDEBAR_PRESENCE_TIMEOUT_MS,
      state: 'attached',
    });
  } catch (err) {
    console.log(
      `${LOG_PREFIX} sidebar host not found within ${SIDEBAR_PRESENCE_TIMEOUT_MS}ms: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { seeds: [], stats };
  }

  await openSidebarShell(page);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    stats.iterations = iter + 1;
    const { clicked, remaining } = await clickAllCollapsedRows(page);
    stats.totalCollapsedClicked += clicked;
    stats.finalCollapsedRemaining = remaining;
    if (clicked === 0) break; // no progress this pass — stop
    await page.waitForTimeout(PER_ITERATION_SETTLE_MS);
  }

  const seeds = await collectSidebarAnchors(page, origin);
  stats.anchorsExtracted = seeds.length;
  stats.uniqueSeeds = seeds.length;

  console.log(
    `${LOG_PREFIX} expanded sidebar: iterations=${stats.iterations} ` +
      `clicked=${stats.totalCollapsedClicked} ` +
      `collapsed_remaining=${stats.finalCollapsedRemaining} ` +
      `anchors=${stats.anchorsExtracted} ` +
      `seeds=${stats.uniqueSeeds}`,
  );

  return { seeds, stats };
}
