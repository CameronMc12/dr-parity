/**
 * DELIVERABLE A — L5 keyboard interaction harness.
 *
 * Three read-only-ish probes, each fully guarded and throttled, each captured
 * through the crawler's existing dedup'd capture path:
 *
 *   1. command center  — Cmd/Ctrl+K, enumerate visible command items, optionally
 *                        trigger SAFE (non-denylisted) items and capture results.
 *   2. slash menu      — in a contenteditable / [role=textbox], type `/`, capture
 *                        the menu, then Escape WITHOUT inserting a block.
 *   3. hotkey sweep    — a small curated set of safe global shortcuts (search,
 *                        notifications, quick-create, sidebar toggle, help) fired
 *                        from a neutral state, captured, then dismissed.
 *
 * NOTHING destructive is ever triggered: command items whose label matches the
 * destructive denylist are skipped. The slash menu is captured but never used to
 * insert a block. Every probe is wrapped so a single failure cannot abort the
 * crawl.
 */

import type { Page } from 'playwright';
import type { HarnessContext } from './harness-context';
import type { Interaction, StateNode } from './types';

/**
 * Verbs that mutate or destroy data irreversibly. A command-palette label
 * matching ANY of these (case-insensitive substring) is never triggered.
 */
const DESTRUCTIVE_VERBS: readonly string[] = [
  'delete',
  'archive',
  'remove',
  'trash',
  'leave',
  'merge',
  'convert',
  'move to trash',
  'permanently',
  'clear all',
  'reset',
  'log out',
  'logout',
  'sign out',
  'unsubscribe',
  'disconnect',
  'revoke',
];

/**
 * Curated, safe-ish ClickUp global shortcuts. Each opens an overlay / view we
 * can snapshot then dismiss with Escape. Kept deliberately small — expand only
 * with clearly non-destructive combos.
 */
const HOTKEY_SWEEP: ReadonlyArray<{ combo: string; label: string }> = [
  { combo: 'Slash', label: 'hotkey-search' },
  { combo: 'Shift+KeyN', label: 'hotkey-notifications' },
  { combo: 'KeyT', label: 'hotkey-quick-create-task' },
  { combo: 'Shift+Period', label: 'hotkey-toggle-sidebar' },
  { combo: 'Shift+Slash', label: 'hotkey-help' },
];

const EDITABLE_SELECTOR =
  '[contenteditable="true"], [role="textbox"], .ProseMirror, .ql-editor, .cu-editor';

function isMac(): boolean {
  return process.platform === 'darwin';
}

function isDestructive(label: string): boolean {
  const haystack = label.toLowerCase();
  return DESTRUCTIVE_VERBS.some((verb) => haystack.includes(verb));
}

function makeInteraction(label: string, keyCombo: string): Interaction {
  return {
    kind: 'keyboard',
    selector: 'window',
    selectorLabel: label,
    elementTag: 'window',
    keyCombo,
  };
}

/** Enumerate visible command-palette items (text + role) from the live DOM. */
async function enumerateCommandItems(
  page: Page,
): Promise<Array<{ text: string; role: string | null }>> {
  const script = `(() => {
    var sel = '[role="option"], [role="menuitem"], [data-testid*="command" i] li, .cu-command-center__item, [class*="command" i] [role="button"]';
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var out = [];
    var seen = new Set();
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      var st = window.getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
      if (!text) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push({ text: text, role: el.getAttribute('role') });
      if (out.length >= 60) break;
    }
    return out;
  })()`;
  return (await page.evaluate(script).catch(() => [])) as Array<{
    text: string;
    role: string | null;
  }>;
}

async function openCommandCenter(page: Page): Promise<boolean> {
  const combo = isMac() ? 'Meta+KeyK' : 'Control+KeyK';
  await page.keyboard.press(combo).catch(() => {});
  await page.waitForTimeout(400);
  const items = await enumerateCommandItems(page);
  return items.length > 0;
}

/**
 * Probe 1 — command center. Opens via Cmd/Ctrl+K, captures the palette, then
 * triggers up to `maxTrigger` SAFE items (clicked by visible text) capturing the
 * resulting state for each. Destructive labels are skipped.
 */
async function probeCommandCenter(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
  maxTrigger: number,
): Promise<number> {
  const { page } = ctx;
  let captured = 0;

  if (!(await openCommandCenter(page))) return 0;

  const palette = await ctx.capture({
    fromNode,
    depth,
    interaction: makeInteraction('kbd-cmdk', isMac() ? 'Meta+K' : 'Control+K'),
  });
  if (palette) captured++;

  const items = await enumerateCommandItems(page);
  const safe = items.filter((it) => !isDestructive(it.text)).slice(0, maxTrigger);

  for (const item of safe) {
    if (ctx.isAtCapacity()) break;
    await ctx.throttle.wait(page);

    // Re-open: a previous trigger likely closed the palette.
    if (!(await openCommandCenter(page))) break;

    const target = page.getByText(item.text, { exact: false }).first();
    const exists = await target.count().catch(() => 0);
    if (!exists) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }
    await target.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(500);

    const node = await ctx.capture({
      fromNode,
      depth: depth + 1,
      interaction: makeInteraction(`kbd-cmdk-item:${item.text.slice(0, 40)}`, 'Enter'),
    });
    if (node) captured++;

    await ctx.restore();
  }

  await page.keyboard.press('Escape').catch(() => {});
  return captured;
}

async function findEditable(page: Page): Promise<boolean> {
  const count = await page
    .locator(EDITABLE_SELECTOR)
    .first()
    .count()
    .catch(() => 0);
  return count > 0;
}

/**
 * Probe 2 — slash menu. Focuses the first editable region, types `/` to open the
 * block menu, captures it, then Escape WITHOUT inserting anything.
 */
async function probeSlashMenu(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<number> {
  const { page } = ctx;
  if (!(await findEditable(page))) return 0;

  const editable = page.locator(EDITABLE_SELECTOR).first();
  await editable.click({ timeout: 2_000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.keyboard.type('/').catch(() => {});
  await page.waitForTimeout(450);

  const node = await ctx.capture({
    fromNode,
    depth: depth + 1,
    interaction: makeInteraction('slash-menu', '/'),
  });

  // Remove the typed '/' and close the menu — never insert a block.
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await ctx.restore();

  return node ? 1 : 0;
}

/**
 * Probe 3 — curated hotkey sweep. Each combo is fired from a neutral state,
 * the resulting overlay captured, then dismissed with Escape.
 */
async function probeHotkeySweep(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<number> {
  const { page } = ctx;
  let captured = 0;

  for (const { combo, label } of HOTKEY_SWEEP) {
    if (ctx.isAtCapacity()) break;
    await ctx.throttle.wait(page);

    // Fire from a neutral, focused-body state.
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 5, y: 5 }, timeout: 1_000 }).catch(() => {});
    await page.keyboard.press(combo).catch(() => {});
    await page.waitForTimeout(450);

    const node = await ctx.capture({
      fromNode,
      depth: depth + 1,
      interaction: makeInteraction(label, combo),
    });
    if (node) captured++;

    await page.keyboard.press('Escape').catch(() => {});
    await ctx.restore();
  }

  return captured;
}

export type KeyboardHarnessResult = {
  capturedStates: number;
  triggeredCommands: number;
};

/**
 * Run the full L5 keyboard harness for the current route base state. Every probe
 * is independently try/catch-wrapped so one failure never aborts the others or
 * the crawl. Returns a small tally for the run log.
 */
export async function runKeyboardHarness(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
  opts: { maxCommandTriggers?: number } = {},
): Promise<KeyboardHarnessResult> {
  const maxTrigger = opts.maxCommandTriggers ?? 6;
  let capturedStates = 0;
  let triggeredCommands = 0;

  try {
    if (!ctx.isAtCapacity()) {
      const n = await probeCommandCenter(ctx, fromNode, depth, maxTrigger);
      capturedStates += n;
      triggeredCommands += Math.max(0, n - 1);
    }
  } catch (err) {
    ctx.note(`kbd-cmdk failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    if (!ctx.isAtCapacity()) {
      capturedStates += await probeSlashMenu(ctx, fromNode, depth);
    }
  } catch (err) {
    ctx.note(`slash-menu failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    if (!ctx.isAtCapacity()) {
      capturedStates += await probeHotkeySweep(ctx, fromNode, depth);
    }
  } catch (err) {
    ctx.note(`hotkey-sweep failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { capturedStates, triggeredCommands };
}
