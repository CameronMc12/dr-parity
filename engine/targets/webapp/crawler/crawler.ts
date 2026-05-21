import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type BrowserContext, type ElementHandle, type Page } from 'playwright';
import { computeDomHash } from './dom-hash';
import {
  discoverInteractive,
  discoverRightClickTargets,
  type DiscoveredElement,
} from './interactive-discovery';
import { buildSelectorForHandle } from './selector-builder';
import { createSignatureScan, scanPage } from './signature-scan';
import { captureState } from './state-capture';
import { startRecorders, type Recorders } from './recorders';
import type {
  CrawlGraph,
  CrawlOptions,
  CrawlSummary,
  Interaction,
  QueueItem,
  StateEdge,
  StateNode,
} from './types';

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

async function dismissOverlay(page: Page, expectedUrl: string): Promise<void> {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  try {
    await page.mouse.click(5, 5);
  } catch {
    // noop
  }
  await page.waitForTimeout(250);
  // Navigate back if the URL drifted unintentionally
  if (page.url() !== expectedUrl) {
    try {
      await page.goto(expectedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await settle(page);
    } catch {
      // best-effort
    }
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

async function tryInteract(
  page: Page,
  index: number,
  kind: 'click' | 'right-click',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const handleScript = `((window.__drParityElements && window.__drParityElements[${index}]) || null)`;
    const handle = await page.evaluateHandle(handleScript);
    const el = handle.asElement() as ElementHandle<HTMLElement> | null;
    if (!el) return { ok: false, error: 'element handle null' };
    if (kind === 'click') {
      await el.click({ timeout: 2_000, force: false });
    } else {
      await el.click({ timeout: 2_000, button: 'right' });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
  const visitedUrls = new Set<string>();
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
  let reachedLimit: CrawlSummary['reachedLimit'] = 'queue-empty';

  const captureCurrent = async (depth: number): Promise<StateNode | null> => {
    const { hash } = await computeDomHash(page);
    const existing = hashToStateId.get(hash);
    if (existing) {
      const found = graph.nodes.find((n) => n.id === existing);
      return found ?? null;
    }
    stateIndex++;
    const result = await captureState(page, opts.outDir, stateIndex, depth);
    hashToStateId.set(hash, result.node.id);
    graph.nodes.push(result.node);
    signatureScan.add(result.rawHtml);
    persistGraph();
    return result.node;
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

    if (page.url() !== item.url) {
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

    const node = await captureCurrent(item.depth);
    if (!node) continue;

    if (item.viaEdge) {
      graph.edges.push({ ...item.viaEdge, toStateId: node.id });
      persistGraph();
    }

    visitedUrls.add(item.url);

    if (item.depth >= opts.maxDepth) continue;

    // Click pass
    const elements: DiscoveredElement[] = await discoverInteractive(page, opts.extraBlocklist);
    for (const el of elements) {
      if (Date.now() > deadline) break;
      if (graph.nodes.length >= opts.maxStates) break;
      if (el.blocked) {
        blockedCount++;
        continue;
      }

      const beforeUrl = page.url();
      const { hash: beforeHash } = await computeDomHash(page);

      const selector = await buildSelectorForHandle(page, el.index);
      const interaction: Interaction = {
        kind: 'click',
        selector: selector?.selector ?? el.selectorHint,
        selectorLabel: selector?.label ?? (el.text || el.ariaLabel || el.tag),
        elementTag: selector?.tag ?? el.tag,
      };

      const click = await tryInteract(page, el.index, 'click');
      if (!click.ok) {
        errorCount++;
        recorders.writeError({
          kind: 'click-failed',
          selector: interaction.selector,
          message: click.error,
        });
        continue;
      }

      await settle(page);

      const afterUrl = page.url();
      const { hash: afterHash } = await computeDomHash(page);

      if (afterUrl !== beforeUrl) {
        // Treat as route navigation; enqueue if not visited.
        if (!visitedUrls.has(afterUrl)) {
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
        // Go back to the originating state for further exploration.
        try {
          await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await settle(page);
        } catch {
          break;
        }
        continue;
      }

      if (afterHash !== beforeHash) {
        const overlayNode = await captureCurrent(item.depth + 1);
        if (overlayNode && overlayNode.id !== node.id) {
          graph.edges.push(makeEdge(node.id, overlayNode.id, interaction));
          persistGraph();
          // Queue the overlay for further exploration.
          queue.push({
            url: overlayNode.url,
            depth: item.depth + 1,
            viaEdge: null,
          });
        }
        await dismissOverlay(page, beforeUrl);
        await settle(page);
      }
    }

    // Right-click pass
    if (item.depth < opts.maxDepth) {
      const rcIndices = await discoverRightClickTargets(page);
      for (const idx of rcIndices) {
        if (Date.now() > deadline) break;
        if (graph.nodes.length >= opts.maxStates) break;

        const beforeUrl = page.url();
        const { hash: beforeHash } = await computeDomHash(page);

        const selector = await buildSelectorForHandle(page, idx);
        const interaction: Interaction = {
          kind: 'right-click',
          selector: selector?.selector ?? `index-${idx}`,
          selectorLabel: selector?.label ?? `right-click-${idx}`,
          elementTag: selector?.tag ?? 'unknown',
        };

        const rc = await tryInteract(page, idx, 'right-click');
        if (!rc.ok) continue;
        await settle(page, 800);

        const { hash: afterHash } = await computeDomHash(page);
        if (afterHash !== beforeHash) {
          const overlayNode = await captureCurrent(item.depth + 1);
          if (overlayNode && overlayNode.id !== node.id) {
            graph.edges.push(makeEdge(node.id, overlayNode.id, interaction));
            persistGraph();
          }
          await dismissOverlay(page, beforeUrl);
          await settle(page);
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
