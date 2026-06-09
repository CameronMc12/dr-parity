/**
 * Emit one JSON replay fixture per WS connection group. The runtime
 * loader in `socket.ts` consumes these to replay `received` frames at
 * their captured timing offsets.
 */

import { createHash } from 'node:crypto';

import type { ConnectionGroup, RealtimeFixtureFile } from './types';

// Cap the slug so the final `ws-<slug>.json` filename stays well under the
// 255-byte filesystem name limit. WS URLs can embed long Ably/Intercom access
// tokens that blow past the limit and crash the build with ENAMETOOLONG. When a
// slug is truncated, an 8-char content hash of the FULL url is appended so two
// long URLs that share a prefix never collide to the same file.
const MAX_WS_SLUG_LEN = 120;

export function slugifyWsUrl(url: string): string {
  const base = url
    .toLowerCase()
    .replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'wss-' : 'ws-'))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (base.length <= MAX_WS_SLUG_LEN) return base;

  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
  const head = base.slice(0, MAX_WS_SLUG_LEN).replace(/-+$/g, '');
  return `${head}-${hash}`;
}

export function buildRealtimeFixtures(
  groups: ConnectionGroup[],
): RealtimeFixtureFile[] {
  const seen = new Set<string>();
  const files: RealtimeFixtureFile[] = [];

  for (const group of groups) {
    let slug = slugifyWsUrl(group.url);
    if (slug.length === 0) slug = 'ws-anon';
    let unique = slug;
    let counter = 1;
    while (seen.has(unique)) {
      counter += 1;
      unique = `${slug}-${counter}`;
    }
    seen.add(unique);

    const payload = {
      url: group.url,
      urlPattern: group.urlPattern,
      durationMs: group.durationMs,
      frames: group.frames.map((f) => ({
        direction: f.direction,
        atMs: f.relativeMs,
        payload: f.payload,
      })),
    };

    files.push({
      relativePath: `src/fixtures/ws-${unique}.json`,
      content: JSON.stringify(payload, null, 2) + '\n',
    });
  }

  return files;
}

export function importNameForFixture(relativePath: string): string {
  const base = relativePath.split('/').pop() ?? relativePath;
  const stem = base.replace(/\.json$/, '');
  const safe = stem.replace(/[^a-zA-Z0-9_]/g, '_');
  return `replay_${safe}`;
}
