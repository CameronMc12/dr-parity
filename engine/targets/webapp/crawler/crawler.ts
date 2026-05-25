import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { computeCanonicalKey } from './canonical-key';
import { warmUpChrome } from './chrome-warmup';
import { clickSignature, createClickLedger } from './click-ledger';
import { populateSearch, scrollToLoad } from './content-populate';
import { computeDomHash } from './dom-hash';
import {
  discoverInteractive,
  discoverRightClickTargets,
  type DiscoveredElement,
} from './interactive-discovery';
import { dismissStrayOverlays, waitForPopulatedOverlay, waitForSteadyState } from './overlay-settle';
import {
  closePopup,
  isSameOrigin,
  settlePopup,
  waitForPopup,
} from './popup-capture';
import {
  createPriorityQueue,
  PRIORITY_NEW_ROUTE,
  type PriorityQueue,
} from './priority-queue';
import { createRouteBudget } from './route-budget';
import { buildSelectorForHandle } from './selector-builder';
import { createSignatureScan, scanPage } from './signature-scan';
import { captureState } from './state-capture';
import { startRecorders, type Recorders } from './recorders';
import { captureStorageState } from './storage-state';
import { normalizeRouteUrl } from './url-normalize';
import {
  CRAWL_GRAPH_SCHEMA_VERSION,
  type CrawlGraph,
  type CrawlOptions,
  type CrawlSummary,
  type Interaction,
  type QueueItem,
  type StateEdge,
  type StateNode,
  type StateSourceKind,
} from './types';

const ROUTE_INTERACTION_LIMIT = 60;

// How many levels of in-place overlay/tab/drawer states the crawler will keep
// exploring FROM. ClickUp-style SPAs change state without changing the URL, so
// the priority queue (keyed on URL) never sees these states. This bounds the
// inline recursion that keeps the frontier alive for those in-place states.
const MAX_INPLACE_EXPLORE_DEPTH = 4;

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
    // Block the app's own service worker at the context level. ClickUp (and
    // similar PWAs) register a SW that serves assets from Cache Storage; that
    // yields EMPTY `res.body()` even with the browser cache disabled. Blocking
    // SW registration here, plus the per-page `Network.setBypassServiceWorker`
    // in recorders, keeps every response on the network path with a real body.
    serviceWorkers: 'block',
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

  const recorders: Recorders = await startRecorders(context, opts.outDir, {
    captureJs: opts.captureJs,
  });

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

  // Replay seed: dump cookies + localStorage + sessionStorage for the start
  // route once, after auth + settle, so the replay target can boot into the
  // authenticated state. IndexedDB is NOT captured (known replay limitation).
  await captureStorageState(context, page, opts.outDir);

  const userAgent = (await page.evaluate('navigator.userAgent')) as string;
  const graph: CrawlGraph = {
    schemaVersion: CRAWL_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    startUrl: opts.startUrl,
    userAgent,
    viewport: `${opts.viewport.width}x${opts.viewport.height}`,
  };

  // Composite-canonical-key dedup set (#5). Falls back to the dom hash when a
  // key cannot be computed, so dedup behaviour never weakens.
  const canonicalToStateId = new Map<string, string>();
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

  // Priority frontier (#7): unexplored routes/states are dequeued before
  // re-derivable ones, still breadth-first-ish within a tier. Budget caps and
  // the route-once / dedup guards are unchanged — only the dequeue ORDER moves.
  const queue: PriorityQueue = createPriorityQueue([
    { url: opts.startUrl, depth: 0, viaEdge: null, priority: PRIORITY_NEW_ROUTE },
  ]);
  enqueuedRoutes.add(normalizeRouteUrl(opts.startUrl));
  let reachedLimit: CrawlSummary['reachedLimit'] = 'queue-empty';

  // Interaction kinds already exercised per route (#7) — used to prioritise
  // routes that still have an un-exercised interaction type.
  const exercisedKinds = new Map<string, Set<Interaction['kind']>>();
  const markExercised = (routeKey: string, kind: Interaction['kind']): void => {
    const set = exercisedKinds.get(routeKey) ?? new Set<Interaction['kind']>();
    set.add(kind);
    exercisedKinds.set(routeKey, set);
  };

  // Capture the current DOM. Returns the node plus its dom hash so callers can
  // scope per-state ledgers. Dedup key (#5) is the COMPOSITE canonical key
  // (normalised route + visible overlay/tab/drawer/panel signature + dom hash),
  // NOT the dom hash alone. This keeps genuinely-different states on the same
  // route (different modal/tab) distinct, while id-reroll-only differences still
  // collapse because they share route + signature + normalised hash. The plain
  // dom-hash map is still maintained so per-state ledgers keyed on the hash and
  // any hash-based fast path keep working.
  const captureCurrent = async (
    depth: number,
    sourceKind: StateSourceKind = 'route',
  ): Promise<{ node: StateNode; hash: string } | null> => {
    const { hash } = await computeDomHash(page);
    const canonicalKey = await computeCanonicalKey(page, hash).catch(() => hash);

    const existing = canonicalToStateId.get(canonicalKey);
    if (existing) {
      const found = graph.nodes.find((n) => n.id === existing);
      return found ? { node: found, hash } : null;
    }
    stateIndex++;
    const result = await captureState(page, opts.outDir, stateIndex, depth, sourceKind);
    canonicalToStateId.set(canonicalKey, result.node.id);
    if (!hashToStateId.has(hash)) hashToStateId.set(hash, result.node.id);
    graph.nodes.push(result.node);
    signatureScan.add(result.rawHtml);
    persistGraph();
    return { node: result.node, hash };
  };

  // Explore one DOM state: discover its interactive elements, click each fresh,
  // and route the outcome.
  //   - new tab / popup           -> capture + enqueue route (priority queue)
  //   - URL navigation            -> enqueue route (priority queue), return
  //   - in-place overlay/tab/etc. -> capture as a NEW canonical state AND
  //                                  recurse into it (inline frontier) so its
  //                                  own actions get explored, deduped by the
  //                                  COMPOSITE canonical key, bounded by
  //                                  MAX_INPLACE_EXPLORE_DEPTH + route budget.
  // `stateNode` / `stateHash` identify the state we are exploring FROM.
  // `routeDepth` is the crawl depth used for newly-enqueued routes.
  // `inPlaceDepth` is the inline-overlay recursion depth (0 at the base state).
  // Hard-restore the route view to a fully-settled clean base. In-place
  // dismissal (Escape/backdrop) alone is unreliable for heavy SPA modals, so
  // this dismisses, then verifies via dom hash, then reloads to the route and
  // waits for steady state when the in-place restore did not land. Guarantees
  // the next sibling click starts from a stable DOM, killing the click-timeout
  // cascade that previously stalled the crawl after the first overlay.
  const restoreToCleanBase = async (expectedUrl: string, baseHash: string): Promise<void> => {
    await dismissStrayOverlays(page);
    const urlDrifted = normalizeRouteUrl(page.url()) !== normalizeRouteUrl(expectedUrl);
    if (!urlDrifted) {
      const { hash } = await computeDomHash(page);
      if (hash === baseHash) return; // restored in place
    }
    try {
      await page.goto(expectedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await dismissStrayOverlays(page);
      await waitForSteadyState(page);
    } catch {
      /* best-effort */
    }
  };

  const exploreState = async (
    stateNode: StateNode,
    stateHash: string,
    routeDepth: number,
    routeKey: string,
    inPlaceDepth: number,
  ): Promise<void> => {
    // New in-place states discovered during this state's sibling sweep, explored
    // breadth-first AFTER the sweep so the base view stays clean for siblings.
    const deferredInPlace: { node: StateNode; hash: string; trigger: Interaction }[] = [];
    const exploredInPlaceNodeIds = new Set<string>();

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
      // Keyed on THIS state's hash so the same control on a different state
      // (e.g. a tab inside an opened modal) is still explored.
      const sig = clickSignature({
        selector: interaction.selector,
        role,
        text: interaction.selectorLabel,
      });
      if (clickLedger.seen(stateHash, sig)) continue;
      clickLedger.mark(stateHash, sig);
      routeBudget.bump(routeKey);

      const beforeUrl = page.url();

      // Arm popup detection BEFORE the click so a new tab opened by the click is
      // not missed (#8). The promise is consumed right after settle.
      const popupPromise = waitForPopup(context, 1_500);

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
        // Drain the popup race so it does not leak.
        void popupPromise.then((p) => (p ? closePopup(p) : undefined));
        continue;
      }

      await settle(page);

      // Popup / new-tab pass (#8): if the click opened a new page, capture it as
      // its own state + edge and enqueue its route when same-origin + unvisited.
      // The extra page is always closed afterwards to avoid runaway tabs.
      const popup = await popupPromise;
      if (popup && popup !== page) {
        markExercised(routeKey, 'click');
        await settlePopup(popup);
        const popupUrl = popup.url();
        const { hash: popupHash } = await computeDomHash(popup).catch(() => ({ hash: '' }));
        const popupCanonical = await computeCanonicalKey(popup, popupHash).catch(() => popupHash);
        if (popupCanonical && !canonicalToStateId.get(popupCanonical)) {
          stateIndex++;
          const captured = await captureState(
            popup,
            opts.outDir,
            stateIndex,
            routeDepth + 1,
            'popup',
          );
          canonicalToStateId.set(popupCanonical, captured.node.id);
          if (popupHash && !hashToStateId.has(popupHash)) {
            hashToStateId.set(popupHash, captured.node.id);
          }
          graph.nodes.push(captured.node);
          signatureScan.add(captured.rawHtml);
          graph.edges.push(
            makeEdge(stateNode.id, captured.node.id, { ...interaction, opensPopup: true }),
          );
          persistGraph();

          const popupKey = normalizeRouteUrl(popupUrl);
          if (
            isSameOrigin(popupUrl, opts.startUrl) &&
            !baseCapturedRoutes.has(popupKey) &&
            !enqueuedRoutes.has(popupKey)
          ) {
            enqueuedRoutes.add(popupKey);
            queue.push({
              url: popupUrl,
              depth: routeDepth + 1,
              priority: PRIORITY_NEW_ROUTE,
              viaEdge: null,
            });
          }
        }
        await closePopup(popup);
        continue;
      }

      const afterUrl = page.url();

      if (normalizeRouteUrl(afterUrl) !== routeKey) {
        markExercised(routeKey, 'navigate');
        // Route navigation. Enqueue the new route once (normalised key).
        const afterKey = normalizeRouteUrl(afterUrl);
        if (!baseCapturedRoutes.has(afterKey) && !enqueuedRoutes.has(afterKey)) {
          enqueuedRoutes.add(afterKey);
          queue.push({
            url: afterUrl,
            depth: routeDepth + 1,
            // Never-visited route — top priority tier (#7).
            priority: PRIORITY_NEW_ROUTE,
            viaEdge: {
              fromStateId: stateNode.id,
              interaction: { ...interaction, kind: 'navigate' },
              capturedAt: new Date().toISOString(),
            },
          });
        }
        // Return to the originating view for further exploration of THIS state.
        try {
          await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await settle(page);
        } catch {
          break;
        }
        continue;
      }

      markExercised(routeKey, 'click');

      // Same URL: did an in-place state (overlay/tab/drawer/panel) open? Wait
      // for it to POPULATE first so we snapshot real content, not an empty
      // shell. captureCurrent dedups on the COMPOSITE canonical key, so a
      // genuinely-new in-place state gets its own node even though the URL is
      // unchanged.
      const { hash: probeHash } = await computeDomHash(page);
      if (probeHash !== stateHash) {
        await waitForPopulatedOverlay(page);
        const overlay = await captureCurrent(routeDepth + 1, 'overlay');
        if (overlay && overlay.node.id !== stateNode.id) {
          graph.edges.push(
            makeEdge(stateNode.id, overlay.node.id, { ...interaction, opensOverlay: true }),
          );
          persistGraph();
          // Defer recursion into this NEW in-place state until AFTER the full
          // sibling sweep. Depth-first recursion here wrecks the base view (deep
          // ClickUp modals do not dismiss via Escape), making every remaining
          // sibling click time out. Breadth-first over the current state keeps
          // each sibling clicking from the same clean base.
          if (inPlaceDepth + 1 < MAX_INPLACE_EXPLORE_DEPTH) {
            deferredInPlace.push({ node: overlay.node, hash: overlay.hash, trigger: interaction });
          }
        }
        // Hard-restore the originating view so the next sibling clicks from a
        // clean, fully-settled base. In-place dismissal alone is unreliable for
        // heavy SPA modals, so reload to the route then wait for steady state.
        await restoreToCleanBase(beforeUrl, stateHash);
      }
    }

    // Phase 2: explore the deferred in-place states. Each was reached from THIS
    // state via its trigger; re-click the trigger from the (restored) clean base
    // to re-reach it, then recurse. Bounded by depth cap, budget, max-states,
    // deadline. Deduped: a state already fully explored is skipped by its node id.
    for (const deferred of deferredInPlace) {
      if (Date.now() > deadline) break;
      if (graph.nodes.length >= opts.maxStates) break;
      if (routeBudget.isExhausted(routeKey)) break;
      if (exploredInPlaceNodeIds.has(deferred.node.id)) continue;
      exploredInPlaceNodeIds.add(deferred.node.id);

      // Re-reach the in-place state by re-clicking its trigger from the clean base.
      const reClick = await tryInteract(page, deferred.trigger.selector, 'click');
      if (!reClick.ok) continue;
      await settle(page);
      await waitForPopulatedOverlay(page);
      const { hash: reHash } = await computeDomHash(page);
      if (reHash === stateHash) continue; // trigger no longer opens the state

      await exploreState(
        deferred.node,
        reHash,
        routeDepth + 1,
        routeKey,
        inPlaceDepth + 1,
      );
      await restoreToCleanBase(page.url(), stateHash);
    }
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

    const item = queue.dequeue();
    if (!item) break;
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

    // Chrome/icon WARM-UP: hover every sidebar + chrome icon host and force
    // lazy <img> sources so hover/visibility-loaded icons fire their requests
    // (recorded into network.jsonl) and their sprite <symbol>s inject BEFORE
    // the base capture. Hover-only + blocklist-aware + no reload, so the
    // route-once loop guard is unaffected. Cheap enough to run per route.
    await warmUpChrome(page);

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
      const scrolled = await captureCurrent(item.depth, 'scroll');
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
        const search = await captureCurrent(item.depth + 1, 'scroll');
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

    // The content-population passes (scroll + search) above can leave the SPA
    // mid-render or trigger a restoreBase reload. ClickUp-style Angular apps need
    // far longer than a 1.5s settle to re-bootstrap their interactive shell, so
    // re-settle to steady state before discovery — otherwise discoverInteractive
    // sees only the static chrome (~5 elements) and the frontier dies. This also
    // re-syncs baseHash to the now-settled DOM so the in-place change probe is
    // measured against the real base, not a transient mid-render snapshot.
    await dismissStrayOverlays(page);
    await waitForSteadyState(page);
    const { hash: settledBaseHash } = await computeDomHash(page);

    // Click pass. Explore this base state's interactive elements. New URL
    // navigations + popups feed the priority queue; new IN-PLACE overlay/tab
    // states (same URL, different canonical key) are explored inline so the
    // frontier does not die on SPAs that mutate state without changing the URL.
    await exploreState(node, settledBaseHash, item.depth, routeKey, 0);

    // Right-click pass. Resolve selectors up front, then click fresh by
    // selector — same stale-index avoidance as the click pass. Frontier rule
    // (#7): skip the right-click discovery only when right-click was already
    // exercised on this route from an earlier visit, so we never repeat an
    // interaction type that has been covered.
    const rcAlreadyExercised = exercisedKinds.get(routeKey)?.has('right-click') ?? false;
    if (item.depth < opts.maxDepth && !rcAlreadyExercised) {
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
        if (clickLedger.seen(settledBaseHash, sig)) continue;
        clickLedger.mark(settledBaseHash, sig);
        routeBudget.bump(routeKey);

        const beforeUrl = page.url();

        const rc = await tryInteract(page, interaction.selector, 'right-click');
        if (!rc.ok) continue;
        await settle(page, 800);

        markExercised(routeKey, 'right-click');
        const { hash: probeHash } = await computeDomHash(page);
        if (probeHash !== settledBaseHash) {
          await waitForPopulatedOverlay(page);
          const overlay = await captureCurrent(item.depth + 1, 'overlay');
          if (overlay && overlay.node.id !== node.id) {
            graph.edges.push(makeEdge(node.id, overlay.node.id, { ...interaction, opensOverlay: true }));
            persistGraph();
          }
          await restoreBase(page, beforeUrl, settledBaseHash);
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
