/**
 * Content-population pass for the webapp crawler.
 *
 * Many SPAs (e.g. ClickUp) lazy-load list rows, inbox items, chat history and
 * search results only on scroll or interaction. A plain base capture therefore
 * snapshots an empty shell. This module performs two read-only population
 * passes per route, AFTER the settled base capture and BEFORE the click pass:
 *
 *  - `scrollToLoad`     — finds the largest scrollable content container and
 *                         scrolls it to the bottom in steps, settling between
 *                         each step to trigger infinite/lazy rows, then scrolls
 *                         back to the top.
 *  - `populateSearch`   — opens the search toggle, types a benign generic query,
 *                         waits for the results list to gain children, then
 *                         closes the search (Escape).
 *
 * Both passes are fully defensive: a missing container / toggle / input is
 * skipped silently (no throw, no error spam). They perform only safe read-only
 * actions (scrolling, typing a benign query) and never click destructive UI.
 */

import type { Page } from 'playwright';

const SCROLL_STEP_LIMIT = 12;
const SCROLL_TOTAL_BUDGET_MS = 12_000;
const SCROLL_SETTLE_QUIET_MS = 350;
const SCROLL_SETTLE_TIMEOUT_MS = 2_000;

const SEARCH_TOGGLE_SELECTOR =
  'cu-search-modal-toggle, [data-test*="search" i], [aria-label*="search" i], [placeholder*="search" i], [class*="search" i] button, button[class*="search" i]';
const SEARCH_INPUT_SELECTOR =
  'input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i], [role="searchbox"], [contenteditable="true"][aria-label*="search" i]';
const SEARCH_RESULTS_SELECTOR =
  '[role="listbox"], [role="list"], [class*="result" i], [class*="search" i] [class*="list" i]';
const SEARCH_QUERY = 'task';

/**
 * Network-idle race plus a short DOM-mutation settle scoped to a specific
 * element (or the document body). Mirrors the settle strategy in
 * overlay-settle.ts but parameterised on an element selector so we can settle
 * just the scroll container or the search results subtree.
 */
async function settleSubtree(
  page: Page,
  rootSelector: string | null,
  quietMs: number,
  timeoutMs: number,
): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {});

  const script = `(() => new Promise((resolve) => {
    var QUIET = ${quietMs};
    var TIMEOUT = ${timeoutMs};
    var sel = ${JSON.stringify(rootSelector)};
    var target = sel ? document.querySelector(sel) : (document.body || document.documentElement);
    if (!target) { resolve(); return; }
    var lastMutation = Date.now();
    var observer = new MutationObserver(function () { lastMutation = Date.now(); });
    observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
    var started = Date.now();
    var timer = setInterval(function () {
      var now = Date.now();
      if (now - lastMutation >= QUIET || now - started >= TIMEOUT) {
        clearInterval(timer);
        observer.disconnect();
        resolve();
      }
    }, 80);
  }))()`;
  await page.evaluate(script).catch(() => {});
}

/**
 * Identifies the largest vertically-scrollable element in the content region
 * and tags it with `data-dr-scroll-root` so it can be re-resolved by selector
 * across steps. Returns the tagging selector, or null when nothing scrollable
 * beyond the window was found (caller falls back to window scrolling).
 */
async function findScrollRoot(page: Page): Promise<string | null> {
  const script = `(() => {
    var best = null;
    var bestArea = 0;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('*'));
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var style = window.getComputedStyle(el);
      var oy = style.overflowY;
      var scrollable = (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
      if (!scrollable) continue;
      if (el.scrollHeight - el.clientHeight < 200) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      var area = rect.width * rect.height;
      if (area > bestArea) { bestArea = area; best = el; }
    }
    if (!best) return null;
    best.setAttribute('data-dr-scroll-root', '1');
    return '[data-dr-scroll-root="1"]';
  })()`;
  return (await page.evaluate(script).catch(() => null)) as string | null;
}

async function clearScrollRootTag(page: Page): Promise<void> {
  await page
    .evaluate(`(() => {
      var els = document.querySelectorAll('[data-dr-scroll-root="1"]');
      for (var i = 0; i < els.length; i++) els[i].removeAttribute('data-dr-scroll-root');
    })()`)
    .catch(() => {});
}

/**
 * Scrolls one step down (container or window) and reports whether the scroll
 * position actually advanced and whether the bottom has been reached.
 */
async function scrollStep(
  page: Page,
  rootSelector: string | null,
): Promise<{ advanced: boolean; atBottom: boolean }> {
  const script = `(() => {
    var sel = ${JSON.stringify(rootSelector)};
    var el = sel ? document.querySelector(sel) : null;
    if (el) {
      var before = el.scrollTop;
      el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + el.clientHeight * 0.9);
      var after = el.scrollTop;
      var atBottom = (el.scrollHeight - after - el.clientHeight) <= 4;
      return { advanced: after > before, atBottom: atBottom };
    }
    var beforeW = window.scrollY;
    window.scrollBy(0, Math.round(window.innerHeight * 0.9));
    var afterW = window.scrollY;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var atBottomW = (maxScroll - afterW) <= 4;
    return { advanced: afterW > beforeW, atBottom: atBottomW };
  })()`;
  const result = (await page
    .evaluate(script)
    .catch(() => ({ advanced: false, atBottom: true }))) as {
    advanced: boolean;
    atBottom: boolean;
  };
  return result;
}

async function scrollToTop(page: Page, rootSelector: string | null): Promise<void> {
  await page
    .evaluate(`(() => {
      var sel = ${JSON.stringify(rootSelector)};
      var el = sel ? document.querySelector(sel) : null;
      if (el) { el.scrollTop = 0; return; }
      window.scrollTo(0, 0);
    })()`)
    .catch(() => {});
}

/**
 * Scrolls the main content container to the bottom in bounded steps, settling
 * between each step to trigger lazy/infinite rows, then scrolls back to the
 * top. Defensive: any failure is swallowed and the container tag is always
 * cleaned up so it never leaks into the captured DOM hash.
 */
export async function scrollToLoad(page: Page): Promise<void> {
  const deadline = Date.now() + SCROLL_TOTAL_BUDGET_MS;
  const rootSelector = await findScrollRoot(page);

  try {
    for (let step = 0; step < SCROLL_STEP_LIMIT; step++) {
      if (Date.now() > deadline) break;
      const { advanced, atBottom } = await scrollStep(page, rootSelector);
      await settleSubtree(page, rootSelector, SCROLL_SETTLE_QUIET_MS, SCROLL_SETTLE_TIMEOUT_MS);
      if (atBottom || !advanced) break;
    }
    await scrollToTop(page, rootSelector);
    await settleSubtree(page, rootSelector, SCROLL_SETTLE_QUIET_MS, SCROLL_SETTLE_TIMEOUT_MS);
  } finally {
    await clearScrollRootTag(page);
  }
}

/**
 * Counts descendant elements under the first matching results container. Used
 * to detect when search results have populated (gained children).
 */
async function resultsChildCount(page: Page): Promise<number> {
  const script = `(() => {
    var sel = ${JSON.stringify(SEARCH_RESULTS_SELECTOR)};
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var max = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i].querySelectorAll('*').length;
      if (n > max) max = n;
    }
    return max;
  })()`;
  return (await page.evaluate(script).catch(() => 0)) as number;
}

/**
 * Opens the search UI, types a benign generic query, waits for the results
 * list to gain children (bounded), and closes search with Escape. Returns true
 * when a populated search state was produced (so the caller can capture it).
 *
 * Fully defensive: a missing toggle or input is skipped silently and search is
 * always closed on the way out.
 */
export async function populateSearch(page: Page): Promise<boolean> {
  let opened = false;
  try {
    const toggle = page.locator(SEARCH_TOGGLE_SELECTOR).first();
    if ((await toggle.count().catch(() => 0)) === 0) return false;
    await toggle.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(250);

    const input = page.locator(SEARCH_INPUT_SELECTOR).first();
    if ((await input.count().catch(() => 0)) === 0) return false;
    opened = true;

    await input.click({ timeout: 1_500 }).catch(() => {});
    await input.fill('').catch(() => {});
    await input.type(SEARCH_QUERY, { delay: 40 }).catch(async () => {
      await page.keyboard.type(SEARCH_QUERY, { delay: 40 }).catch(() => {});
    });

    const baseline = await resultsChildCount(page);
    const populateDeadline = Date.now() + 5_000;
    let populated = false;
    while (Date.now() < populateDeadline) {
      await settleSubtree(page, SEARCH_RESULTS_SELECTOR, 300, 1_500);
      if ((await resultsChildCount(page)) > baseline) {
        populated = true;
        break;
      }
    }
    return populated;
  } catch {
    return false;
  } finally {
    if (opened) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(150);
    }
  }
}
