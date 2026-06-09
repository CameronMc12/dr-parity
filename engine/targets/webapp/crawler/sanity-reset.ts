/**
 * Sanity-reset: returns a live ClickUp page to a pristine DEFAULT baseline
 * before capture, so a snapshot reflects the bare default view rather than
 * whatever transient UI a previous interaction (or the user's last session)
 * left open.
 *
 * Why this exists: a comprehensive crawl's first state was POLLUTED because the
 * profile had ClickUp's Chat/Home panel active in the icon rail. That panel
 * leaks chat-only DOM ("Add Channel", "Direct Messages", "Channels", etc.) into
 * the sidebar and corrupts an "exact structure" rebuild of the default Spaces
 * sidebar + List view.
 *
 * The reset is fully defensive: every step is wrapped so a missing element or a
 * thrown evaluate never aborts the others, and the function never throws to its
 * caller. It is additive — it changes no existing crawler behaviour and only
 * runs where wired in explicitly.
 */
import type { Page } from 'playwright';
import { dismissStrayOverlays } from './overlay-settle';

/** Icon-rail item that activates the default Spaces sidebar. */
const SPACES_RAIL_SELECTOR = '[data-test="global-sidebar-item-spaces"]';

/**
 * Icon-rail items whose ACTIVE state opens a non-default secondary panel (Chat,
 * Home/Inbox). When one of these is the active sidebar, the chat/home DOM leaks
 * into the captured snapshot. We click back to Spaces to clear them.
 */
const NON_DEFAULT_RAIL_SELECTORS = [
  '[data-test="global-sidebar-item-chat"]',
  '[data-test="global-sidebar-item-home"]',
];

/**
 * DOM markers that prove a non-default panel (chat/home) is still mounted. Used
 * to decide whether a second reset pass is needed. These mirror the leak
 * markers the baseline verifier asserts against.
 */
const CHAT_LEAK_MARKERS = [
  '[data-chmln^="chat-sidebar"]',
  '[data-chmln^="home-sidebar"]',
  '[data-test^="chat-sidebar"]',
  '[data-test^="chat-room"]',
];

/**
 * Closes any open command palette, task-detail panel, +View menu, dropdown, or
 * modal. Presses Escape a few times, then runs the crawler's overlay dismisser
 * (Escape + backdrop click, re-checked) for anything that survives.
 */
async function closeTransientUi(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
  await dismissStrayOverlays(page, 3).catch(() => {});
}

/** True when any chat/home-panel marker is currently mounted in the DOM. */
async function hasNonDefaultPanel(page: Page): Promise<boolean> {
  const selector = CHAT_LEAK_MARKERS.join(',');
  const script = `(() => {
    try { return !!document.querySelector(${JSON.stringify(selector)}); }
    catch (e) { return false; }
  })()`;
  return Boolean(await page.evaluate(script).catch(() => false));
}

/**
 * Ensures the default Spaces sidebar is the active rail item. If a non-default
 * panel is mounted (or one of the chat/home rail items looks active), clicks the
 * Spaces rail item to switch back. Verifies by re-checking the leak markers.
 */
async function ensureSpacesSidebar(page: Page): Promise<void> {
  if (!(await hasNonDefaultPanel(page))) return;

  // Click the Spaces rail item to switch the active sidebar back to default.
  const spaces = page.locator(SPACES_RAIL_SELECTOR).first();
  if (await spaces.count().catch(() => 0)) {
    await spaces.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }

  // If a chat/home panel still lingers, click each non-default rail item once
  // to toggle it off, then return to Spaces.
  if (await hasNonDefaultPanel(page)) {
    for (const sel of NON_DEFAULT_RAIL_SELECTORS) {
      const item = page.locator(sel).first();
      if (await item.count().catch(() => 0)) {
        await item.click({ timeout: 2_000 }).catch(() => {});
        await page.waitForTimeout(200);
      }
    }
    if (await spaces.count().catch(() => 0)) {
      await spaces.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

/** Moves the cursor to a neutral corner so hover tooltips/popovers dismiss. */
async function clearHoverState(page: Page): Promise<void> {
  await page.mouse.move(5, 5).catch(() => {});
  await page.waitForTimeout(350);
}

/**
 * Return the UI to a pristine default baseline:
 *  - close modals/menus/slash menus/command palette/task panel (Escape ×3 +
 *    overlay dismisser),
 *  - ensure the default Spaces sidebar is active (no chat/home leak),
 *  - clear hover tooltips by parking the cursor in a neutral corner,
 *  - settle ~1s.
 *
 * Idempotent and fully guarded; never throws.
 */
export async function sanityReset(page: Page): Promise<void> {
  try {
    await closeTransientUi(page);
    await ensureSpacesSidebar(page);
    await closeTransientUi(page);
    await clearHoverState(page);
    await page.waitForTimeout(1_000);
  } catch {
    // best-effort: a sanity-reset failure must never break the caller
  }
}
