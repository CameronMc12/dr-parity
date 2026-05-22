/**
 * Asset emit pipeline entry point.
 *
 * Reads a crawl directory's asset index (assets.jsonl when present, falling
 * back to trace.zip), filters to first-party URLs, and mirrors each asset
 * into `<outDir>/public/<url-path>` so the generated webapp serves CSS,
 * fonts, and images from the same paths the captured site used.
 *
 * Body source preference per record:
 *   1. inline `body` on the AssetRecord (uncommon)
 *   2. `resources/<sha1>` inside a Playwright `trace.zip` (when present)
 *   3. live HTTP fetch of the original URL (fallback — the current crawler
 *      records URL + size only)
 *
 * The returned summary exposes `cssHrefs` so the build can re-link
 * stylesheets in the emitted `index.html`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { extractAssetFromTrace } from './extract-from-trace';
import { loadAssetsIndex } from './load-assets-index';
import { isFirstPartyUrl, urlToPublicPath } from './url-to-public-path';
import type {
  AssetEmitSummary,
  AssetRecord,
  AssetResourceType,
  EmitAssetsOptions,
} from './types';

export type {
  AssetEmitSummary,
  AssetRecord,
  AssetResourceType,
  EmitAssetsOptions,
} from './types';
export { urlToPublicPath, isFirstPartyUrl } from './url-to-public-path';
export { extractAssetFromTrace, closeTrace, readTraceEntries } from './extract-from-trace';
export { loadAssetsIndex } from './load-assets-index';

function inferOriginHosts(crawlDir: string): string[] {
  // Crawler convention: <root>/<host>/<viewport>/... Try the parent dir name.
  const parent = basename(dirname(resolve(crawlDir)));
  if (!parent) return [];
  // Bail if the parent looks like a path artifact rather than a host name.
  if (parent === '.' || parent === '..' || parent === '/' || parent === '') return [];
  if (parent.includes('.')) return [parent];
  return [];
}

function decodeInlineBody(record: AssetRecord): Buffer | null {
  if (typeof record.body !== 'string') return null;
  const encoding = record.bodyEncoding ?? 'utf8';
  try {
    return Buffer.from(record.body, encoding);
  } catch {
    return null;
  }
}

async function fetchAssetBody(url: string, timeoutMs = 15_000): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function safeJoinPublic(publicDir: string, publicPath: string): string | null {
  const target = resolve(join(publicDir, publicPath));
  const root = resolve(publicDir);
  if (target !== root && !target.startsWith(root + '/')) return null;
  return target;
}

function bumpStats(summary: AssetEmitSummary, type: AssetResourceType, bytes: number): void {
  summary.copiedCount += 1;
  summary.totalBytes += bytes;
  if (type === 'stylesheet') summary.cssCount += 1;
  else if (type === 'font') summary.fontCount += 1;
  else if (type === 'image') summary.imageCount += 1;
}

export async function emitAssets(
  crawlDir: string,
  outDir: string,
  options: EmitAssetsOptions = {},
): Promise<AssetEmitSummary> {
  const summary: AssetEmitSummary = {
    copiedCount: 0,
    cssCount: 0,
    fontCount: 0,
    imageCount: 0,
    totalBytes: 0,
    cssHrefs: [],
    warnings: [],
  };

  let records: AssetRecord[];
  try {
    records = await loadAssetsIndex(crawlDir);
  } catch (err) {
    summary.warnings.push(
      `Failed to load asset index: ${err instanceof Error ? err.message : String(err)}`,
    );
    return summary;
  }

  if (records.length === 0) {
    summary.warnings.push('No asset records found (assets.jsonl missing and trace.zip empty).');
    return summary;
  }

  const originHosts = options.originHosts && options.originHosts.length > 0
    ? options.originHosts
    : inferOriginHosts(crawlDir);

  const publicDir = join(outDir, 'public');
  mkdirSync(publicDir, { recursive: true });

  const writtenPaths = new Set<string>();
  const traceAvailable = existsSync(join(crawlDir, 'trace.zip'));
  const allowFetch = options.fetchMissingBodies !== false;

  for (const record of records) {
    if (originHosts.length > 0 && !isFirstPartyUrl(record.url, originHosts)) continue;

    const publicPath = urlToPublicPath(
      record.url,
      originHosts.length === 1 ? originHosts[0] : undefined,
    );
    if (!publicPath) continue;
    if (writtenPaths.has(publicPath)) continue;

    const target = safeJoinPublic(publicDir, publicPath);
    if (!target) {
      summary.warnings.push(`Refusing to write outside public/: ${publicPath}`);
      continue;
    }

    let bytes: Buffer | null = decodeInlineBody(record);
    if (!bytes && record.sha1 && traceAvailable) {
      try {
        bytes = await extractAssetFromTrace(crawlDir, record.sha1);
      } catch (err) {
        summary.warnings.push(
          `Trace extract failed for ${record.url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (!bytes && allowFetch) {
      bytes = await fetchAssetBody(record.url);
    }
    if (!bytes) {
      summary.warnings.push(`No body available for ${record.url}.`);
      continue;
    }

    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    } catch (err) {
      summary.warnings.push(
        `Failed to write ${publicPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    writtenPaths.add(publicPath);
    bumpStats(summary, record.resourceType, bytes.byteLength);

    if (record.resourceType === 'stylesheet') {
      summary.cssHrefs.push(publicPath);
    }
  }

  return summary;
}
