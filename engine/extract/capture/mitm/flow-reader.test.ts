/**
 * Unit test for {@link readFlowsFromStream}. Hand-written NDJSON sample with
 * two HTTP flows and two websocket frames (one socket) → typed Flows.
 *
 * Run: tsx engine/extract/capture/mitm/flow-reader.test.ts
 */

import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFlowsFromStream } from './flow-reader';
import { isWebsocketFlow, isMutatingFlow } from './flow-types';

const SAMPLE = [
  JSON.stringify({
    id: 'flow-1',
    kind: 'http',
    method: 'GET',
    url: 'https://api.example.com/v3/task/123',
    reqHeaders: { accept: 'application/json' },
    reqBody: { encoding: 'empty', size: 0 },
    status: 200,
    respHeaders: { 'content-type': 'application/json' },
    respBody: { encoding: 'text', text: '{"id":"123"}', size: 12, contentType: 'application/json' },
    timing: { requestStart: 100.0, responseStart: 100.2, responseEnd: 100.4 },
    clientPort: 51234,
    t: 100.0,
  }),
  JSON.stringify({
    id: 'flow-2',
    kind: 'http',
    method: 'POST',
    url: 'https://api.example.com/v3/task',
    reqHeaders: { 'content-type': 'application/json' },
    reqBody: { encoding: 'text', text: '{"name":"hi"}', size: 13, contentType: 'application/json' },
    status: 201,
    respHeaders: {},
    respBody: { encoding: 'text', text: '{"id":"999"}', size: 12 },
    timing: { requestStart: 101.0, responseEnd: 101.3 },
    t: 101.0,
  }),
  JSON.stringify({
    id: 'ws-1',
    kind: 'ws',
    url: 'wss://realtime.example.com/socket',
    direction: 'sent',
    type: 'text',
    payload: '{"op":"subscribe"}',
    t: 102.0,
  }),
  JSON.stringify({
    id: 'ws-1',
    kind: 'ws',
    url: 'wss://realtime.example.com/socket',
    direction: 'received',
    type: 'text',
    payload: '{"op":"ack"}',
    t: 102.1,
  }),
  '', // blank line is tolerated
  '{ not valid json', // corrupt line is skipped, not fatal
].join('\n');

async function main(): Promise<void> {
  const flows = await readFlowsFromStream(Readable.from([SAMPLE]));

  // 2 http + 1 merged websocket envelope.
  assert.equal(flows.length, 3, 'expected 3 flows (2 http + 1 merged ws)');

  const get = flows.find((f) => f.id === 'flow-1')!;
  assert.equal(get.kind, 'http');
  assert.equal(get.method, 'GET');
  assert.equal(get.status, 200);
  assert.equal(get.respBody?.encoding, 'text');
  assert.equal(get.clientPort, 51234);
  assert.equal(isMutatingFlow(get), false, 'GET is not mutating');

  const post = flows.find((f) => f.id === 'flow-2')!;
  assert.equal(post.method, 'POST');
  assert.equal(post.status, 201);
  assert.equal(isMutatingFlow(post), true, 'POST is mutating');

  const ws = flows.find((f) => f.id === 'ws-1')!;
  assert.equal(isWebsocketFlow(ws), true, 'ws-1 is a websocket flow');
  assert.equal(ws.wsMessages.length, 2, 'two frames folded into one envelope');
  assert.equal(ws.wsMessages[0].direction, 'sent');
  assert.equal(ws.wsMessages[1].direction, 'received');
  assert.equal(ws.url, 'wss://realtime.example.com/socket');

  console.log('PASS flow-reader: 3 flows parsed, ws frames folded, corrupt line skipped');
}

main().catch((err) => {
  console.error('FAIL flow-reader:', err instanceof Error ? err.message : err);
  process.exit(1);
});
