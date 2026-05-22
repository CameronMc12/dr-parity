/**
 * Bucket request records into endpoint groups. Initial bucket key is
 * `method + originPath` (no query). After bucketing, we run
 * `inferUrlPattern` to derive the templated path. Buckets that templatize
 * to the same `method + pathPattern` are merged.
 */

import { inferUrlPattern } from './url-pattern';
import type { EndpointGroup, RequestRecord } from './types';

function originPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return url;
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function segmentCount(path: string): number {
  return path.split('/').filter((s) => s.length > 0).length;
}

export function groupByEndpoint(records: RequestRecord[]): EndpointGroup[] {
  // Step 1: initial coarse bucket by method + segment-count.
  // This keeps `/api/posts` separate from `/api/posts/123` while still
  // letting `/api/posts/1` and `/api/posts/2` collapse together.
  const coarse = new Map<string, RequestRecord[]>();
  for (const rec of records) {
    const path = originPath(rec.url);
    const key = `${rec.method.toUpperCase()} ${segmentCount(path)} ${originOf(rec.url)}`;
    const list = coarse.get(key) ?? [];
    list.push(rec);
    coarse.set(key, list);
  }

  // Step 2: within each coarse bucket, further split by static path prefix
  // so `/api/posts/123` and `/api/users/456` don't merge.
  const refined = new Map<string, RequestRecord[]>();
  for (const list of coarse.values()) {
    const subBuckets = new Map<string, RequestRecord[]>();
    for (const rec of list) {
      const path = originPath(rec.url);
      const segs = path.split('/').filter((s) => s.length > 0);
      // Use a key built from segments, marking id-like segments as wildcard.
      const sig = segs
        .map((s) => (/^[0-9]+$|^[0-9a-f]{8,}$/i.test(s) ? '*' : s))
        .join('/');
      const subKey = `${rec.method.toUpperCase()} /${sig} ${originOf(rec.url)}`;
      const sub = subBuckets.get(subKey) ?? [];
      sub.push(rec);
      subBuckets.set(subKey, sub);
    }
    for (const [k, v] of subBuckets) refined.set(k, v);
  }

  // Step 3: build EndpointGroup per refined bucket.
  const groups: EndpointGroup[] = [];
  for (const recs of refined.values()) {
    const { pathPattern, origin } = inferUrlPattern(recs.map((r) => r.url));
    groups.push({
      method: recs[0].method.toUpperCase(),
      pathPattern,
      origin,
      records: recs,
    });
  }

  groups.sort((a, b) => {
    if (a.method !== b.method) return a.method.localeCompare(b.method);
    return a.pathPattern.localeCompare(b.pathPattern);
  });

  return groups;
}
