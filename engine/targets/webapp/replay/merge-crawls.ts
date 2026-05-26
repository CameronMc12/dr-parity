/**
 * Merge the captured traffic + static assets of MULTIPLE crawl directories into
 * one replay corpus. Each of our exhaustive crawls only walks ONE section of the
 * app (home/dashboards, docs, lists, board, task-detail, calendar), so a replay
 * built from a single crawl renders only that section and leaves every other
 * route blank. Unioning the recordings across every crawl gives each route the
 * data it needs to paint.
 *
 * Two things are unioned:
 *   1. Recordings — `buildRecordings` is run per crawl dir (it already streams the
 *      multi-GB network.jsonl and keeps only API/fetch records, dropping static
 *      bodies). The flat recordings are deduped by a deterministic request
 *      fingerprint (method + host-class + path-template + stableQuery +
 *      bodyShapeHash). On a duplicate we KEEP THE RICHEST non-empty body so a
 *      thin/empty/304 sibling never shadows a real payload another crawl caught.
 *   2. Assets — `emitAssetsFromCrawl` is run per crawl dir into the SAME public
 *      dir. The first crawl to write a given URL wins (identical content-hashed
 *      bundles), so later crawls only fill gaps. The unioned URL->served map is
 *      returned so the bootstrap rewriter localizes the superset.
 *
 * Additive + no-regression: a single crawl dir collapses to the existing
 * single-crawl behaviour (one buildRecordings + one emitAssetsFromCrawl pass).
 */

import { buildRecordings } from './build-recordings';
import { hostClass, pathTemplate, stableQuery } from '../../../extract/capture/merge/fingerprint';
import {
  emitAssetsFromCrawl,
  type CrawlAssetResult,
} from '../emit-assets-from-crawl';
import type { ReplayRecording } from './types';

/**
 * Fingerprint a flat ReplayRecording the same way `fingerprint.ts` folds a Flow:
 * method + host-class + path-template + stableQuery + body-shape. The recording's
 * `pathPattern` already has id segments wildcarded by emit-mocks, and its
 * `requestBodyKey` is the stable-stringified body — we hash its SHAPE (sorted
 * key set), not its values, so two structurally-identical writes collapse.
 */
function recordingFingerprint(rec: ReplayRecording): string {
  let host = '';
  let pathname = rec.pathPattern || '/';
  let search = new URLSearchParams();
  try {
    const u = new URL(rec.pathPattern, rec.origin || 'http://x');
    host = new URL(rec.origin || 'http://x').host;
    pathname = u.pathname;
    search = u.searchParams;
  } catch {
    try {
      host = new URL(rec.origin).host;
    } catch {
      host = '';
    }
  }
  const hc = hostClass(host);
  const { template } = pathTemplate(pathname);
  const sq = stableQuery(search);
  const bsh = bodyShapeOf(rec.requestBodyKey);
  const keyParts = `${rec.method.toUpperCase()} ${hc}${template}${sq ? `?${sq}` : ''} #${bsh}`;
  // matchKey (bridge per-list routing) must keep recordings distinct so a per-list
  // recording is never collapsed into another list's. Plain recordings carry no key.
  return rec.matchKey ? `${keyParts} @${rec.matchKey}` : keyParts;
}

/** Hash the SHAPE (sorted keys + value kinds) of a stable-stringified body key. */
function bodyShapeOf(requestBodyKey: string): string {
  if (!requestBodyKey) return 'none';
  let parsed: unknown;
  try {
    parsed = JSON.parse(requestBodyKey);
  } catch {
    return `text:${requestBodyKey.length}`;
  }
  return `json:${shapeOf(parsed)}`;
}

function shapeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length === 0 ? '[]' : `[${shapeOf(value[0])}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${k}:${shapeOf(obj[k])}`).join(',')}}`;
  }
  return typeof value;
}

/** A body is "rich" when it carries real payload, not an empty/degenerate stub. */
function bodyRichness(body: string): number {
  const b = (body ?? '').trim();
  if (b === '' || b === '{}' || b === '[]' || b === 'null') return 0;
  return b.length;
}

/**
 * Prefer the richer of two recordings sharing a fingerprint. A non-empty body
 * beats an empty one; among two non-empty bodies the larger payload wins; a 2xx
 * status beats a non-2xx when bodies tie.
 */
function pickRicher(a: ReplayRecording, b: ReplayRecording): ReplayRecording {
  const ra = bodyRichness(a.body);
  const rb = bodyRichness(b.body);
  if (ra !== rb) return ra > rb ? a : b;
  const aOk = a.status >= 200 && a.status < 300;
  const bOk = b.status >= 200 && b.status < 300;
  if (aOk !== bOk) return aOk ? a : b;
  return a;
}

export type MergedRecordingsResult = {
  recordings: ReplayRecording[];
  warnings: string[];
  /** Per-crawl recording counts before dedup, for reporting. */
  perCrawlCounts: { crawlDir: string; count: number }[];
  /** Total recordings across all crawls before dedup. */
  totalBeforeDedup: number;
  /** Total response-body bytes in the deduped corpus. */
  bodyBytes: number;
};

/**
 * Union recordings across every crawl dir, deduping by request fingerprint and
 * keeping the richest body on collision. Crawl dirs are processed in order; the
 * FIRST richest body to be seen for a fingerprint is kept and only replaced by a
 * strictly richer one.
 */
export async function mergeRecordings(
  crawlDirs: string[],
): Promise<MergedRecordingsResult> {
  const warnings: string[] = [];
  const perCrawlCounts: { crawlDir: string; count: number }[] = [];
  const byKey = new Map<string, ReplayRecording>();
  let totalBeforeDedup = 0;

  for (const crawlDir of crawlDirs) {
    const { recordings, warnings: w } = await buildRecordings(crawlDir);
    warnings.push(...w.map((m) => `[${crawlDir}] ${m}`));
    perCrawlCounts.push({ crawlDir, count: recordings.length });
    totalBeforeDedup += recordings.length;

    for (const rec of recordings) {
      const key = recordingFingerprint(rec);
      const existing = byKey.get(key);
      byKey.set(key, existing ? pickRicher(existing, rec) : rec);
    }
  }

  const merged = Array.from(byKey.values());
  let bodyBytes = 0;
  for (const r of merged) bodyBytes += Buffer.byteLength(r.body ?? '', 'utf8');

  return {
    recordings: merged,
    warnings,
    perCrawlCounts,
    totalBeforeDedup,
    bodyBytes,
  };
}

export type MergedAssetsResult = {
  /** The combined crawl asset result (URL->served map, basename index). */
  combined: CrawlAssetResult;
  warnings: string[];
  /** Total asset files written across all crawls (first-writer wins). */
  written: number;
};

/**
 * Union static assets across every crawl dir into one public dir. Each crawl is
 * emitted with the running set of already-written URLs passed as `existingUrls`
 * so a URL another crawl already localized is skipped (identical content-hashed
 * bundles). The combined servedPaths/byBasename maps are the superset used to
 * rewrite the bootstrap.
 */
export async function mergeAssets(args: {
  crawlDirs: string[];
  publicDir: string;
}): Promise<MergedAssetsResult> {
  const { crawlDirs, publicDir } = args;
  const warnings: string[] = [];
  const servedPaths = new Map<string, string>();
  const byBasename = new Map<string, string>();
  const seenUrls = new Set<string>();
  let written = 0;
  let outRoot = '';

  for (const crawlDir of crawlDirs) {
    const result = await emitAssetsFromCrawl({
      crawlDir,
      publicDir,
      existingUrls: seenUrls,
    });
    written += result.written;
    outRoot = result.outRoot;
    for (const [url, served] of result.servedPaths) {
      if (!servedPaths.has(url)) servedPaths.set(url, served);
      seenUrls.add(url);
    }
    for (const [base, served] of result.byBasename) {
      if (!byBasename.has(base)) byBasename.set(base, served);
    }
  }

  const combined: CrawlAssetResult = {
    servedPaths,
    byBasename,
    written,
    truncatedSkipped: 0,
    noBodySkipped: 0,
    outRoot,
  };
  return { combined, warnings, written };
}
