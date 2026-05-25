/**
 * Bucket captured WS frames by connection URL. Each group's
 * `urlPattern` strips the query string so the mock matches the same
 * endpoint across reruns (auth tokens, sids, etc. vary per session).
 */

import type { CapturedFrame, ConnectionGroup } from './types';

function stripQuery(url: string): string {
  const queryIdx = url.indexOf('?');
  if (queryIdx === -1) return url;
  return url.slice(0, queryIdx);
}

export function groupByConnection(frames: CapturedFrame[]): ConnectionGroup[] {
  const byUrl = new Map<string, CapturedFrame[]>();
  for (const frame of frames) {
    const list = byUrl.get(frame.url);
    if (list) {
      list.push(frame);
    } else {
      byUrl.set(frame.url, [frame]);
    }
  }

  const groups: ConnectionGroup[] = [];
  for (const [url, list] of byUrl) {
    const sorted = [...list].sort((a, b) => a.relativeMs - b.relativeMs);
    const first = sorted[0]?.relativeMs ?? 0;
    const last = sorted[sorted.length - 1]?.relativeMs ?? 0;
    groups.push({
      url,
      urlPattern: stripQuery(url),
      frames: sorted,
      durationMs: last - first,
    });
  }

  groups.sort((a, b) => a.url.localeCompare(b.url));
  return groups;
}
