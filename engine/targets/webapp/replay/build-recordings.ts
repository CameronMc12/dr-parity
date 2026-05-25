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

function recordingsFromGroup(group: EndpointGroup): ReplayRecording[] {
  const seen = new Set<string>();
  const out: ReplayRecording[] = [];
  for (const rec of group.records) {
    const requestBodyKey = normalizeRequestBody(rec.requestBody);
    const dedupeKey = `${requestBodyKey}::${rec.responseStatus}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      method: group.method,
      pathPattern: group.pathPattern,
      origin: group.origin || originOf(rec.url),
      requestBodyKey,
      status: rec.responseStatus,
      contentType: contentTypeOf(rec),
      body: redactString(rec.responseBody ?? ''),
    });
  }
  return out;
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
