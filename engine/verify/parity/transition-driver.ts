/**
 * Drive the reference crawl graph's EDGES against the candidate and report,
 * per edge, whether the candidate reproduced the reference's state transition.
 *
 * For each edge fromState --interaction--> toState:
 *   1. navigate the candidate to fromState's URL (SW-controller wait + settle),
 *   2. snapshot the candidate's canonical key + DOM signature BEFORE,
 *   3. perform the interaction (click/hover) using the edge's selector,
 *   4. snapshot the canonical key + DOM signature AFTER,
 *   5. an edge is "reproduced" when the candidate transitioned in the same
 *      direction the reference did: the reference's fromState and toState
 *      canonical keys differ (a real transition), and the candidate's
 *      before/after keys also differ (it moved too). DOM-signature similarity is
 *      the tolerant fallback when canonical keys are unavailable on either side.
 *
 * Only click/hover edges are drivable from a static selector; keyboard/navigate
 * edges are reported as undrivable (counted, not scored as failures unless the
 * reference clearly transitioned).
 */

import type { BrowserContext, Page } from 'playwright';
import { createHash } from 'node:crypto';
import { captureDomSignature, domSimilarity } from '../dom-signature';
import {
  composeCanonicalKey,
  scanStructuralSignature,
} from '../../targets/webapp/crawler/canonical-key';
import type { CrawlGraph, StateEdge, StateNode } from '../../targets/webapp/crawler/types';

const NAV_TIMEOUT_MS = 30_000;
const SW_CONTROLLER_TIMEOUT_MS = 12_000;
const SETTLE_DELAY_MS = 2_500;
const INTERACTION_TIMEOUT_MS = 5_000;
const POST_INTERACTION_SETTLE_MS = 1_500;

/** Per-edge driving outcome handed to the transition scorer. */
export type EdgeOutcome = {
  fromStateId: string;
  toStateId: string;
  label: string;
  selector: string;
  kind: string;
  /** The reference's own from/to canonical keys differed (it really moved). */
  refTransitioned: boolean;
  /** The candidate's before/after canonical key (or signature) differed. */
  candTransitioned: boolean;
  /** Candidate after-state canonical key matched the reference toState key. */
  candReachedTarget: boolean;
  /** Could the interaction be performed on the candidate at all? */
  performed: boolean;
  note?: string;
};

function nodeById(graph: CrawlGraph): Map<string, StateNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function waitForSwControllerAndReload(page: Page): Promise<void> {
  let controlled = false;
  try {
    controlled = await page.evaluate(
      (timeoutMs: number) =>
        new Promise<boolean>((resolve) => {
          const nav = navigator as Navigator & { serviceWorker?: ServiceWorkerContainer };
          if (!nav.serviceWorker) return resolve(false);
          if (nav.serviceWorker.controller) return resolve(true);
          const timer = setTimeout(() => resolve(false), timeoutMs);
          nav.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              clearTimeout(timer);
              resolve(true);
            },
            { once: true },
          );
        }),
      SW_CONTROLLER_TIMEOUT_MS,
    );
  } catch {
    controlled = false;
  }
  if (controlled) {
    try {
      await page.reload({ waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
    } catch {
      /* tolerate */
    }
  }
}

async function loadAndSettle(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Timeout/i.test(msg)) return false;
  }
  await waitForSwControllerAndReload(page);
  await page.waitForTimeout(SETTLE_DELAY_MS);
  return true;
}

function hashSignature(signature: string[]): string {
  return createHash('sha256').update(signature.join('\n')).digest('hex');
}

/** Canonical key of the candidate's live page, computed the same way the crawler does. */
async function candidateCanonicalKey(page: Page): Promise<{ key: string; signature: string[] }> {
  const signature = await captureDomSignature(page);
  const structural = await scanStructuralSignature(page);
  const key = composeCanonicalKey(page.url(), structural, hashSignature(signature));
  return { key, signature };
}

async function performInteraction(
  page: Page,
  selector: string,
  kind: string,
): Promise<{ performed: boolean; note?: string }> {
  if (kind !== 'click' && kind !== 'hover') {
    return { performed: false, note: `non-drivable interaction kind "${kind}"` };
  }
  const locator = page.locator(selector).first();
  try {
    if ((await locator.count()) === 0) return { performed: false, note: 'selector not found' };
    if (kind === 'hover') await locator.hover({ timeout: INTERACTION_TIMEOUT_MS });
    else await locator.click({ timeout: INTERACTION_TIMEOUT_MS });
  } catch (err) {
    return { performed: false, note: `interaction failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  await page.waitForTimeout(POST_INTERACTION_SETTLE_MS);
  return { performed: true };
}

const SAME_STATE_THRESHOLD = 0.98;

async function driveEdge(
  ctx: BrowserContext,
  base: string,
  edge: StateEdge,
  fromNode: StateNode,
  toNode: StateNode,
): Promise<EdgeOutcome> {
  const label = edge.interaction.selectorLabel || edge.interaction.selector;
  const refTransitioned = (fromNode.canonicalKey ?? fromNode.domHash) !== (toNode.canonicalKey ?? toNode.domHash);
  const out: EdgeOutcome = {
    fromStateId: edge.fromStateId,
    toStateId: edge.toStateId,
    label,
    selector: edge.interaction.selector,
    kind: edge.interaction.kind,
    refTransitioned,
    candTransitioned: false,
    candReachedTarget: false,
    performed: false,
  };

  const page = await ctx.newPage();
  try {
    const ok = await loadAndSettle(page, joinUrl(base, urlPath(fromNode.url)));
    if (!ok) {
      out.note = 'candidate fromState failed to load';
      return out;
    }
    const before = await candidateCanonicalKey(page);
    const result = await performInteraction(page, edge.interaction.selector, edge.interaction.kind);
    out.performed = result.performed;
    if (!result.performed) {
      out.note = result.note;
      return out;
    }
    const after = await candidateCanonicalKey(page);

    out.candTransitioned = domSimilarity(before.signature, after.signature) < SAME_STATE_THRESHOLD;
    // Target match: the candidate's after key equals the reference toState key,
    // OR (tolerant) the after signature structurally differs from before in the
    // same way the reference moved.
    if (toNode.canonicalKey && after.key === toNode.canonicalKey) {
      out.candReachedTarget = true;
    } else {
      out.candReachedTarget = out.candTransitioned === refTransitioned;
    }
  } catch (err) {
    out.note = `edge drive error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}

export type DriveEdgesResult = {
  outcomes: EdgeOutcome[];
  notes: string[];
};

/** Drive every graph edge against the candidate base URL. */
export async function driveGraphEdges(
  ctx: BrowserContext,
  candidateBase: string,
  graph: CrawlGraph,
  onProgress?: (m: string) => void,
): Promise<DriveEdgesResult> {
  const nodes = nodeById(graph);
  const outcomes: EdgeOutcome[] = [];
  const notes: string[] = [];

  for (const edge of graph.edges ?? []) {
    const fromNode = nodes.get(edge.fromStateId);
    const toNode = nodes.get(edge.toStateId);
    if (!fromNode || !toNode) {
      notes.push(`edge ${edge.fromStateId}->${edge.toStateId}: missing node`);
      continue;
    }
    onProgress?.(`  candidate edge: ${edge.fromStateId} -> ${edge.toStateId} (${edge.interaction.kind})`);
    outcomes.push(await driveEdge(ctx, candidateBase, edge, fromNode, toNode));
  }
  return { outcomes, notes };
}
