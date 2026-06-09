/**
 * DELIVERABLE C — L4 hover-as-state harness.
 *
 * Discovers hover-trigger elements (title / aria-describedby / [data-tip] /
 * [data-tooltip] / avatars / toolbar icons / menu triggers / truncated cells),
 * hovers each (throttled), waits briefly for a NEW floating / portal layer to
 * appear, and if one does, captures it as a distinct `hover-<n>` state via the
 * crawler's existing dedup'd capture path. De-dupes by DOM signature like the
 * existing BFS (canonical-key dedup happens inside `capture`). Mouse is moved
 * away to dismiss before the next probe.
 */

import type { Page } from 'playwright';
import type { HarnessContext } from './harness-context';
import type { Interaction, StateNode } from './types';

const HOVER_TRIGGER_SELECTOR = [
  '[title]:not([title=""])',
  '[aria-describedby]',
  '[data-tip]',
  '[data-tooltip]',
  '[data-tooltip-content]',
  // Avatars (assignee chips, member badges).
  '.cu-avatar, [class*="avatar" i]',
  // Toolbar / view-bar icon buttons.
  '[class*="toolbar" i] button',
  '[class*="toolbar" i] [role="button"]',
  '[class*="view-bar" i] button',
  '[aria-haspopup="true"]',
  '[aria-haspopup="menu"]',
  '[class*="truncate" i]',
  // Status pills / circles.
  '[class*="status" i][class*="pill" i], [class*="cu-status" i], [class*="status-circle" i]',
  // Priority flags.
  '[class*="priority" i]',
  // Tag pills.
  '[class*="tag" i][class*="pill" i], [class*="cu-tag" i], [class*="tags" i] [class*="pill" i]',
  // Row kebab / quick-action buttons (often only visible on row hover, but
  // matched here so we probe them; the actual menus surface via right-click).
  '[class*="kebab" i], [class*="quick-action" i], [aria-label*="more" i], [class*="ellipsis" i]',
  // Sidebar items (spaces / folders / lists).
  '[class*="sidebar" i] [class*="item" i], [data-test*="sidebar" i] a, nav [role="treeitem"]',
  // Due-date / date chips.
  '[class*="due" i], [class*="date" i][class*="chip" i]',
].join(',');

/** Floating layers that typically appear ONLY on hover. */
const FLOATING_SELECTOR = [
  '[role="tooltip"]',
  '[data-floating-ui-portal]',
  '[data-radix-popper-content-wrapper]',
  '[class*="tooltip" i]',
  '[class*="popover" i]',
  // ClickUp portal / floating layers.
  '[class*="cu-tooltip" i]',
  '[class*="cu-popover" i]',
  '[class*="cu-floating" i]',
  '[class*="cdk-overlay" i]',
  '.cu-dropdown, [class*="dropdown" i][class*="content" i]',
].join(',');

const MAX_HOVER_TARGETS = 40;
/** Post-hover settle window: polls × interval. ClickUp tooltips appear lazily. */
const HOVER_POLLS = 10;
const HOVER_POLL_MS = 150;

type HoverTarget = {
  index: number;
  label: string;
  tag: string;
};

function makeInteraction(label: string): Interaction {
  return {
    kind: 'hover',
    selector: 'hover-target',
    selectorLabel: label,
    elementTag: 'hover',
  };
}

/** Stash visible hover triggers on window and return their handles. */
async function discoverHoverTargets(page: Page): Promise<HoverTarget[]> {
  const payload = JSON.stringify({ sel: HOVER_TRIGGER_SELECTOR, max: MAX_HOVER_TARGETS });
  const script = `(() => {
    var ARGS = ${payload};
    var w = window;
    w.__drParityHoverTargets = [];
    function visible(el) {
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      var st = window.getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return false;
      if (parseFloat(st.opacity || '1') < 0.05) return false;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
      if (rect.right < 0 || rect.left > window.innerWidth) return false;
      return true;
    }
    var nodes = Array.prototype.slice.call(document.querySelectorAll(ARGS.sel));
    var seen = new Set();
    var out = [];
    var index = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (seen.has(el)) continue;
      seen.add(el);
      if (!visible(el)) continue;
      var label = (el.getAttribute('title') || el.getAttribute('aria-label') ||
                   el.getAttribute('data-tooltip') || el.getAttribute('data-tip') ||
                   (el.textContent || '').replace(/\\s+/g, ' ').trim()).slice(0, 60);
      w.__drParityHoverTargets.push(el);
      out.push({ index: index, label: label || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase() });
      index++;
      if (out.length >= ARGS.max) break;
    }
    return out;
  })()`;
  return (await page.evaluate(script).catch(() => [])) as HoverTarget[];
}

/** Count visible floating layers currently in the DOM. */
async function floatingCount(page: Page): Promise<number> {
  const script = `(() => {
    var sel = ${JSON.stringify(FLOATING_SELECTOR)};
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      var st = window.getComputedStyle(nodes[i]);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      n++;
    }
    return n;
  })()`;
  return (await page.evaluate(script).catch(() => 0)) as number;
}

/** Get the centre point of a stashed hover target by index. */
async function targetPoint(
  page: Page,
  index: number,
): Promise<{ x: number; y: number } | null> {
  const script = `(() => {
    var el = (window.__drParityHoverTargets || [])[${index}];
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`;
  return (await page.evaluate(script).catch(() => null)) as { x: number; y: number } | null;
}

export type HoverHarnessResult = {
  capturedStates: number;
  hoveredTargets: number;
};

/**
 * Run the L4 hover harness for the current route base state. Each hover is
 * guarded; a new floating layer (versus the pre-hover baseline) triggers a
 * capture. Mouse is parked away between probes to dismiss the prior tooltip.
 */
export async function runHoverHarness(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<HoverHarnessResult> {
  const { page } = ctx;
  let capturedStates = 0;
  let hoveredTargets = 0;

  let targets: HoverTarget[] = [];
  try {
    targets = await discoverHoverTargets(page);
  } catch (err) {
    ctx.note(`hover discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    return { capturedStates, hoveredTargets };
  }

  let hoverIndex = 0;

  for (const target of targets) {
    if (ctx.isAtCapacity()) break;
    await ctx.throttle.wait(page);

    try {
      // Park the mouse away first so the prior tooltip dismisses and the
      // baseline floating-count is clean.
      await page.mouse.move(2, 2).catch(() => {});
      await page.waitForTimeout(120);
      const baseline = await floatingCount(page);

      const point = await targetPoint(page, target.index);
      if (!point) continue;
      await page.mouse.move(point.x, point.y).catch(() => {});
      hoveredTargets++;

      // Poll for a NEW floating layer to appear. ClickUp tooltips / popovers
      // mount lazily, so the settle window is generous.
      let appeared = false;
      for (let i = 0; i < HOVER_POLLS; i++) {
        await page.waitForTimeout(HOVER_POLL_MS);
        if ((await floatingCount(page)) > baseline) {
          appeared = true;
          break;
        }
      }
      // Extra settle so the floating layer is fully populated before capture.
      if (appeared) await page.waitForTimeout(200);
      if (!appeared) continue;

      hoverIndex++;
      const node = await ctx.capture({
        fromNode,
        depth: depth + 1,
        interaction: makeInteraction(`hover-${hoverIndex}:${target.label}`),
      });
      if (node) capturedStates++;

      // Dismiss before the next probe.
      await page.mouse.move(2, 2).catch(() => {});
      await page.waitForTimeout(100);
    } catch (err) {
      ctx.note(`hover probe failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { capturedStates, hoveredTargets };
}
