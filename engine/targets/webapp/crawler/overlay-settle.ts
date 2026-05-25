/**
 * Overlay lifecycle helpers for the crawler.
 *
 *  - `dismissStrayOverlays` closes any modal/dialog/popover left open before a
 *    BASE route capture, so the base snapshot is the real underlying view.
 *  - `waitForPopulatedOverlay` waits for a freshly-opened overlay to finish
 *    lazy-loading its content (network idle + DOM-mutation settle) before the
 *    crawler snapshots it, so modals/menus capture real UI rather than an
 *    empty shell.
 */

import type { Page } from 'playwright';

const OVERLAY_SELECTOR =
  '[role="dialog"], [role="menu"], [role="listbox"], [aria-modal="true"], .modal, [class*="modal" i], [class*="overlay" i], [class*="popover" i], [class*="dropdown" i]';

/**
 * Counts the visible overlay roots currently in the DOM. Used to detect
 * whether dismissal succeeded.
 */
async function visibleOverlayCount(page: Page): Promise<number> {
  const script = `(() => {
    var sel = ${JSON.stringify(OVERLAY_SELECTOR)};
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var count = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      var style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      count++;
    }
    return count;
  })()`;
  return (await page.evaluate(script).catch(() => 0)) as number;
}

/**
 * Best-effort dismissal of any open overlay. Presses Escape and clicks the
 * top-left corner (common backdrop) up to a few times, checking after each
 * pass whether the overlay actually closed. Returns once no visible overlay
 * remains or the attempt budget is exhausted.
 */
export async function dismissStrayOverlays(page: Page, maxAttempts = 3): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const before = await visibleOverlayCount(page);
    if (before === 0) return;

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);

    if ((await visibleOverlayCount(page)) === 0) return;

    // Click a backdrop region away from likely content.
    await page.mouse.click(5, 5).catch(() => {});
    await page.waitForTimeout(150);

    if ((await visibleOverlayCount(page)) === 0) return;
  }
}

/**
 * Waits for the WHOLE document to reach steady state before a base capture:
 * network idle, then a DOM-mutation settle (no document-wide mutations for
 * `quietMs`), bounded by a generous `timeoutMs` for heavy SPAs. This stops the
 * "growing dom" problem where the same view is captured at different
 * load-completion points and produces fake-distinct hashes.
 */
export async function waitForSteadyState(
  page: Page,
  opts: { quietMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const quietMs = opts.quietMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {});

  const script = `(() => new Promise((resolve) => {
    var QUIET = ${quietMs};
    var TIMEOUT = ${timeoutMs};
    var target = document.body || document.documentElement;
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
    }, 100);
  }))()`;
  await page.evaluate(script).catch(() => {});
}

/**
 * After triggering an element that opens an overlay, waits for the overlay's
 * subtree to finish populating: first a network-idle window, then a
 * DOM-mutation settle that resolves only once the overlay has STOPPED mutating
 * AND holds meaningful child content (at least `minChildren` descendants), so
 * a lazy-loading menu/modal is not snapshotted as an empty shell. The whole
 * wait is bounded by `timeoutMs`; on timeout it resolves regardless so the
 * crawler never stalls.
 */
export async function waitForPopulatedOverlay(
  page: Page,
  opts: { quietMs?: number; timeoutMs?: number; minChildren?: number } = {},
): Promise<void> {
  const quietMs = opts.quietMs ?? 450;
  const timeoutMs = opts.timeoutMs ?? 6_000;
  const minChildren = opts.minChildren ?? 2;

  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {});

  const script = `(() => new Promise((resolve) => {
    var QUIET = ${quietMs};
    var TIMEOUT = ${timeoutMs};
    var MIN_CHILDREN = ${minChildren};
    var sel = ${JSON.stringify(OVERLAY_SELECTOR)};
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var target = nodes.length > 0 ? nodes[nodes.length - 1] : document.body;
    if (!target) { resolve(); return; }
    var lastMutation = Date.now();
    var observer = new MutationObserver(function () { lastMutation = Date.now(); });
    observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
    var started = Date.now();
    var timer = setInterval(function () {
      var now = Date.now();
      var quiet = (now - lastMutation) >= QUIET;
      var populated = target.querySelectorAll('*').length >= MIN_CHILDREN;
      if ((quiet && populated) || (now - started) >= TIMEOUT) {
        clearInterval(timer);
        observer.disconnect();
        resolve();
      }
    }, 80);
  }))()`;
  await page.evaluate(script).catch(() => {});
}
