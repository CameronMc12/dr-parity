/**
 * Emit one JSON replay fixture per WS connection group. The runtime
 * loader in `socket.ts` consumes these to replay `received` frames at
 * their captured timing offsets.
 */

import type { ConnectionGroup, RealtimeFixtureFile } from './types';

export function slugifyWsUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'wss-' : 'ws-'))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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
