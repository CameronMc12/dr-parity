/**
 * Hybrid route discoverer.
 *
 * Consumes the multi-pass extraction from `api-hierarchy-traverser` and emits
 * a deduplicated `RouteSeed[]`:
 *
 *   1. Strict + inferred records are tier-collapsed per viewId. When the same
 *      viewId surfaces in multiple passes with the same URL segment, the
 *      highest-confidence record wins. When passes disagree on the segment,
 *      the highest tier's segment wins; ties broken by first-seen.
 *   2. Unresolved viewIds (no type signal at all) are fanned out: one
 *      `fallback` seed per known URL segment. The crawler will visit each
 *      candidate; non-resolving URLs surface as 404s through the existing
 *      navigation-error log.
 *   3. The seed list is deduplicated by `(viewId, urlSegment)` pair: a viewId
 *      can have at most one seed per segment, with the highest-tier label.
 *
 * Logging: produces ONE structured log line summarising the per-tier seed
 * counts, plus a count of unresolved viewIds that triggered fan-out. The
 * crawler-side merge layer prints its own enqueued-count line.
 *
 * Iteration scope: this iteration ships ONLY the api-hierarchy-traverser as a
 * sub-discoverer. A follow-up iteration will add the DOM sidebar expander as
 * a second sub-discoverer, composed in the same way.
 */

import type { Page } from 'playwright';

import {
  extractViewsFromNetworkLogs,
  fallbackUrlSegments,
  synthesiseViewUrl,
  type ExtractedView,
} from './api-hierarchy-traverser';
import { expandSidebarTree } from './sidebar-tree-expander';
import {
  CONFIDENCE_RANK,
  PRIORITY_NEW_ROUTE,
  type DiscoveryContext,
  type PageDiscoveryContext,
  type RouteDiscoverer,
  type RouteSeed,
  type SeedConfidence,
} from './types';

const LOG_PREFIX = '[hybrid-discoverer]';

export type HybridDiscovererOptions = {
  /** Log every extracted view to stdout. Defaults to false. */
  verbose?: boolean;
};

// =============================================================================
// Helpers
// =============================================================================

function bucketForSegment(segment: string): string {
  switch (segment) {
    case 'l':
      return 'list';
    case 'b':
      return 'board';
    case 't':
      return 'table';
    case 'c':
      return 'calendar';
    case 'g':
      return 'gantt';
    case 'tl':
    case 'li':
      return 'timeline';
    case 'dc':
      return 'doc';
    default:
      return segment;
  }
}

/**
 * Pick the strongest record from a list of extracted views for one viewId.
 * Tier order: strict > inferred (> fallback never appears here — fallbacks
 * come from unresolved ids, not from the typed extraction).
 */
function strongestRecord(records: readonly ExtractedView[]): ExtractedView {
  let best = records[0];
  for (let i = 1; i < records.length; i++) {
    const candidate = records[i];
    if (CONFIDENCE_RANK[candidate.confidence] > CONFIDENCE_RANK[best.confidence]) {
      best = candidate;
    }
  }
  return best;
}

function makeSeed(
  origin: string,
  viewId: string,
  urlSegment: string,
  confidence: SeedConfidence,
  sourceTag: string,
): RouteSeed | null {
  const url = synthesiseViewUrl(origin, viewId, urlSegment);
  if (!url) return null;
  return {
    url,
    priority: PRIORITY_NEW_ROUTE,
    sourceTag,
    viewId,
    viewType: bucketForSegment(urlSegment),
    confidence,
  };
}

/**
 * Collapse the raw `ExtractedView[]` (which may contain multiple records per
 * viewId, one per pass that hit it) down to a single seed per `(viewId,
 * urlSegment)` pair, keeping the highest tier. Returns the seeds plus per-tier
 * counts for the log line.
 */
function collapseTypedRecords(
  records: readonly ExtractedView[],
  origin: string,
): { seeds: RouteSeed[]; strictCount: number; inferredCount: number } {
  // Group by viewId so we can choose the strongest segment per id when passes
  // disagree. Within each id, also dedup `(id, segment)` so two strict-tier
  // records of the same segment don't yield two seeds.
  const byViewId = new Map<string, ExtractedView[]>();
  for (const rec of records) {
    const list = byViewId.get(rec.viewId);
    if (list) list.push(rec);
    else byViewId.set(rec.viewId, [rec]);
  }

  const seeds: RouteSeed[] = [];
  let strictCount = 0;
  let inferredCount = 0;
  for (const [, recs] of byViewId) {
    // Pick the strongest tier present for this id, and emit ONE seed at that
    // tier's segment. We deliberately don't fan an id to multiple segments
    // when typed passes disagree — the strongest tier's segment is the truth.
    const best = strongestRecord(recs);
    const seed = makeSeed(
      origin,
      best.viewId,
      best.urlSegment,
      best.confidence,
      `api-hierarchy-traverser:${best.pass}`,
    );
    if (!seed) continue;
    seeds.push(seed);
    if (best.confidence === 'strict') strictCount++;
    else inferredCount++;
  }
  return { seeds, strictCount, inferredCount };
}

/**
 * Fan an unresolved viewId out across every known URL segment. Returns one
 * seed per segment, all tagged `fallback`.
 */
function fanFallbackSeeds(viewId: string, origin: string): RouteSeed[] {
  const out: RouteSeed[] = [];
  for (const segment of fallbackUrlSegments()) {
    const seed = makeSeed(origin, viewId, segment, 'fallback', 'api-hierarchy-traverser:fallback');
    if (seed) out.push(seed);
  }
  return out;
}

// =============================================================================
// Factory
// =============================================================================

async function bootstrapPass(
  ctx: DiscoveryContext,
  verbose: boolean,
): Promise<RouteSeed[]> {
  // Merge in-flight + bootstrap corpus, deduped by path. The bootstrap
  // corpus carries prior captures with real bodies; the in-flight
  // `networkLogPaths` is typically empty at t=0 on a fresh crawl.
  const corpus = Array.from(
    new Set<string>([
      ...(ctx.networkLogPaths ?? []),
      ...(ctx.bootstrapCorpusPaths ?? []),
    ]),
  );
  if (corpus.length === 0) {
    if (verbose) {
      console.log(`${LOG_PREFIX} no network logs provided — yielding 0 seeds`);
    }
    return [];
  }
  console.log(
    `${LOG_PREFIX} corpus: live=${ctx.networkLogPaths?.length ?? 0} bootstrap=${ctx.bootstrapCorpusPaths?.length ?? 0} merged=${corpus.length}`,
  );

  const { views, unresolvedViewIds, stats } = await extractViewsFromNetworkLogs({
    networkLogPaths: corpus,
    verbose,
  });

  const { seeds: typedSeeds, strictCount, inferredCount } = collapseTypedRecords(
    views,
    ctx.origin,
  );

  const fallbackSeeds: RouteSeed[] = [];
  for (const viewId of unresolvedViewIds) {
    for (const seed of fanFallbackSeeds(viewId, ctx.origin)) {
      fallbackSeeds.push(seed);
    }
  }

  // Final dedup by URL. Higher confidence wins; equal-confidence => first-seen.
  const byUrl = new Map<string, RouteSeed>();
  for (const seed of [...typedSeeds, ...fallbackSeeds]) {
    const existing = byUrl.get(seed.url);
    if (!existing) {
      byUrl.set(seed.url, seed);
      continue;
    }
    const existingRank = CONFIDENCE_RANK[(existing.confidence ?? 'strict') as SeedConfidence];
    const candidateRank = CONFIDENCE_RANK[(seed.confidence ?? 'strict') as SeedConfidence];
    if (candidateRank > existingRank) byUrl.set(seed.url, seed);
  }
  const seeds = Array.from(byUrl.values());

  const uniqueViewIds = new Set<string>();
  for (const seed of seeds) {
    if (seed.viewId) uniqueViewIds.add(seed.viewId);
  }

  console.log(
    `${LOG_PREFIX} bootstrap seeds: strict=${strictCount} inferred=${inferredCount} fallback=${fallbackSeeds.length} ` +
      `(unresolved_viewIds=${unresolvedViewIds.length} x segments=${fallbackUrlSegments().length}) ` +
      `total_seeds=${seeds.length} unique_viewIds=${uniqueViewIds.size} ` +
      `extract_stats={lines:${stats.scannedLines},bodies:${stats.bodiesParsed}}`,
  );

  return seeds;
}

async function pagePass(ctx: PageDiscoveryContext): Promise<RouteSeed[]> {
  const page = ctx.page as Page;
  const { seeds, stats } = await expandSidebarTree(page, ctx.origin);
  console.log(
    `${LOG_PREFIX} page-sidebar pass: extracted ${stats.anchorsExtracted} <a href> nodes, ` +
      `${stats.totalCollapsedClicked} aria-expanded nodes flipped ` +
      `(iterations=${stats.iterations}, collapsed_remaining=${stats.finalCollapsedRemaining})`,
  );
  return seeds;
}

export function createHybridRouteDiscoverer(
  options: HybridDiscovererOptions = {},
): RouteDiscoverer {
  const verbose = options.verbose === true;

  const discoverer: RouteDiscoverer = {
    name: 'hybrid-route-discoverer',
    discoverFromBootstrap(ctx) {
      return bootstrapPass(ctx, verbose);
    },
    discoverFromPage(ctx) {
      return pagePass(ctx);
    },
    // Legacy alias — delegates to the bootstrap pass for any caller that
    // hasn't yet migrated to the two-phase interface.
    discover(ctx) {
      return bootstrapPass(ctx, verbose);
    },
  };
  return discoverer;
}
