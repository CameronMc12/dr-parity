/**
 * Popup / new-tab handling for the crawler.
 *
 * The recorders already hook `context.on('page')` for NETWORK capture. The
 * crawler additionally needs to capture a popup as a STATE + EDGE and (when
 * same-origin + unvisited) enqueue its route. Extra pages are closed after
 * capture so popups don't pile up and leak the session.
 *
 * Fully defensive: a click that did NOT open a popup returns null; nothing here
 * throws.
 */

import type { BrowserContext, Page } from 'playwright';

/** Same-origin check that never throws. */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * Race a popup event for a short window. Returns the new Page if one opened
 * within `timeoutMs`, otherwise null. Does NOT throw on timeout.
 */
export async function waitForPopup(
  context: BrowserContext,
  timeoutMs = 1_500,
): Promise<Page | null> {
  try {
    const popup = await context.waitForEvent('page', { timeout: timeoutMs });
    return popup;
  } catch {
    return null;
  }
}

/**
 * Settle a freshly-opened popup so it can be snapshotted at steady state.
 * Best-effort: load-state waits are bounded and swallowed.
 */
export async function settlePopup(popup: Page, timeoutMs = 5_000): Promise<void> {
  await popup.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
  await Promise.race([
    popup.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {});
}

/** Close a popup page. Never throws. */
export async function closePopup(popup: Page): Promise<void> {
  try {
    if (!popup.isClosed()) await popup.close();
  } catch {
    // best-effort
  }
}
