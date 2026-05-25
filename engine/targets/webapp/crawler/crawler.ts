import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { clickSignature, createClickLedger } from './click-ledger';
import { populateSearch, scrollToLoad } from './content-populate';
import { computeDomHash } from './dom-hash';
import {
  discoverInteractive,
  discoverRightClickTargets,
  type DiscoveredElement,
} from './interactive-discovery';
import { dismissStrayOverlays, waitForPopulatedOverlay, waitForSteadyState } from './overlay-settle';
import { createRouteBudget } from './route-budget';
import { buildSelectorForHandle } from './selector-builder';
import { createSignatureScan, scanPage } from './signature-scan';
import { captureState } from './state-capture';
import { startRecorders, type Recorders } from './recorders';
import { normalizeRouteUrl } from './url-normalize';
import type {
  CrawlGraph,
  CrawlOptions,
  CrawlSummary,
  Interaction,
  QueueItem,
  StateEdge,
  StateNode,
} from './types';

const ROUTE_INTERACTION_LIMIT = 60;

const LOGIN_HINT_RE = /\/(login|signin|sign-in|signup|sign-up|auth)\b/i;

type AuthCheck =
  | { ok: true }
  | { ok: false; reason: string };

async function verifyAuthenticated(page: Page, startUrl: string): Promise<AuthCheck> {
  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } catch (err) {
    return { ok: false, reason: `navigation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const url = page.url();
  if (LOGIN_HINT_RE.test(url)) {
    return { ok: false, reason: `redirected to apparent login page: ${url}` };
  }
  const hasPasswordField = await page
    .locator('input[type="password"]:visible')
    .first()
    .count()
    .catch(() => 0);
  if (hasPasswordField > 0) {
    return { ok: false, reason: 'password input visible — session likely expired' };
  }
  return { ok: true };
}

async function settle(page: Page, timeoutMs = 1_500): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {});
  await page.waitForTimeout(200);
}

/**
 * Restore the base view after an overlay interaction WITHOUT reloading when
 * possible. Dismisses the overlay (Escape + backdrop, re-checked) and verifies
 * restoration by comparing the post-dismiss normalised DOM hash to the captured
 * base hash. Only falls back to a full `page.goto` reload when dismissal failed
 * to restore the base (hash mismatch) or the URL drifted to another route.
 */
async function restoreBase(
  page: Page,
  expectedUrl: string,
  baseHash: string,
): Promise<void> {
  await dismissStrayOverlays(page);

  const urlDrifted = normalizeRouteUrl(page.url()) !== normalizeRouteUrl(expectedUrl);
  if (!urlDrifted) {
    const { hash } = await computeDomHash(page);
    if (hash === baseHash) return; // restored in place — no reload needed
  }

  try {
    await page.goto(expectedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await settle(page);
  } catch {
    // best-effort
  }
}

function makeEdge(
  fromStateId: string,
  toStateId: string,
  interaction: Interaction,
): StateEdge {
  return {
    fromStateId,
    toStateId,
    interaction,
    capturedAt: new Date().toISOString(),
  };
}

type InteractResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'error'; error?: string };

/**
 * Resolve the element FRESH at click time by stable selector, never by a
 * stashed `window.__drParityElements` index (stale after any DOM mutation /
 * SPA re-render). A 0-match resolution means the element no longer exists after
 * prior interactions — that is skipped gracefully, not counted as an error.
 */
async function tryInteract(
  page: Page,
  selector: string,
  kind: 'click' | 'right-click',
): Promise<InteractResult> {
  let target;
  try {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) return { ok: false, reason: 'missing' };
    target = locator;
  } catch {
    return { ok: false, reason: 'missing' };
  }
  try {
    const button = kind === 'right-click' ? 'right' : 'left';
    await target.click({ timeout: 2_000, button, force: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runCrawler(opts: CrawlOptions): Promise<CrawlSummary> {
  mkdirSync(opts.outDir, { recursive: true });
  mkdirSync(join(opts.outDir, 'states'), { recursive: true });

  const start = Date.now();
  const deadline = start + opts.maxTime * 1_000;

  console.log(`[crawl] launching persistent Chrome profile: ${opts.userDataDir}`);
  const context = await chromium.launchPersistentContext(opts.userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: opts.viewport,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* noop */
    }
  });

  const recorders: Recorders = await startRecorders(context, opts.outDir);

  const page = context.pages()[0] ?? (await context.newPage());
  await recorders.attachToPage(page);

  const signatureScan = createSignatureScan();

  const auth = await verifyAuthenticated(page, opts.startUrl);
  if (!auth.ok) {
    console.error(`[crawl] not authenticated: ${auth.reason}`);
    console.error('[crawl] run: npm run login (or scripts/login-omni.ts) to refresh the session.');
    await recorders.close();
    await context.close();
    const failed: CrawlSummary = {
      stateCount: 0,
      edgeCount: 0,
      durationMs: Date.now() - start,
      blocked: 0,
      errors: 1,
      signaturesFound: [],
      finishedAt: new Date().toISOString(),
      reachedLimit: 'fatal-error',
    };
    writeFileSync(join(opts.outDir, 'summary.json'), JSON.stringify(failed, null, 2), 'utf8');
    return failed;
  }

  await settle(page);

  const userAgent = (await page.evaluate('navigator.userAgent')) as string;
  const graph: CrawlGraph = {
    nodes: [],
    edges: [],
    startUrl: opts.startUrl,
    userAgent,
    viewport: `${opts.viewport.width}x${opts.viewport.height}`,
  };

  const hashToStateId = new Map<string, string>();
  // Normalised route keys we have already BASE-captured. Each distinct route
  // is base-captured exactly once; this is the primary loop guard.
  const baseCapturedRoutes = new Set<string>();
  // Normalised route keys already enqueued, to avoid duplicate queue entries.
  const enqueuedRoutes = new Set<string>();
  const clickLedger = createClickLedger();
  const routeBudget = createRouteBudget(ROUTE_INTERACTION_LIMIT, (routePath, limit) => {
    console.log(`[crawl] route budget exhausted for ${routePath} (limit ${limit})`);
  });
  let blockedCount = 0;
  let errorCount = 0;
  let stateIndex = 0;

  const persistGraph = (): void => {
    writeFileSync(join(opts.outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8');
    writeFileSync(
      join(opts.outDir, 'signatures.json'),
      JSON.stringify({ signatures: signatureScan.list() }, null, 2),
      'utf8',
    );
  };

  // DRY-RUN: list interactive elements, no clicks.
  if (opts.dryRun) {
    console.log('[crawl] dry-run mode — listing interactive elements only');
    await scanPage(page, signatureScan);
    const elements = await discoverInteractive(page, opts.extraBlocklist);
    const report = elements.map((e) => ({
      index: e.index,
      tag: e.tag,
      text: e.text,
      ariaLabel: e.ariaLabel,
      selectorHint: e.selectorHint,
      blocked: e.blocked,
    }));
    writeFileSync(
      join(opts.outDir, 'dry-run-elements.json'),
      JSON.stringify(report, null, 2),
      'utf8',
    );
    console.log(`[crawl] dry-run: found ${report.length} interactive elements`);
    for (const item of report.slice(0, 30)) {
      const flag = item.blocked ? ' (BLOCKED)' : '';
      console.log(`  - [${item.index}] <${item.tag}> ${item.selectorHint}${flag}`);
    }
    persistGraph();
    await recorders.close();
    await context.close();
    const summary: CrawlSummary = {
      stateCount: 0,
      edgeCount: 0,
      durationMs: Date.now() - start,
      blocked: report.filter((e) => e.blocked).length,
      errors: 0,
      signaturesFound: signatureScan.list(),
      finishedAt: new Date().toISOString(),
      reachedLimit: 'dry-run',
    };
    writeFileSync(join(opts.outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    return summary;
  }

  const queue: QueueItem[] = [{ url: opts.startUrl, depth: 0, viaEdge: null }];
  enqueuedRoutes.add(normalizeRouteUrl(opts.startUrl));
  let reachedLimit: CrawlSummary['reachedLimit'] = 'queue-empty';

  // Capture the current DOM. Returns the node plus its dom hash so callers can
  // scope per-state ledgers. Reuses an existing node when the (normalised) DOM
  // hash already exists, which is the core state-dedup guard.
  const captureCurrent = async (
    depth: number,
  ): Promise<{ node: StateNode; hash: string } | null> => {
    const { hash } = await computeDomHash(page);
    const existing = hashToStateId.get(hash);
    if (existing) {
      const found = graph.nodes.find((n) => n.id === existing);
      return found ? { node: found, hash } : null;
    }
    stateIndex++;
    const result = await captureState(page, opts.outDir, stateIndex, depth);
    hashToStateId.set(hash, result.node.id);
    graph.nodes.push(result.node);
    signatureScan.add(result.rawHtml);
    persistGraph();
    return { node: result.node, hash };
  };

  while (queue.length > 0) {
    if (Date.now() > deadline) {
      reachedLimit = 'max-time';
      break;
    }
    if (graph.nodes.length >= opts.maxStates) {
      reachedLimit = 'max-states';
      break;
    }

    const item = queue.shift()!;
    if (item.depth > opts.maxDepth) continue;

    const routeKey = normalizeRouteUrl(item.url);
    // Route-once guard: a route that has already been base-captured is never
    // re-explored. This is what stops the 96x-same-route loop.
    if (baseCapturedRoutes.has(routeKey) && item.viaEdge === null) continue;

    if (normalizeRouteUrl(page.url()) !== routeKey) {
      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (err) {
        errorCount++;
        recorders.writeError({
          kind: 'navigation-failed',
          url: item.url,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      await settle(page);
    }

    // Close any modal/dialog/overlay left open before the BASE capture so the
    // snapshot is the real underlying view, not a view behind a stuck modal.
    await dismissStrayOverlays(page);
    // Wait for the route to FULLY settle (network idle + DOM-mutation quiet)
    // before the single base capture, so heavy SPAs are snapshotted at steady
    // state rather than mid-load.
    await waitForSteadyState(page);

    const base = await captureCurrent(item.depth);
    if (!base) continue;
    const node = base.node;
    const baseHash = base.hash;

    if (item.viaEdge) {
      graph.edges.push({ ...item.viaEdge, toStateId: node.id });
      persistGraph();
    }

    baseCapturedRoutes.add(routeKey);

    // Content-population pass. Wake lazy/infinite content with safe read-only
    // actions (scroll + benign search query) so list rows, inbox items, chat
    // history and search results are captured populated rather than as empty
    // shells. Each population action self-restores (scroll-to-top / Escape) and
    // any resulting distinct DOM is captured via the dedup'd captureCurrent, so
    // the route-once guard and the no-reload behaviour are unaffected.
    if (Date.now() <= deadline && graph.nodes.length < opts.maxStates) {
      await scrollToLoad(page);
      await waitForSteadyState(page, { quietMs: 400, timeoutMs: 6_000 });
      const scrolled = await captureCurrent(item.depth);
      if (scrolled && scrolled.node.id !== node.id) {
        graph.edges.push(
          makeEdge(node.id, scrolled.node.id, {
            kind: 'keyboard',
            selector: 'window',
            selectorLabel: 'scroll-to-load',
            elementTag: 'window',
          }),
        );
        persistGraph();
      }
    }

    if (Date.now() <= deadline && graph.nodes.length < opts.maxStates) {
      const beforeSearchUrl = page.url();
      const populated = await populateSearch(page);
      if (populated) {
        const search = await captureCurrent(item.depth + 1);
        if (search && search.node.id !== node.id) {
          graph.edges.push(
            makeEdge(node.id, search.node.id, {
              kind: 'keyboard',
              selector: 'cu-search-modal-toggle',
              selectorLabel: 'search-populate',
              elementTag: 'input',
              opensOverlay: true,
            }),
          );
          persistGraph();
        }
      }
      // populateSearch closes search with Escape; restore base in place if the
      // search UI left any stray overlay or drifted the DOM.
      await restoreBase(page, beforeSearchUrl, baseHash);
    }

    if (item.depth >= opts.maxDepth) continue;

    // Click pass. Capture stable selectors UP FRONT from the single discovery
    // pass, BEFORE any click mutates the DOM. We then resolve each element
    // fresh by selector at click time, so the stale-index problem is gone.
    const discovered: DiscoveredElement[] = await discoverInteractive(page, opts.extraBlocklist);
    const targets: { interaction: Interaction; role: string | null }[] = [];
    for (const el of discovered) {
      if (el.blocked) {
        blockedCount++;
        continue;
      }
      const selector = await buildSelectorForHandle(page, el.index);
      targets.push({
        role: el.role,
        interaction: {
          kind: 'click',
          selector: selector?.selector ?? el.selectorHint,
          selectorLabel: selector?.label ?? (el.text || el.ariaLabel || el.tag),
          elementTag: selector?.tag ?? el.tag,
        },
      });
    }

    for (const { interaction, role } of targets) {
      if (Date.now() > deadline) break;
      if (graph.nodes.length >= opts.maxStates) break;
      if (routeBudget.isExhausted(routeKey)) {
        routeBudget.logIfFirstHit(routeKey);
        break;
      }

      // Per-state click ledger: never re-click the same element on this state.
      const sig = clickSignature({
        selector: interaction.selector,
        role,
        text: interaction.selectorLabel,
      });
      if (clickLedger.seen(baseHash, sig)) continue;
      clickLedger.mark(baseHash, sig);
      routeBudget.bump(routeKey);

      const beforeUrl = page.url();

      const click = await tryInteract(page, interaction.selector, 'click');
      if (!click.ok) {
        // Element gone after prior interactions — skip silently. Only true
        // click errors are recorded.
        if (click.reason === 'error') {
          errorCount++;
          recorders.writeError({
            kind: 'click-failed',
            selector: interaction.selector,
            message: click.error,
          });
        }
        continue;
      }

      await settle(page);

      const afterUrl = page.url();

      if (normalizeRouteUrl(afterUrl) !== routeKey) {
        // Route navigation. Enqueue the new route once (normalised key).
        const afterKey = normalizeRouteUrl(afterUrl);
        if (!baseCapturedRoutes.has(afterKey) && !enqueuedRoutes.has(afterKey)) {
          enqueuedRoutes.add(afterKey);
          queue.push({
            url: afterUrl,
            depth: item.depth + 1,
            viaEdge: {
              fromStateId: node.id,
              interaction: { ...interaction, kind: 'navigate' },
              capturedAt: new Date().toISOString(),
            },
          });
        }
        // Return to the originating route for further exploration.
        try {
          await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await settle(page);
        } catch {
          break;
        }
        continue;
      }

      // Same route: did an overlay open? Wait for it to POPULATE first so we
      // snapshot real content rather than an empty shell.
      const { hash: probeHash } = await computeDomHash(page);
      if (probeHash !== baseHash) {
        await waitForPopulatedOverlay(page);
        const overlay = await captureCurrent(item.depth + 1);
        if (overlay && overlay.node.id !== node.id) {
          graph.edges.push(makeEdge(node.id, overlay.node.id, { ...interaction, opensOverlay: true }));
          persistGraph();
        }
        // Overlays are NOT enqueued as routes — they belong to this route's
        // base state and are reached via their trigger edge. Restore the base
        // in place (no reload) unless dismissal failed.
        await restoreBase(page, beforeUrl, baseHash);
      }
    }

    // Right-click pass. Resolve selectors up front, then click fresh by
    // selector — same stale-index avoidance as the click pass.
    if (item.depth < opts.maxDepth) {
      const rcIndices = await discoverRightClickTargets(page);
      const rcTargets: Interaction[] = [];
      for (const idx of rcIndices) {
        const selector = await buildSelectorForHandle(page, idx);
        if (!selector) continue;
        rcTargets.push({
          kind: 'right-click',
          selector: selector.selector,
          selectorLabel: selector.label,
          elementTag: selector.tag,
        });
      }

      for (const interaction of rcTargets) {
        if (Date.now() > deadline) break;
        if (graph.nodes.length >= opts.maxStates) break;
        if (routeBudget.isExhausted(routeKey)) {
          routeBudget.logIfFirstHit(routeKey);
          break;
        }

        const sig = clickSignature({
          selector: interaction.selector,
          role: 'context-menu',
          text: interaction.selectorLabel,
        });
        if (clickLedger.seen(baseHash, sig)) continue;
        clickLedger.mark(baseHash, sig);
        routeBudget.bump(routeKey);

        const beforeUrl = page.url();

        const rc = await tryInteract(page, interaction.selector, 'right-click');
        if (!rc.ok) continue;
        await settle(page, 800);

        const { hash: probeHash } = await computeDomHash(page);
        if (probeHash !== baseHash) {
          await waitForPopulatedOverlay(page);
          const overlay = await captureCurrent(item.depth + 1);
          if (overlay && overlay.node.id !== node.id) {
            graph.edges.push(makeEdge(node.id, overlay.node.id, { ...interaction, opensOverlay: true }));
            persistGraph();
          }
          await restoreBase(page, beforeUrl, baseHash);
        }
      }
    }
  }

  await scanPage(page, signatureScan);
  persistGraph();

  const summary: CrawlSummary = {
    stateCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    durationMs: Date.now() - start,
    blocked: blockedCount,
    errors: errorCount,
    signaturesFound: signatureScan.list(),
    finishedAt: new Date().toISOString(),
    reachedLimit,
  };
  writeFileSync(join(opts.outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  await recorders.close();
  await context.close();
  return summary;
}
