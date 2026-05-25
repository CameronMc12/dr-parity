/**
 * Reads `network.jsonl` from a crawl directory and pairs request/response
 * entries (they are written as separate lines by the crawler) into a
 * normalized `RequestRecord`. Also reads `forms.jsonl` if present.
 *
 * Filtering: keeps only fetch/xhr resource types since static assets are
 * already served from the scaffold's public/ directory.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RequestRecord } from './types';
import { isStaticAssetRequest } from './static-asset';

type RawRequestLine = {
  kind: 'request';
  capturedAt: string;
  method: string;
  url: string;
  resourceType?: string;
  headers?: Record<string, string>;
  postData?: string | null;
};

type RawResponseLine = {
  kind: 'response';
  capturedAt: string;
  status: number;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
  bodySize?: number | null;
};

type RawFormLine = {
  formName: string;
  scenarioName: string;
  request: {
    method: string;
    url: string;
    postData?: string | null;
  };
  response: {
    status: number;
    body?: string | null;
    headers?: Record<string, string>;
  };
  capturedAt: string;
};

const FETCH_LIKE = new Set(['fetch', 'xhr']);

function readLines(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function parseLine<T>(line: string, warnings: string[]): T | null {
  try {
    return JSON.parse(line) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Skipped malformed jsonl line: ${msg}`);
    return null;
  }
}

function pairRequestsAndResponses(
  lines: (RawRequestLine | RawResponseLine)[],
  warnings: string[],
): RequestRecord[] {
  // For each url+method we maintain a queue of pending requests; the first
  // matching response consumes the head of the queue. This matches Playwright's
  // event ordering for non-redirected traffic.
  const pending = new Map<string, RawRequestLine[]>();
  const records: RequestRecord[] = [];
  let staticDropped = 0;

  const keyOf = (method: string, url: string): string => `${method.toUpperCase()} ${url}`;

  for (const line of lines) {
    if (line.kind === 'request') {
      const resourceType = (line.resourceType ?? '').toLowerCase();
      if (resourceType && !FETCH_LIKE.has(resourceType)) continue;
      const key = keyOf(line.method, line.url);
      const list = pending.get(key) ?? [];
      list.push(line);
      pending.set(key, list);
      continue;
    }

    // response
    // We don't have method on the response line; try both common verbs.
    const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    let req: RawRequestLine | undefined;
    let matchedKey: string | undefined;
    for (const verb of verbs) {
      const key = keyOf(verb, line.url);
      const list = pending.get(key);
      if (list && list.length > 0) {
        req = list.shift();
        if (list.length === 0) pending.delete(key);
        else pending.set(key, list);
        matchedKey = key;
        break;
      }
    }
    if (!req) {
      // Response without a matching captured request (likely a non-fetch
      // resource that we filtered out). Skip silently.
      continue;
    }
    void matchedKey;

    const responseHeaders = line.headers ?? {};
    if (isStaticAssetRequest({ url: req.url, headers: responseHeaders })) {
      staticDropped++;
      continue;
    }

    records.push({
      method: req.method.toUpperCase(),
      url: req.url,
      requestBody: req.postData ?? null,
      responseStatus: line.status,
      responseBody: line.body ?? null,
      responseHeaders,
      capturedAt: line.capturedAt,
    });
  }

  // Any leftover requests had no captured response (timeouts, aborts).
  let leftover = 0;
  for (const list of pending.values()) leftover += list.length;
  if (leftover > 0) {
    warnings.push(`Dropped ${leftover} request(s) without a paired response.`);
  }
  if (staticDropped > 0) {
    warnings.push(`Dropped ${staticDropped} static-asset request(s) (js/css/font/image/wasm).`);
  }

  return records;
}

function loadForms(filePath: string, warnings: string[]): RequestRecord[] {
  const lines = readLines(filePath);
  const out: RequestRecord[] = [];
  for (const line of lines) {
    const parsed = parseLine<RawFormLine>(line, warnings);
    if (!parsed) continue;
    if (!parsed.request || !parsed.response) {
      warnings.push(`forms.jsonl line missing request/response: ${parsed.formName ?? '?'}`);
      continue;
    }
    if (
      isStaticAssetRequest({
        url: parsed.request.url,
        headers: parsed.response.headers,
      })
    ) {
      continue;
    }
    out.push({
      method: parsed.request.method.toUpperCase(),
      url: parsed.request.url,
      requestBody: parsed.request.postData ?? null,
      responseStatus: parsed.response.status,
      responseBody: parsed.response.body ?? null,
      responseHeaders: parsed.response.headers ?? {},
      capturedAt: parsed.capturedAt,
    });
  }
  return out;
}

export async function loadNetworkRecords(
  crawlDir: string,
): Promise<{ records: RequestRecord[]; warnings: string[] }> {
  const warnings: string[] = [];

  const networkPath = join(crawlDir, 'network.jsonl');
  const formsPath = join(crawlDir, 'forms.jsonl');

  const rawLines = readLines(networkPath);
  const parsed: (RawRequestLine | RawResponseLine)[] = [];
  for (const line of rawLines) {
    const p = parseLine<RawRequestLine | RawResponseLine>(line, warnings);
    if (!p) continue;
    if (p.kind === 'request' || p.kind === 'response') parsed.push(p);
  }

  const networkRecords = pairRequestsAndResponses(parsed, warnings);
  const formRecords = loadForms(formsPath, warnings);

  return { records: [...networkRecords, ...formRecords], warnings };
}
