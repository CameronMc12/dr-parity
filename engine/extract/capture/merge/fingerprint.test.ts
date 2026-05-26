/**
 * Unit test for fingerprinting: shard folding, id templating, volatile-query
 * strip, body-shape hashing.
 *
 * Run: tsx engine/extract/capture/merge/fingerprint.test.ts
 */

import assert from 'node:assert/strict';
import { hostClass, pathTemplate, stableQuery, fingerprint } from './fingerprint';
import type { Flow } from '../mitm/flow-types';

function httpFlow(method: string, url: string, body?: string): Flow {
  return {
    id: 'x',
    kind: 'http',
    method,
    url,
    reqHeaders: {},
    reqBody: body
      ? { encoding: 'text', text: body, size: body.length }
      : { encoding: 'empty', size: 0 },
    respHeaders: {},
    timing: {},
    wsMessages: [],
    t: 0,
  };
}

function main(): void {
  // --- shard folding ---
  assert.equal(
    hostClass('frontdoor-prod-eu-3.clickup.com'),
    'frontdoor.clickup.com',
    'regional shard folds to base host',
  );
  assert.equal(hostClass('api-7.example.com'), 'api.example.com', 'numeric shard folds');
  assert.equal(hostClass('static.example.com'), 'static.example.com', 'plain host unchanged');

  // --- id templating ---
  const numeric = pathTemplate('/v3/task/12345/comment');
  assert.equal(numeric.template, '/v3/task/{param}/comment', 'numeric id templated');
  assert.equal(numeric.params.p0, '12345', 'concrete id retained');

  const uuid = pathTemplate('/users/550e8400-e29b-41d4-a716-446655440000/profile');
  assert.equal(uuid.template, '/users/{param}/profile', 'uuid templated');
  assert.equal(uuid.params.p0, '550e8400-e29b-41d4-a716-446655440000', 'concrete uuid retained');

  // --- volatile query strip ---
  const sq = stableQuery(new URLSearchParams('b=2&_=99887766&a=1&cb=zzz'));
  assert.equal(sq, 'a=1&b=2', 'volatile keys dropped, remainder sorted');

  // --- full fingerprint: two logically-identical GETs collapse ---
  const f1 = fingerprint(httpFlow('GET', 'https://api-1.example.com/v3/task/111?_=123&page=1'));
  const f2 = fingerprint(httpFlow('GET', 'https://api-9.example.com/v3/task/222?cb=abc&page=1'));
  assert.equal(f1.normalizedKey, f2.normalizedKey, 'shard + id + volatile-query collapse to one key');

  // --- body shape hash: same shape, different values → same hash ---
  const p1 = fingerprint(httpFlow('POST', 'https://api.example.com/v3/task', '{"name":"a","done":false}'));
  const p2 = fingerprint(httpFlow('POST', 'https://api.example.com/v3/task', '{"name":"zzz","done":true}'));
  assert.equal(p1.bodyShapeHash, p2.bodyShapeHash, 'same JSON shape → same body hash');
  assert.notEqual(
    p1.bodyShapeHash,
    fingerprint(httpFlow('POST', 'https://api.example.com/v3/task', '{"title":"x"}')).bodyShapeHash,
    'different JSON shape → different body hash',
  );

  console.log('PASS fingerprint: shard folding, id templating, volatile-query strip, body-shape hash');
}

main();
