/**
 * Phase 5 entrypoint. Reads `websocket.jsonl` from the crawl dir,
 * groups frames by connection URL, and emits JSON replay fixtures plus
 * a `src/mocks/socket.ts` boot module that patches `WebSocket` to a
 * mock-socket replay during dev.
 */

import { loadWsFrames } from './load-frames';
import { groupByConnection } from './group-connections';
import { buildRealtimeFixtures } from './build-fixtures';
import { buildSocketBoot, EMPTY_BOOT } from './build-socket-boot';
import type { EmitRealtimeResult } from './types';

export type {
  CapturedFrame,
  ConnectionGroup,
  EmitRealtimeResult,
  RealtimeFixture,
  RealtimeFixtureFile,
} from './types';
export { loadWsFrames } from './load-frames';
export { groupByConnection } from './group-connections';
export { buildRealtimeFixtures, slugifyWsUrl, importNameForFixture } from './build-fixtures';
export { buildSocketBoot, EMPTY_BOOT } from './build-socket-boot';

export async function emitRealtime(crawlDir: string): Promise<EmitRealtimeResult> {
  const { frames, warnings } = await loadWsFrames(crawlDir);

  if (frames.length === 0) {
    return {
      fixture: {
        fixtureFiles: [],
        socketBootCode: EMPTY_BOOT,
      },
      connectionCount: 0,
      frameCount: 0,
      warnings,
    };
  }

  const groups = groupByConnection(frames);
  const fixtureFiles = buildRealtimeFixtures(groups);
  const socketBootCode = buildSocketBoot(groups, fixtureFiles);

  return {
    fixture: {
      fixtureFiles,
      socketBootCode,
    },
    connectionCount: groups.length,
    frameCount: frames.length,
    warnings,
  };
}
