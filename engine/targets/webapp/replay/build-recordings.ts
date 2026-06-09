/**
 * Turn the crawl's captured XHR/fetch traffic into a flat runtime recordings
 * list the Service Worker matches against. Reuses emit-mocks parsing +
 * grouping so the matching semantics (method + templated path + request-body
 * branch) stay identical to the MSW handlers the webapp target emits.
 */

import {
  loadNetworkRecords,
  groupByEndpoint,
  normalizeRequestBody,
  type EndpointGroup,
  type RequestRecord,
} from '../emit-mocks';
import { redactString } from '../redact';
import type { ReplayRecording } from './types';

function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string {
  if (!headers) return '';
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value ?? '';
  }
  return '';
}

function contentTypeOf(rec: RequestRecord): string {
  const ct = headerValue(rec.responseHeaders, 'content-type');
  return ct || 'application/json';
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * A body is "rich" when it carries real payload, not an empty/degenerate stub.
 * Mirrors merge-crawls' cross-crawl policy so the same endpoint never keeps a
 * thin/null sibling that shadows a real payload captured later in the SAME crawl.
 */
function bodyRichness(body: string): number {
  const b = (body ?? '').trim();
  if (b === '' || b === '{}' || b === '[]' || b === 'null') return 0;
  return b.length;
}

function recordingsFromGroup(group: EndpointGroup): ReplayRecording[] {
  // Same endpoint + same request body + same status can appear many times in a
  // crawl with DIFFERENT response bodies (e.g. GET /user/ returns null on some
  // hits and the real authed user on others). Keep the RICHEST body per dedupe
  // key so a null/empty hit never shadows the real payload.
  const byKey = new Map<string, ReplayRecording>();
  const order: string[] = [];
  for (const rec of group.records) {
    const requestBodyKey = normalizeRequestBody(rec.requestBody);
    const dedupeKey = `${requestBodyKey}::${rec.responseStatus}`;
    const candidate: ReplayRecording = {
      method: group.method,
      pathPattern: group.pathPattern,
      origin: group.origin || originOf(rec.url),
      requestBodyKey,
      status: rec.responseStatus,
      contentType: contentTypeOf(rec),
      body: redactString(rec.responseBody ?? ''),
    };
    const existing = byKey.get(dedupeKey);
    if (!existing) {
      order.push(dedupeKey);
      byKey.set(dedupeKey, candidate);
    } else if (bodyRichness(candidate.body) > bodyRichness(existing.body)) {
      byKey.set(dedupeKey, candidate);
    }
  }
  return order.map((k) => byKey.get(k) as ReplayRecording);
}

export async function buildRecordings(
  crawlDir: string,
): Promise<{ recordings: ReplayRecording[]; warnings: string[] }> {
  const { records, warnings } = await loadNetworkRecords(crawlDir);
  if (records.length === 0) return { recordings: [], warnings };

  const groups = groupByEndpoint(records);
  const recordings: ReplayRecording[] = [];
  for (const group of groups) recordings.push(...recordingsFromGroup(group));

  return { recordings, warnings };
}
