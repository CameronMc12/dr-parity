/**
 * Load the per-URL asset index for a crawl directory.
 *
 * Preferred source: `<crawlDir>/assets.jsonl` produced by the crawler.
 * Fallback: parse `network.json` (or `*.network` jsonl shards) inside
 * `trace.zip` and synthesise AssetRecord[] from successful 200 responses
 * with stylesheet/font/image content types.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readTraceEntries } from './extract-from-trace';
import type { AssetRecord, AssetResourceType } from './types';

const RESOURCE_TYPE_VALUES = new Set<AssetResourceType>([
  'stylesheet',
  'font',
  'image',
  'other',
]);

function classifyContentType(contentType: string): AssetResourceType {
  const ct = (contentType || '').toLowerCase().split(';')[0].trim();
  if (ct === 'text/css') return 'stylesheet';
  if (ct.startsWith('image/')) return 'image';
  if (
    ct.startsWith('font/') ||
    ct === 'application/font-woff' ||
    ct === 'application/font-woff2' ||
    ct === 'application/x-font-ttf' ||
    ct === 'application/x-font-otf' ||
    ct === 'application/vnd.ms-fontobject'
  ) {
    return 'font';
  }
  return 'other';
}

function classifyResourceType(raw: string, contentType: string): AssetResourceType {
  const lower = (raw || '').toLowerCase();
  if (lower === 'stylesheet' || lower === 'font' || lower === 'image') {
    return lower;
  }
  return classifyContentType(contentType);
}

function readJsonl(filePath: string): unknown[] {
  const raw = readFileSync(filePath, 'utf8');
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      /* swallow malformed lines */
    }
  }
  return out;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function pickResourceType(value: unknown, contentType: string): AssetResourceType {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (RESOURCE_TYPE_VALUES.has(lower as AssetResourceType)) {
      return lower as AssetResourceType;
    }
    return classifyResourceType(lower, contentType);
  }
  return classifyContentType(contentType);
}

function recordFromAssetsJsonl(entry: Record<string, unknown>): AssetRecord | null {
  const url = asString(entry.url);
  if (!url) return null;
  const contentType = asString(entry.contentType ?? entry.mimeType);
  const resourceType = pickResourceType(entry.resourceType, contentType);
  const size = asNumber(entry.size);
  const sha1Raw = entry.sha1 ?? entry._sha1;
  const sha1 = typeof sha1Raw === 'string' && sha1Raw.length > 0 ? sha1Raw : undefined;
  const bodyRaw = entry.body;
  const body = typeof bodyRaw === 'string' ? bodyRaw : undefined;
  const encodingRaw = asString(entry.bodyEncoding).toLowerCase();
  const bodyEncoding =
    encodingRaw === 'base64' ? 'base64' : encodingRaw === 'utf8' ? 'utf8' : undefined;

  return {
    url,
    resourceType,
    contentType,
    size,
    sha1,
    body,
    bodyEncoding,
  };
}

function isAssetContentType(contentType: string): boolean {
  const cls = classifyContentType(contentType);
  return cls !== 'other';
}

/**
 * Walk a Playwright network entry (from network.json or a *.network jsonl
 * shard) and synthesise an AssetRecord when it looks like a successful
 * static-asset response.
 *
 * Playwright's exact schema varies by version, so we probe several common
 * shapes defensively. We only accept 200 OK responses whose content type
 * looks like CSS / font / image, since other endpoints are handled by the
 * mocks pipeline.
 */
function recordFromTraceEvent(event: unknown): AssetRecord | null {
  if (!event || typeof event !== 'object') return null;
  const obj = event as Record<string, unknown>;

  // Some shards wrap entries as { type: 'resource-snapshot', snapshot: {...} };
  // others put the response directly on `response`.
  const candidate =
    (obj.snapshot as Record<string, unknown> | undefined) ??
    (obj.entry as Record<string, unknown> | undefined) ??
    obj;

  const request = candidate.request as Record<string, unknown> | undefined;
  const response = candidate.response as Record<string, unknown> | undefined;
  if (!request || !response) return null;

  const status = asNumber(response.status ?? response.statusCode);
  if (status !== 200) return null;

  const url = asString(request.url);
  if (!url) return null;

  const headers = (response.headers ?? {}) as Record<string, unknown>;
  const contentType =
    asString(headers['content-type']) ||
    asString(headers['Content-Type']) ||
    asString(response.contentType) ||
    asString((response.content as Record<string, unknown> | undefined)?.mimeType);

  if (!isAssetContentType(contentType)) return null;

  const resourceTypeRaw =
    asString(candidate._resourceType) ||
    asString(request.resourceType) ||
    asString(candidate.resourceType);

  const content = (response.content as Record<string, unknown> | undefined) ?? {};
  const sha1Raw =
    asString(content._sha1) ||
    asString(content.sha1) ||
    asString(response._sha1) ||
    asString(candidate._sha1);

  const size = asNumber(content.size ?? response.bodySize ?? response.size);

  return {
    url,
    resourceType: classifyResourceType(resourceTypeRaw, contentType),
    contentType,
    size,
    sha1: sha1Raw || undefined,
  };
}

async function loadFromTrace(crawlDir: string): Promise<AssetRecord[]> {
  // Playwright variants: `network.json` (single JSON, sometimes an object with
  // an entries array, sometimes a top-level array) and `*.network` jsonl shards.
  const entries = await readTraceEntries(crawlDir, (name) => {
    if (name === 'network.json' || name.endsWith('/network.json')) return true;
    if (name.endsWith('.network')) return true;
    return false;
  });

  if (entries.length === 0) return [];

  const records: AssetRecord[] = [];
  const seen = new Set<string>();

  const pushUnique = (rec: AssetRecord | null) => {
    if (!rec) return;
    const key = `${rec.url}|${rec.sha1 ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push(rec);
  };

  for (const { fileName, body } of entries) {
    const text = body.toString('utf8');
    if (fileName.endsWith('.network')) {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          pushUnique(recordFromTraceEvent(JSON.parse(trimmed)));
        } catch {
          /* skip */
        }
      }
      continue;
    }

    // network.json — single JSON document, shape varies.
    try {
      const parsed = JSON.parse(text);
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).entries)
          ? ((parsed as Record<string, unknown>).entries as unknown[])
          : [];
      for (const item of list) pushUnique(recordFromTraceEvent(item));
    } catch {
      /* skip malformed network.json */
    }
  }

  return records;
}

export async function loadAssetsIndex(crawlDir: string): Promise<AssetRecord[]> {
  const jsonlPath = join(crawlDir, 'assets.jsonl');
  if (existsSync(jsonlPath)) {
    const rows = readJsonl(jsonlPath);
    const out: AssetRecord[] = [];
    for (const row of rows) {
      if (row && typeof row === 'object') {
        const rec = recordFromAssetsJsonl(row as Record<string, unknown>);
        if (rec) out.push(rec);
      }
    }
    return out;
  }

  const tracePath = join(crawlDir, 'trace.zip');
  if (!existsSync(tracePath)) return [];

  return loadFromTrace(crawlDir);
}
