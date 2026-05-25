/**
 * Chrome / icon WARM-UP pass for the webapp crawler.
 *
 * Many SPAs (e.g. ClickUp) lazy-load their chrome icons: a sidebar may hold 36
 * `cu-simple-bar-item-icon` slots but only the ACTIVE item ever sets its
 * `<img src>`; the rest set their src via JS on hover or on becoming visible.
 * A static clone never fires those triggers, so the icon image files are never
 * requested (never captured) and their `<use href="#...">` sprite symbols are
 * never injected. Net result: most sidebar + chrome icons render blank.
 *
 * `warmUpChrome` forces every lazy chrome/icon to load by:
 *   1. Hovering each visible sidebar nav item + chrome icon host in sequence
 *      (bounded by count + time) to trigger hover-loaded icons.
 *   2. Forcing every lazy `<img>` to its real src and `loading="eager"`, and
 *      nudging each scroll container so IntersectionObservers fire.
 *   3. Waiting for network idle + a DOM-mutation settle so the newly-loaded
 *      icon images land and the sprite container accumulates new `<symbol>`s.
 *
 * Fully defensive: missing selectors are skipped silently (no throw). It only
 * HOVERS and mutates img attributes — it never clicks, so destructive actions
 * cannot fire. As a second layer of safety it skips hovering any element whose
 * visible text / aria-label matches the destructive blocklist. It performs no
 * navigation or reload, so the route-once loop guard is unaffected.
 */

import type { Page } from 'playwright';
import { ALWAYS_BLOCKED_TEXT } from './blocklist';

const CHROME_HOST_SELECTOR =
  'cu-simple-bar-item, cu-simple-bar-item-icon, [class*="simple-bar" i] *, cu3-icon, [class*="nav" i] a, [class*="topbar" i] *, [class*="sidebar" i] a';

const MAX_HOVER_ELEMENTS = 120;
const HOVER_BUDGET_MS = 15_000;
const HOVER_STEP_DELAY_MS = 40;

const SETTLE_QUIET_MS = 500;
const SETTLE_TIMEOUT_MS = 6_000;

type HoverBox = { x: number; y: number };

/**
 * Collects the centre point of each visible chrome/icon host, capped at
 * `MAX_HOVER_ELEMENTS`, skipping any element whose text / aria-label matches a
 * destructive blocklist phrase. Returns plain `{x,y}` points so we can hover by
 * mouse move without holding stale element handles across DOM mutations.
 */
async function collectHoverBoxes(page: Page): Promise<HoverBox[]> {
  const script = `(() => {
    var sel = ${JSON.stringify(CHROME_HOST_SELECTOR)};
    var blocked = ${JSON.stringify(ALWAYS_BLOCKED_TEXT)};
    var cap = ${MAX_HOVER_ELEMENTS};
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var seen = {};
    var out = [];
    for (var i = 0; i < nodes.length && out.length < cap; i++) {
      var el = nodes[i];
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      var style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      var label = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      var isBlocked = false;
      for (var b = 0; b < blocked.length; b++) {
        if (label.indexOf(blocked[b]) !== -1) { isBlocked = true; break; }
      }
      if (isBlocked) continue;
      var x = Math.round(rect.left + rect.width / 2);
      var y = Math.round(rect.top + rect.height / 2);
      var key = x + ':' + y;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ x: x, y: y });
    }
    return out;
  })()`;
  return (await page.evaluate(script).catch(() => [])) as HoverBox[];
}

/**
 * Hovers each collected chrome/icon host in sequence (mouse move to its centre)
 * with a tiny delay, bounded by `HOVER_BUDGET_MS`, to trigger hover-loaded
 * icons. Each move is best-effort; a failure on one point never aborts the
 * sweep.
 */
async function hoverChromeIcons(page: Page): Promise<void> {
  const boxes = await collectHoverBoxes(page);
  const deadline = Date.now() + HOVER_BUDGET_MS;
  for (const box of boxes) {
    if (Date.now() > deadline) break;
    await page.mouse.move(box.x, box.y).catch(() => {});
    await page.waitForTimeout(HOVER_STEP_DELAY_MS);
  }
}

/**
 * In-page: for every `<img>` carrying a lazy source (`data-src`/`data-lazy`/
 * `data-original`) or `loading="lazy"` or an empty `src`, promote the lazy
 * source to `src` and set `loading="eager"` so the request fires and is
 * recorded. Then nudge every scroll container by a small amount and back to
 * fire IntersectionObservers that gate visibility-loaded icons. Returns the
 * number of imgs touched (diagnostic only).
 */
async function forceLazyImages(page: Page): Promise<number> {
  const script = `(() => {
    var touched = 0;
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var lazySrc = img.getAttribute('data-src') ||
        img.getAttribute('data-lazy') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-original');
      var isLazyLoading = img.getAttribute('loading') === 'lazy';
      var emptySrc = !img.getAttribute('src');
      if (lazySrc && (emptySrc || isLazyLoading)) {
        img.setAttribute('src', lazySrc);
        touched++;
      }
      if (isLazyLoading) {
        img.setAttribute('loading', 'eager');
        if (touched === 0) touched++;
      }
    }
    var nodes = Array.prototype.slice.call(document.querySelectorAll('*'));
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      if (el.scrollHeight - el.clientHeight < 50) continue;
      var oy = window.getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      var top = el.scrollTop;
      el.scrollTop = Math.min(el.scrollHeight, top + el.clientHeight);
      el.scrollTop = top;
    }
    return touched;
  })()`;
  return (await page.evaluate(script).catch(() => 0)) as number;
}

/**
 * Waits for the document to reach steady state after the warm-up sweep: a
 * network-idle race, then a DOM-mutation settle (no document-wide mutations for
 * `SETTLE_QUIET_MS`, bounded by `SETTLE_TIMEOUT_MS`). This lets the newly
 * requested icon images land and the sprite container accumulate the freshly
 * injected `<symbol>`s before the base capture.
 */
async function waitForWarmupSettle(page: Page): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }),
    new Promise<void>((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS)),
  ]).catch(() => {});

  const script = `(() => new Promise((resolve) => {
    var QUIET = ${SETTLE_QUIET_MS};
    var TIMEOUT = ${SETTLE_TIMEOUT_MS};
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
 * Forces every lazy chrome/icon to load before the base capture. Run AFTER
 * `waitForSteadyState` and BEFORE `captureCurrent`. Defensive end-to-end: no
 * throw on missing selectors, hover-only (no clicks), blocklist-aware, and no
 * navigation/reload.
 */
export async function warmUpChrome(page: Page): Promise<void> {
  try {
    await hoverChromeIcons(page);
    await forceLazyImages(page);
    await waitForWarmupSettle(page);
  } catch {
    // best-effort: warm-up never blocks the capture flow
  }
}
