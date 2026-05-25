/**
 * Phase 5 realtime stub types. Captured websocket frames are loaded from
 * the crawl directory, grouped by connection URL, and emitted as JSON
 * fixtures plus a mock-socket boot file that replays server->client
 * frames against `new WebSocket(url)` calls in the cloned app.
 */

export type CapturedFrame = {
  direction: 'sent' | 'received';
  url: string;
  payload: string;
  capturedAt: string;
  relativeMs: number;
};

export type ConnectionGroup = {
  url: string;
  urlPattern: string;
  frames: CapturedFrame[];
  durationMs: number;
};

export type RealtimeFixtureFile = {
  relativePath: string;
  content: string;
};

export type RealtimeFixture = {
  fixtureFiles: RealtimeFixtureFile[];
  socketBootCode: string;
};

export type EmitRealtimeResult = {
  fixture: RealtimeFixture | null;
  connectionCount: number;
  frameCount: number;
  warnings: string[];
};
