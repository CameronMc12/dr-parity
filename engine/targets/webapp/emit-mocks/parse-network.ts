/**
 * Reads `network.jsonl` from a crawl directory and pairs request/response
 * entries (they are written as separate lines by the crawler) into a
 * normalized `RequestRecord`. Also reads `forms.jsonl` if present.
 *
 * Filtering: keeps only fetch/xhr resource types since static assets are
 * already served from the scaffold's public/ directory.
 */

import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
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
  /** Additive: 'base64' for binary assets, 'utf8'/absent for text/API bodies. */
  bodyEncoding?: 'utf8' | 'base64';
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

/**
 * Stream a `.jsonl` file line-by-line, invoking `onLine` for each non-empty
 * line. The file is never loaded into a single string, so multi-GB crawl logs
 * stay under Node's ~512MB string limit. Each line is parsed individually.
 */
async function streamLines(
  filePath: string,
  onLine: (line: string) => void,
): Promise<void> {
  if (!existsSync(filePath)) return;
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    onLine(line);
  }
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

async function loadForms(filePath: string, warnings: string[]): Promise<RequestRecord[]> {
  const out: RequestRecord[] = [];
  await streamLines(filePath, (line) => {
    const parsed = parseLine<RawFormLine>(line, warnings);
    if (!parsed) return;
    if (!parsed.request || !parsed.response) {
      warnings.push(`forms.jsonl line missing request/response: ${parsed.formName ?? '?'}`);
      return;
    }
    if (
      isStaticAssetRequest({
        url: parsed.request.url,
        headers: parsed.response.headers,
      })
    ) {
      return;
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
  });
  return out;
}

export async function loadNetworkRecords(
  crawlDir: string,
): Promise<{ records: RequestRecord[]; warnings: string[] }> {
  const warnings: string[] = [];

  const networkPath = join(crawlDir, 'network.jsonl');
  const formsPath = join(crawlDir, 'forms.jsonl');

  // Stream-parse, retaining only what pairing needs. Non-fetch request lines
  // and static-asset responses are never kept as records, so we drop them (and,
  // critically, their bodies) at stream time. This keeps the retained set tiny
  // even on multi-GB legacy crawls whose JS bundles still carry full bodies.
  const parsed: (RawRequestLine | RawResponseLine)[] = [];
  await streamLines(networkPath, (line) => {
    const p = parseLine<RawRequestLine | RawResponseLine>(line, warnings);
    if (!p) return;
    if (p.kind === 'request') {
      const resourceType = (p.resourceType ?? '').toLowerCase();
      if (resourceType && !FETCH_LIKE.has(resourceType)) return;
      parsed.push(p);
      return;
    }
    if (p.kind === 'response') {
      if (isStaticAssetRequest({ url: p.url, headers: p.headers })) {
        // Keep a body-less marker so request/response pairing stays aligned,
        // but never retain the (possibly multi-MB) static body in memory.
        parsed.push({ ...p, body: null });
        return;
      }
      parsed.push(p);
    }
  });

  const networkRecords = pairRequestsAndResponses(parsed, warnings);
  const formRecords = await loadForms(formsPath, warnings);

  return { records: [...networkRecords, ...formRecords], warnings };
}
