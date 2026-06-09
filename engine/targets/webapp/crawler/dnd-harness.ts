/**
 * DELIVERABLE B — drag-and-drop interaction harness.
 *
 * signature-scan already DETECTS dnd-kit / react-beautiful-dnd / native
 * draggable but the crawler never triggers a drag. This harness performs a FEW
 * representative, reversible drags using Playwright low-level pointer events
 * (mouse.move/down/up with intermediate steps) — HTML5 + dnd-kit both need real
 * pointer movement, not a synthetic click.
 *
 * Captured per drag:
 *   - a MID-DRAG state (pointer held over the drop target)
 *   - a POST-DROP state (pointer released)
 *
 * Stability rules:
 *   - reorder ADJACENT rows/cards only; drag a Board card to an ADJACENT column;
 *     drag-resize a Gantt bar. NEVER drag across lists / spaces (would mutate the
 *     hierarchy).
 *   - after each drag, attempt to REVERT (drag back). If revert cannot be
 *     confirmed, the harness logs a drift note and HARD-CAPS to MAX_DRAGS_DRIFT
 *     so workspace drift stays bounded.
 */

import type { Page } from 'playwright';
import type { HarnessContext } from './harness-context';
import type { Interaction, StateNode } from './types';

const DND_SIGNATURES: readonly string[] = [
  'dnd-kit',
  'react-beautiful-dnd',
];

/**
 * ClickUp ships custom `cu-*` web-component drag rather than dnd-kit /
 * react-beautiful-dnd / native HTML5 `draggable`. Detection therefore does NOT
 * require `draggable="true"` — it looks for ClickUp drag affordances directly.
 */
const ROW_SELECTOR =
  '[data-rbd-draggable-id], [role="row"][draggable="true"], .cu-task-row, [class*="cu-draggable" i], [class*="drag-handle" i]';
const CARD_SELECTOR =
  '[data-rbd-draggable-id], [data-dnd-kit-id], .cu-board-card, [class*="board-card" i]';
const COLUMN_SELECTOR =
  '[data-rbd-droppable-id], [class*="board-column" i], [class*="board-group" i]';
const GANTT_BAR_SELECTOR =
  '[class*="gantt" i] [class*="bar" i], .cu-gantt__bar, [data-gantt-bar]';

/** Hard cap on drags once revert reliability is in doubt. */
const MAX_DRAGS_DRIFT = 2;
/** Cap on drags when reverts are confirmed clean. */
const MAX_DRAGS_CLEAN = 4;
/** Intermediate pointer steps per drag (real movement for HTML5 / dnd-kit). */
const MOVE_STEPS = 8;

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

function center(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function makeInteraction(label: string): Interaction {
  return {
    kind: 'click',
    selector: 'pointer-drag',
    selectorLabel: label,
    elementTag: 'dnd',
  };
}

type DndDetection = {
  rows: number;
  cards: number;
  columns: number;
  ganttBars: number;
  nativeDraggable: number;
};

const EMPTY_DETECTION: DndDetection = {
  rows: 0,
  cards: 0,
  columns: 0,
  ganttBars: 0,
  nativeDraggable: 0,
};

/** Detect which DnD-capable targets exist. Pure read-only. */
async function detectDndTargets(page: Page): Promise<DndDetection> {
  const payload = JSON.stringify({
    rows: ROW_SELECTOR,
    cards: CARD_SELECTOR,
    columns: COLUMN_SELECTOR,
    gantt: GANTT_BAR_SELECTOR,
  });
  const script = `(() => {
    var SEL = ${payload};
    function count(sel) {
      var n = 0;
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) n++;
      }
      return n;
    }
    return {
      rows: count(SEL.rows),
      cards: count(SEL.cards),
      columns: count(SEL.columns),
      ganttBars: count(SEL.gantt),
      nativeDraggable: count('[draggable="true"]')
    };
  })()`;
  return (await page.evaluate(script).catch(() => EMPTY_DETECTION)) as DndDetection;
}

/** Real pointer drag from one point to another with intermediate steps. */
async function pointerDrag(
  page: Page,
  from: Point,
  to: Point,
  onMidDrag?: () => Promise<void>,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Small wiggle to satisfy dnd-kit's activation distance constraint.
  await page.mouse.move(from.x + 4, from.y + 4, { steps: 2 });

  for (let i = 1; i <= MOVE_STEPS; i++) {
    const x = from.x + ((to.x - from.x) * i) / MOVE_STEPS;
    const y = from.y + ((to.y - from.y) * i) / MOVE_STEPS;
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(40);
  }

  if (onMidDrag) await onMidDrag();

  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Drag two adjacent draggables (rows OR cards) and revert. */
async function dragAdjacent(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
  selector: string,
  label: string,
): Promise<{ captured: number; reverted: boolean }> {
  const { page } = ctx;
  const items = page.locator(selector);
  const total = await items.count().catch(() => 0);
  if (total < 2) return { captured: 0, reverted: true };

  const firstBox = await items.nth(0).boundingBox().catch(() => null);
  const secondBox = await items.nth(1).boundingBox().catch(() => null);
  if (!firstBox || !secondBox) return { captured: 0, reverted: true };

  const a = center(firstBox);
  const b = center(secondBox);
  let captured = 0;

  await pointerDrag(page, a, b, async () => {
    const mid = await ctx.capture({
      fromNode,
      depth: depth + 1,
      interaction: makeInteraction(`dnd-mid:${label}`),
    });
    if (mid) captured++;
  });

  const post = await ctx.capture({
    fromNode,
    depth: depth + 1,
    interaction: makeInteraction(`dnd-drop:${label}`),
  });
  if (post) captured++;

  // Revert: drag back. Re-measure since positions shifted after the drop.
  await ctx.throttle.wait(page);
  const revFirst = await items.nth(1).boundingBox().catch(() => null);
  const revSecond = await items.nth(0).boundingBox().catch(() => null);
  let reverted = false;
  if (revFirst && revSecond) {
    await pointerDrag(page, center(revFirst), center(revSecond));
    reverted = true;
  }

  await ctx.restore();
  return { captured, reverted };
}

/** Drag a Board card into the adjacent column. */
async function dragCardToAdjacentColumn(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<{ captured: number; reverted: boolean }> {
  const { page } = ctx;
  const cards = page.locator(CARD_SELECTOR);
  const columns = page.locator(COLUMN_SELECTOR);
  const cardCount = await cards.count().catch(() => 0);
  const colCount = await columns.count().catch(() => 0);
  if (cardCount < 1 || colCount < 2) return { captured: 0, reverted: true };

  const cardBox = await cards.nth(0).boundingBox().catch(() => null);
  const targetColBox = await columns.nth(1).boundingBox().catch(() => null);
  if (!cardBox || !targetColBox) return { captured: 0, reverted: true };

  const from = center(cardBox);
  // Drop near the top of the adjacent column, NOT across a different list.
  const to = { x: targetColBox.x + targetColBox.width / 2, y: targetColBox.y + 60 };
  let captured = 0;

  await pointerDrag(page, from, to, async () => {
    const mid = await ctx.capture({
      fromNode,
      depth: depth + 1,
      interaction: makeInteraction('dnd-mid:board-card'),
    });
    if (mid) captured++;
  });

  const post = await ctx.capture({
    fromNode,
    depth: depth + 1,
    interaction: makeInteraction('dnd-drop:board-card'),
  });
  if (post) captured++;

  // Revert: drag the card back toward the original column.
  await ctx.throttle.wait(page);
  const movedCard = await cards.nth(0).boundingBox().catch(() => null);
  const origColBox = await columns.nth(0).boundingBox().catch(() => null);
  let reverted = false;
  if (movedCard && origColBox) {
    await pointerDrag(page, center(movedCard), {
      x: origColBox.x + origColBox.width / 2,
      y: origColBox.y + 60,
    });
    reverted = true;
  }

  await ctx.restore();
  return { captured, reverted };
}

/** Drag-resize a Gantt bar by its right edge, then resize back. */
async function dragResizeGantt(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<{ captured: number; reverted: boolean }> {
  const { page } = ctx;
  const bars = page.locator(GANTT_BAR_SELECTOR);
  const total = await bars.count().catch(() => 0);
  if (total < 1) return { captured: 0, reverted: true };

  const box = await bars.nth(0).boundingBox().catch(() => null);
  if (!box) return { captured: 0, reverted: true };

  const rightEdge = { x: box.x + box.width - 2, y: box.y + box.height / 2 };
  const extended = { x: rightEdge.x + 40, y: rightEdge.y };
  let captured = 0;

  await pointerDrag(page, rightEdge, extended, async () => {
    const mid = await ctx.capture({
      fromNode,
      depth: depth + 1,
      interaction: makeInteraction('dnd-mid:gantt-resize'),
    });
    if (mid) captured++;
  });

  const post = await ctx.capture({
    fromNode,
    depth: depth + 1,
    interaction: makeInteraction('dnd-drop:gantt-resize'),
  });
  if (post) captured++;

  // Revert: shrink the bar back by the same delta.
  await ctx.throttle.wait(page);
  await pointerDrag(page, extended, rightEdge);

  await ctx.restore();
  return { captured, reverted: true };
}

export type DndHarnessResult = {
  capturedStates: number;
  dragsPerformed: number;
  driftNote: string | null;
};

/**
 * Run the DnD harness IF a DnD signature is present. Each drag is independently
 * guarded; an unreverted drag triggers a drift cap so workspace mutation stays
 * bounded. Returns a tally + any drift caveat for the run log.
 */
export async function runDndHarness(
  ctx: HarnessContext,
  fromNode: StateNode,
  depth: number,
): Promise<DndHarnessResult> {
  const detected = await detectDndTargets(ctx.page).catch(() => null);
  if (!detected) {
    return { capturedStates: 0, dragsPerformed: 0, driftNote: null };
  }

  // Run whenever ANY drag affordance exists: a dnd-kit / rbd signature, native
  // HTML5 draggables, OR ClickUp `cu-*` drag affordances (rows / cards /
  // columns / gantt bars). ClickUp uses custom web-component drag with no
  // signature and no `draggable="true"`, so affordance presence is the gate.
  const sigs = ctx.signatures();
  const hasDndSig = DND_SIGNATURES.some((s) => sigs.includes(s));
  const hasNative = detected.nativeDraggable > 0;
  const hasAffordance =
    detected.rows >= 2 ||
    detected.cards >= 1 ||
    detected.columns >= 1 ||
    detected.ganttBars >= 1;
  if (!hasDndSig && !hasNative && !hasAffordance) {
    return { capturedStates: 0, dragsPerformed: 0, driftNote: null };
  }

  let capturedStates = 0;
  let dragsPerformed = 0;
  let driftNote: string | null = null;
  let maxDrags = MAX_DRAGS_CLEAN;

  const attempts: Array<() => Promise<{ captured: number; reverted: boolean }>> = [];

  if (detected.rows >= 2) {
    attempts.push(() => dragAdjacent(ctx, fromNode, depth, ROW_SELECTOR, 'row-reorder'));
  }
  if (detected.cards >= 2 && detected.columns < 2) {
    attempts.push(() => dragAdjacent(ctx, fromNode, depth, CARD_SELECTOR, 'card-reorder'));
  }
  if (detected.cards >= 1 && detected.columns >= 2) {
    attempts.push(() => dragCardToAdjacentColumn(ctx, fromNode, depth));
  }
  if (detected.ganttBars >= 1) {
    attempts.push(() => dragResizeGantt(ctx, fromNode, depth));
  }

  for (const attempt of attempts) {
    if (ctx.isAtCapacity()) break;
    if (dragsPerformed >= maxDrags) break;
    await ctx.throttle.wait(ctx.page);

    try {
      const { captured, reverted } = await attempt();
      if (captured > 0) {
        capturedStates += captured;
        dragsPerformed++;
      }
      if (!reverted) {
        driftNote =
          'one or more drags could not be confirmed reverted; capped to bound workspace drift';
        maxDrags = Math.min(maxDrags, MAX_DRAGS_DRIFT);
        ctx.note(driftNote);
      }
    } catch (err) {
      ctx.note(`dnd attempt failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { capturedStates, dragsPerformed, driftNote };
}
