/**
 * Crawl-completeness analyzer.
 *
 * Given a crawl directory (graph.json + states/ + network.jsonl + summary.json +
 * errors.jsonl), it answers two questions:
 *
 *   1. Did the crawl SATURATE? It reconstructs the new-state discovery curve over
 *      crawl order (distinct canonical states discovered vs interactions
 *      performed). If the discovery rate over the last N interactions is below a
 *      threshold the crawl is "good enough"; otherwise it is "under-crawled".
 *   2. WHERE is capture incomplete? It builds a ranked gap report of
 *      discovered-but-uncaptured targets, referenced-but-uncaptured routes,
 *      errored/empty states, and unfollowed popups/new-tabs.
 *
 * Robustness: every newer field (canonicalKey, ariaPath, sourceKind, blocked
 * reasons, popup edges) is read DEFENSIVELY with fallbacks, so older graphs that
 * predate those fields still produce a sensible report. network.jsonl is read
 * with a streaming readline pass because it can be multi-GB.
 */

import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

/** Default window (interactions) used to judge saturation. */
export const SATURATION_WINDOW = 8;
/** Discovery rate at/below this over the window means "saturated". */
export const SATURATION_RATE_THRESHOLD = 0.15;

export type GapKind =
  | 'uncaptured-target'
  | 'referenced-route'
  | 'errored-state'
  | 'empty-state'
  | 'unfollowed-popup';

export type CrawlGap = {
  kind: GapKind;
  /** Human label for the gap (selector label, url, route, etc.). */
  label: string;
  /** Best-effort locator: selector, url, or state id. */
  locator: string;
  /** Why this is a gap (blocked, errored, dead-end, never-visited, ...). */
  reason: string;
  /** Higher = more likely important. Used to rank the report. */
  importance: number;
  /** Optional origin state id this gap was discovered from. */
  fromStateId?: string;
};

export type DiscoveryPoint = {
  /** 1-based interaction index in crawl order. */
  interaction: number;
  /** Cumulative distinct canonical states discovered up to this interaction. */
  distinctStates: number;
  /** 1 if this interaction discovered a new canonical state, else 0. */
  discoveredNew: number;
};

export type CompletenessReport = {
  crawlDir: string;
  /** Distinct routes (by normalized path) captured. */
  distinctRoutes: number;
  /** Distinct canonical states captured. */
  distinctStates: number;
  /** Total captured state nodes (pre-dedup). */
  totalStates: number;
  /** Total interactions performed (graph edges). */
  totalInteractions: number;
  /** distinctStates / totalStates. 1 = no duplicates captured. */
  dedupRatio: number;
  /** New-state discovery curve over crawl order. */
  discoveryCurve: DiscoveryPoint[];
  /** Discovery rate over the final SATURATION_WINDOW interactions. */
  recentDiscoveryRate: number;
  /** true => crawl saturated ("good enough"); false => "under-crawled". */
  saturated: boolean;
  /** Plain-English verdict. */
  verdict: string;
  /** Ranked gaps, most important first. */
  gaps: CrawlGap[];
  /** Counts per gap kind for a quick summary. */
  gapCounts: Record<GapKind, number>;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Defensive graph + state shapes (every new field is optional).
// ---------------------------------------------------------------------------

type GraphNode = {
  id?: string;
  url?: string;
  title?: string;
  domHash?: string;
  /** Newer field: canonical dedup key. Falls back to domHash, then url. */
  canonicalKey?: string;
  depth?: number;
  /** Newer fields some crawlers attach to nodes. */
  error?: string;
  empty?: boolean;
  bodyLength?: number;
};

type GraphInteraction = {
  kind?: string;
  selector?: string;
  selectorLabel?: string;
  elementTag?: string;
  opensOverlay?: boolean;
  /** Newer fields, read defensively. */
  ariaPath?: string;
  sourceKind?: string;
  opensPopup?: boolean;
  href?: string;
};

type GraphEdge = {
  fromStateId?: string;
  toStateId?: string;
  interaction?: GraphInteraction;
  capturedAt?: string;
};

/** Newer crawlers may list discovered-but-unvisited targets and links. */
type DiscoveredTarget = {
  selector?: string;
  selectorLabel?: string;
  label?: string;
  ariaPath?: string;
  sourceKind?: string;
  elementTag?: string;
  href?: string;
  url?: string;
  fromStateId?: string;
  reason?: string;
  status?: string;
};

type Graph = {
  startUrl?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  /** Newer optional fields holding incomplete-capture hints. */
  discovered?: DiscoveredTarget[];
  pending?: DiscoveredTarget[];
  deadEnds?: DiscoveredTarget[];
  popups?: DiscoveredTarget[];
  links?: DiscoveredTarget[];
  blocked?: DiscoveredTarget[];
};

type ErrorEntry = {
  stateId?: string;
  url?: string;
  selector?: string;
  selectorLabel?: string;
  message?: string;
  reason?: string;
  kind?: string;
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/** Canonical dedup key for a node, newest field first, with safe fallbacks. */
function canonicalKeyOf(node: GraphNode): string {
  if (node.canonicalKey) return node.canonicalKey;
  if (node.domHash) return node.domHash;
  if (node.url) return node.url;
  if (node.id) return node.id;
  return '';
}

/** Normalize a url to a route path (drop query + hash), defensively. */
function routeOf(url: string | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    const q = url.indexOf('?');
    const h = url.indexOf('#');
    let end = url.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    return url.slice(0, end);
  }
}

/**
 * Stream network.jsonl to collect the set of URLs that were actually requested
 * (so we can tell whether a referenced link/route was ever fetched), plus the
 * set of html responses with empty bodies (boot pages that returned nothing).
 * Streaming because this file is routinely multi-GB.
 */
async function scanNetwork(crawlDir: string): Promise<{
  requestedRoutes: Set<string>;
  emptyHtmlUrls: Set<string>;
  warnings: string[];
}> {
  const path = join(crawlDir, 'network.jsonl');
  const requestedRoutes = new Set<string>();
  const emptyHtmlUrls = new Set<string>();
  const warnings: string[] = [];
  if (!existsSync(path)) {
    warnings.push('network.jsonl not found; route-fetch checks skipped');
    return { requestedRoutes, emptyHtmlUrls, warnings };
  }

  let parseFailures = 0;
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: {
      kind?: string;
      url?: string;
      status?: number;
      headers?: Record<string, string>;
      body?: string | null;
      resourceType?: string;
    };
    try {
      rec = JSON.parse(trimmed);
    } catch {
      parseFailures++;
      continue;
    }
    if (rec.kind === 'request' && rec.url) {
      requestedRoutes.add(routeOf(rec.url));
    } else if (rec.kind === 'response' && rec.url) {
      const ct = contentType(rec.headers);
      const isHtml = ct.includes('text/html') || rec.resourceType === 'document';
      if (isHtml && (rec.body == null || rec.body.length === 0)) {
        emptyHtmlUrls.add(rec.url);
      }
    }
  }

  if (parseFailures > 0) {
    warnings.push(`Skipped ${parseFailures} unparseable network.jsonl lines`);
  }
  return { requestedRoutes, emptyHtmlUrls, warnings };
}

function contentType(headers: Record<string, string> | undefined): string {
  if (!headers) return '';
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') return (v ?? '').toLowerCase();
  }
  return '';
}

// ---------------------------------------------------------------------------
// Discovery curve + saturation
// ---------------------------------------------------------------------------

function buildDiscoveryCurve(
  edges: GraphEdge[],
  nodeKeyById: Map<string, string>,
): DiscoveryPoint[] {
  const ordered = [...edges].sort((a, b) =>
    (a.capturedAt ?? '').localeCompare(b.capturedAt ?? ''),
  );
  const seen = new Set<string>();
  const curve: DiscoveryPoint[] = [];

  let i = 0;
  for (const edge of ordered) {
    i += 1;
    const toId = edge.toStateId ?? '';
    const key = nodeKeyById.get(toId) ?? toId;
    let discoveredNew = 0;
    if (key && !seen.has(key)) {
      seen.add(key);
      discoveredNew = 1;
    }
    curve.push({ interaction: i, distinctStates: seen.size, discoveredNew });
  }
  return curve;
}

function recentRate(curve: DiscoveryPoint[], window: number): number {
  if (curve.length === 0) return 0;
  const slice = curve.slice(-Math.min(window, curve.length));
  const news = slice.reduce((s, p) => s + p.discoveredNew, 0);
  return news / slice.length;
}

// ---------------------------------------------------------------------------
// Gap ranking
// ---------------------------------------------------------------------------

/** Heuristic importance score for a discovered interactive target. */
function targetImportance(t: DiscoveredTarget): number {
  const hay = `${t.sourceKind ?? ''} ${t.ariaPath ?? ''} ${t.selector ?? ''} ${
    t.label ?? t.selectorLabel ?? ''
  } ${t.elementTag ?? ''}`.toLowerCase();
  let score = 40;
  if (/\b(nav|sidebar|menu|side-?bar|primary)\b/.test(hay)) score += 40;
  if (/\b(header|toolbar|topbar)\b/.test(hay)) score += 25;
  if (t.elementTag === 'a' || t.href || t.url) score += 15;
  if (t.sourceKind === 'nav' || t.sourceKind === 'sidebar') score += 20;
  if (/\b(footer|tooltip|popover)\b/.test(hay)) score -= 15;
  return score;
}

function labelOf(t: DiscoveredTarget): string {
  return (
    t.label ??
    t.selectorLabel ??
    t.href ??
    t.url ??
    t.ariaPath ??
    t.selector ??
    '(unlabeled)'
  );
}

function locatorOf(t: DiscoveredTarget): string {
  return t.selector ?? t.ariaPath ?? t.href ?? t.url ?? '';
}

function collectTargetGaps(graph: Graph): CrawlGap[] {
  const gaps: CrawlGap[] = [];
  const buckets: { list: DiscoveredTarget[] | undefined; reason: string }[] = [
    { list: graph.deadEnds, reason: 'dead-end (no resulting state captured)' },
    { list: graph.blocked, reason: 'blocked by blocklist' },
    { list: graph.pending, reason: 'discovered but never visited' },
    { list: graph.discovered, reason: 'discovered but never visited' },
  ];
  for (const bucket of buckets) {
    for (const t of bucket.list ?? []) {
      gaps.push({
        kind: 'uncaptured-target',
        label: labelOf(t),
        locator: locatorOf(t),
        reason: t.reason ?? bucket.reason,
        importance: targetImportance(t),
        ...(t.fromStateId ? { fromStateId: t.fromStateId } : {}),
      });
    }
  }
  return gaps;
}

function collectPopupGaps(graph: Graph): CrawlGap[] {
  const gaps: CrawlGap[] = [];
  for (const p of graph.popups ?? []) {
    gaps.push({
      kind: 'unfollowed-popup',
      label: labelOf(p),
      locator: locatorOf(p),
      reason: p.reason ?? 'popup / new tab opened but not followed',
      importance: targetImportance(p) + 10,
      ...(p.fromStateId ? { fromStateId: p.fromStateId } : {}),
    });
  }
  // Also infer from edges flagged opensPopup whose target was never captured.
  const capturedTo = new Set((graph.edges ?? []).map((e) => e.toStateId ?? ''));
  for (const e of graph.edges ?? []) {
    const ix = e.interaction;
    if (ix?.opensPopup && (!e.toStateId || !capturedTo.has(e.toStateId))) {
      gaps.push({
        kind: 'unfollowed-popup',
        label: ix.selectorLabel ?? ix.selector ?? '(popup)',
        locator: ix.selector ?? '',
        reason: 'edge opened a popup that was not captured',
        importance: targetImportance({ ...ix, label: ix.selectorLabel }) + 10,
        ...(e.fromStateId ? { fromStateId: e.fromStateId } : {}),
      });
    }
  }
  return gaps;
}

function collectRouteGaps(
  graph: Graph,
  capturedRoutes: Set<string>,
  requestedRoutes: Set<string>,
): CrawlGap[] {
  const gaps: CrawlGap[] = [];
  const referenced = new Map<string, DiscoveredTarget>();

  for (const l of graph.links ?? []) {
    const url = l.href ?? l.url;
    if (!url) continue;
    referenced.set(routeOf(url), l);
  }
  // Edge hrefs are another source of referenced routes.
  for (const e of graph.edges ?? []) {
    const href = e.interaction?.href;
    if (href) referenced.set(routeOf(href), { href });
  }

  for (const [route, src] of referenced) {
    if (!route) continue;
    if (capturedRoutes.has(route)) continue;
    const everRequested = requestedRoutes.has(route);
    gaps.push({
      kind: 'referenced-route',
      label: src.label ?? src.selectorLabel ?? route,
      locator: route,
      reason: everRequested
        ? 'referenced + fetched but no state captured'
        : 'referenced by a link but never captured',
      importance: 55 + (everRequested ? 10 : 0),
    });
  }
  return gaps;
}

function collectStateGaps(
  nodes: GraphNode[],
  errors: ErrorEntry[],
  emptyHtmlUrls: Set<string>,
): CrawlGap[] {
  const gaps: CrawlGap[] = [];

  for (const n of nodes) {
    if (n.error) {
      gaps.push({
        kind: 'errored-state',
        label: n.title ?? n.url ?? n.id ?? '(state)',
        locator: n.id ?? n.url ?? '',
        reason: `state error: ${n.error}`,
        importance: 60,
      });
    }
    const isEmpty =
      n.empty === true ||
      (typeof n.bodyLength === 'number' && n.bodyLength === 0) ||
      (n.url ? emptyHtmlUrls.has(n.url) : false);
    if (isEmpty) {
      gaps.push({
        kind: 'empty-state',
        label: n.title ?? n.url ?? n.id ?? '(state)',
        locator: n.id ?? n.url ?? '',
        reason: 'captured state had an empty body',
        importance: 50,
      });
    }
  }

  for (const e of errors) {
    gaps.push({
      kind: 'errored-state',
      label: e.selectorLabel ?? e.url ?? e.stateId ?? '(error)',
      locator: e.selector ?? e.stateId ?? e.url ?? '',
      reason: e.message ?? e.reason ?? e.kind ?? 'errored interaction',
      importance: 58,
      ...(e.stateId ? { fromStateId: e.stateId } : {}),
    });
  }
  return gaps;
}

function dedupeGaps(gaps: CrawlGap[]): CrawlGap[] {
  const seen = new Set<string>();
  const out: CrawlGap[] = [];
  for (const g of gaps) {
    const key = `${g.kind}|${g.locator}|${g.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

function countGaps(gaps: CrawlGap[]): Record<GapKind, number> {
  const counts: Record<GapKind, number> = {
    'uncaptured-target': 0,
    'referenced-route': 0,
    'errored-state': 0,
    'empty-state': 0,
    'unfollowed-popup': 0,
  };
  for (const g of gaps) counts[g.kind] += 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function analyzeCrawl(crawlDir: string): Promise<CompletenessReport> {
  const warnings: string[] = [];
  const graph = readJson<Graph>(join(crawlDir, 'graph.json')) ?? {};
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  if (nodes.length === 0) warnings.push('graph.json has no nodes');

  const nodeKeyById = new Map<string, string>();
  const canonicalKeys = new Set<string>();
  const routes = new Set<string>();
  for (const n of nodes) {
    if (n.id) nodeKeyById.set(n.id, canonicalKeyOf(n));
    const key = canonicalKeyOf(n);
    if (key) canonicalKeys.add(key);
    const route = routeOf(n.url);
    if (route) routes.add(route);
  }

  const totalStates = nodes.length;
  const distinctStates = canonicalKeys.size || totalStates;
  const totalInteractions = edges.length;
  const dedupRatio = totalStates > 0 ? distinctStates / totalStates : 1;

  const discoveryCurve = buildDiscoveryCurve(edges, nodeKeyById);
  const recentDiscoveryRate = recentRate(discoveryCurve, SATURATION_WINDOW);
  // Saturated only once enough interactions exist to judge the tail.
  const enoughSignal = totalInteractions >= SATURATION_WINDOW;
  const saturated = enoughSignal && recentDiscoveryRate <= SATURATION_RATE_THRESHOLD;
  const verdict = enoughSignal
    ? saturated
      ? `Saturated: discovery rate ${(recentDiscoveryRate * 100).toFixed(0)}% over the last ` +
        `${SATURATION_WINDOW} interactions is below ${(SATURATION_RATE_THRESHOLD * 100).toFixed(0)}%. Capture is good enough.`
      : `Under-crawled: discovery rate ${(recentDiscoveryRate * 100).toFixed(0)}% over the last ` +
        `${SATURATION_WINDOW} interactions is still climbing. Increase the crawl budget.`
    : `Inconclusive: only ${totalInteractions} interactions (< ${SATURATION_WINDOW}). Crawl longer before judging saturation.`;

  const { requestedRoutes, emptyHtmlUrls, warnings: netWarnings } =
    await scanNetwork(crawlDir);
  warnings.push(...netWarnings);

  const errors = readJsonl<ErrorEntry>(join(crawlDir, 'errors.jsonl'));

  const gaps = dedupeGaps([
    ...collectTargetGaps(graph),
    ...collectPopupGaps(graph),
    ...collectRouteGaps(graph, routes, requestedRoutes),
    ...collectStateGaps(nodes, errors, emptyHtmlUrls),
  ]).sort((a, b) => b.importance - a.importance);

  return {
    crawlDir,
    distinctRoutes: routes.size,
    distinctStates,
    totalStates,
    totalInteractions,
    dedupRatio,
    discoveryCurve,
    recentDiscoveryRate,
    saturated,
    verdict,
    gaps,
    gapCounts: countGaps(gaps),
    warnings,
  };
}
