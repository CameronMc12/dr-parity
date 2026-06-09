/**
 * Crawler-side helper: run a profile's discoverers and merge their seeds into
 * the priority frontier. Extracted from `crawler.ts` to keep the touch-point
 * in the crawler minimal (a single `await mergeProfileDiscovererSeeds(...)`).
 *
 * Additive: when the profile has no discoverers (or is absent), this is a
 * no-op — the crawler's DOM-only frontier remains unchanged.
 *
 * Bootstrap corpus: when the profile declares a `bootstrapCorpus` (an array
 * of file globs), those patterns are expanded once here and the resolved
 * file list is handed to each discoverer via `DiscoveryContext.bootstrapCorpusPaths`.
 * This is what makes the hybrid discoverer useful on a FRESH crawl — the
 * in-flight `networkLogPaths` is empty at t=0, but the bootstrap corpus
 * carries prior captures with real bodies to mine.
 *
 * Errors are logged + swallowed so a faulty discoverer never blocks the crawl.
 */

import { expandBootstrapCorpus } from './api-hierarchy-traverser';
import { PRIORITY_NEW_ROUTE } from '../priority-queue';
import { normalizeRouteUrl } from '../url-normalize';
import { CONFIDENCE_RANK, type SeedConfidence } from './types';
import type { PriorityQueue } from '../priority-queue';
import type { WebappProfileLike } from '../types';

/**
 * Confidence-driven priority offset. Strict and inferred seeds outrank the
 * crawler's default `PRIORITY_NEW_ROUTE` so they get visited first. Fallback
 * seeds (no type signal at all, fanned across N URL segments) sink BELOW the
 * default so they cannot displace the start URL or any DOM-discovered route.
 *
 * Offsets are intentionally chosen so all three tiers stay distinct from the
 * existing `PRIORITY_NEW_ROUTE = 100` and `PRIORITY_REVISIT = -50` tiers.
 */
const PRIORITY_OFFSET_BY_CONFIDENCE: Record<SeedConfidence, number> = {
  strict: 3,
  inferred: 2,
  fallback: -60,
};

function priorityForSeedConfidence(confidence: SeedConfidence | undefined): number {
  const tier = confidence ?? 'strict';
  return PRIORITY_NEW_ROUTE + PRIORITY_OFFSET_BY_CONFIDENCE[tier];
}

/**
 * Read the `confidence` field off a seed regardless of whether the seed was
 * typed as `RouteSeed` (rich shape) or via the structural sub-type that
 * discoverers in `WebappProfileLike` declare (no `confidence` field). Falls
 * back to `'strict'` so legacy discoverers that don't set the field behave
 * the same as before this iteration.
 */
function readConfidenceTier(seed: unknown): SeedConfidence {
  if (seed && typeof seed === 'object') {
    const value = (seed as { confidence?: unknown }).confidence;
    if (value === 'strict' || value === 'inferred' || value === 'fallback') return value;
  }
  return 'strict';
}

/**
 * Stable sort seeds so the crawler enqueues highest-confidence first. The
 * priority queue already orders by `priority` at dequeue, but pushing in
 * confidence order keeps the log line readable (strict first) and is robust
 * if someone ever switches the queue back to plain FIFO. Generic so it works
 * against both the structural `WebappProfileLike` discoverer return type and
 * the richer `RouteSeed` shape exported from `./types`.
 */
function sortSeedsByConfidence<T extends object>(seeds: ReadonlyArray<T>): T[] {
  const tierOf = (seed: T): SeedConfidence => {
    const value = (seed as { confidence?: unknown }).confidence;
    if (value === 'strict' || value === 'inferred' || value === 'fallback') return value;
    return 'strict';
  };
  return seeds
    .map((seed, index) => ({ seed, index }))
    .sort((a, b) => {
      const rankDelta = CONFIDENCE_RANK[tierOf(b.seed)] - CONFIDENCE_RANK[tierOf(a.seed)];
      return rankDelta !== 0 ? rankDelta : a.index - b.index; // stable within tier
    })
    .map((entry) => entry.seed);
}

export async function mergeProfileDiscovererSeeds(
  startUrl: string,
  profile: WebappProfileLike | undefined,
  queue: PriorityQueue,
  enqueuedRoutes: Set<string>,
): Promise<void> {
  const discoverers = profile?.discoverers;
  if (!discoverers || discoverers.length === 0) return;
  let host = '';
  let origin = '';
  try {
    const u = new URL(startUrl);
    host = u.host;
    origin = u.origin;
  } catch {
    return;
  }
  // `bootstrapCorpus` is an additive optional field on the real `WebappProfile`
  // (engine/targets/webapp/profiles/types.ts). The structural sub-type
  // `WebappProfileLike` in `../types` is not extended this iteration, so we
  // narrow-cast at the read site.
  const profileBootstrapCorpus = (
    profile as { bootstrapCorpus?: ReadonlyArray<string> } | undefined
  )?.bootstrapCorpus;
  const bootstrapCorpusPaths = expandBootstrapCorpus(profileBootstrapCorpus);
  if (bootstrapCorpusPaths.length > 0) {
    console.log(
      `[crawl] bootstrap corpus: ${bootstrapCorpusPaths.length} file(s) resolved from ${profileBootstrapCorpus?.length ?? 0} glob(s)`,
    );
  }
  const ctx = {
    host,
    origin,
    startUrl,
    networkLogPaths: [] as readonly string[],
    bootstrapCorpusPaths,
  };
  for (const discoverer of discoverers) {
    try {
      const seeds = sortSeedsByConfidence(await invokeBootstrap(discoverer, ctx));
      enqueueAndLog(discoverer.name, seeds, queue, enqueuedRoutes, profile?.name, 'bootstrap');
    } catch (err) {
      console.log(
        `[crawl] discoverer "${discoverer.name}" bootstrap failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Page-phase: invoked AFTER the first navigation + settle. Each discoverer's
 * optional `discoverFromPage(ctx)` is called with the live Playwright page
 * folded into the context. Discoverers that don't implement `discoverFromPage`
 * are skipped. New seeds are appended to the same priority frontier, deduped
 * by normalised route against `enqueuedRoutes` so a viewId already known from
 * the bootstrap pass doesn't get a duplicate entry.
 */
export async function runProfilePageDiscovery(
  page: unknown,
  startUrl: string,
  profile: WebappProfileLike | undefined,
  queue: PriorityQueue,
  enqueuedRoutes: Set<string>,
): Promise<void> {
  const discoverers = profile?.discoverers;
  if (!discoverers || discoverers.length === 0) return;
  let host = '';
  let origin = '';
  try {
    const u = new URL(startUrl);
    host = u.host;
    origin = u.origin;
  } catch {
    return;
  }
  const ctx = {
    host,
    origin,
    startUrl,
    networkLogPaths: [] as readonly string[],
    page,
  };
  for (const discoverer of discoverers) {
    const fn = (
      discoverer as {
        discoverFromPage?: (ctx: unknown) => Promise<unknown>;
      }
    ).discoverFromPage;
    if (typeof fn !== 'function') continue;
    try {
      const result = (await fn.call(discoverer, ctx)) as ReadonlyArray<unknown>;
      const seeds = sortSeedsByConfidence(
        result as ReadonlyArray<{ url: string; confidence?: unknown }>,
      );
      enqueueAndLog(discoverer.name, seeds, queue, enqueuedRoutes, profile?.name, 'page-sidebar');
    } catch (err) {
      console.log(
        `[crawl] discoverer "${discoverer.name}" page-phase failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Resolve the bootstrap callable for a discoverer: prefer the new
 * `discoverFromBootstrap`, fall back to the legacy `discover`. Returns an
 * empty array when neither is implemented so missing methods don't throw.
 */
function invokeBootstrap(
  discoverer: unknown,
  ctx: unknown,
): Promise<ReadonlyArray<{ url: string; confidence?: unknown }>> {
  const d = discoverer as {
    discoverFromBootstrap?: (ctx: unknown) => Promise<unknown>;
    discover?: (ctx: unknown) => Promise<unknown>;
  };
  if (typeof d.discoverFromBootstrap === 'function') {
    return d.discoverFromBootstrap(ctx) as Promise<
      ReadonlyArray<{ url: string; confidence?: unknown }>
    >;
  }
  if (typeof d.discover === 'function') {
    return d.discover(ctx) as Promise<ReadonlyArray<{ url: string; confidence?: unknown }>>;
  }
  return Promise.resolve([]);
}

/**
 * Shared enqueue + log routine for both phases. Pushes each seed onto the
 * priority queue (deduped by normalised route), tallies per-tier counts, and
 * emits the `enqueued N new route(s): strict=… inferred=… fallback=…` line.
 */
function enqueueAndLog(
  discovererName: string,
  seeds: ReadonlyArray<{ url: string; confidence?: unknown }>,
  queue: PriorityQueue,
  enqueuedRoutes: Set<string>,
  profileName: string | undefined,
  phase: 'bootstrap' | 'page-sidebar',
): void {
  const perTier: Record<SeedConfidence, number> = { strict: 0, inferred: 0, fallback: 0 };
  let added = 0;
  for (const seed of seeds) {
    const key = normalizeRouteUrl(seed.url);
    if (enqueuedRoutes.has(key)) continue;
    enqueuedRoutes.add(key);
    const tier = readConfidenceTier(seed);
    queue.push({
      url: seed.url,
      depth: 0,
      viaEdge: null,
      priority: priorityForSeedConfidence(tier),
    });
    perTier[tier]++;
    added++;
  }
  console.log(
    `[crawl] discoverer "${discovererName}" [${phase}] enqueued ${added} new route(s): strict=${perTier.strict}, inferred=${perTier.inferred}, fallback=${perTier.fallback} (profile=${profileName ?? 'default'})`,
  );
}
