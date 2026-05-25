/**
 * Load and normalize websocket frames from `websocket.jsonl`.
 *
 * The recorder writes these line kinds:
 *  - `{ kind: 'created', requestId, url }` — connection opened (optional)
 *  - `{ direction: 'sent', requestId, url, timestamp, opcode, payloadData }`
 *  - `{ direction: 'received', requestId, url, timestamp, opcode, payloadData }`
 *
 * URL resolution order per frame: the frame's own `url`, then the
 * `created` entry for its `requestId`, then a synthesized stable
 * `wss://captured/<requestId>` so frames are never dropped.
 *
 * Backward compatibility: OLD logs carry neither a `created` line nor a
 * per-frame `url`. Those degrade gracefully to the synthesized
 * per-requestId url (group-as-one per connection) instead of emitting 0.
 *
 * Binary frames (opcode 2) are dropped with a warning. Text payloads are
 * run through `redactString` so live tokens are not baked into fixtures.
 */

import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

import { redactString } from '../redact';
import type { CapturedFrame } from './types';

type RawCreated = {
  kind: 'created';
  capturedAt: string;
  requestId: string;
  url: string;
};

type RawFrame = {
  direction: 'sent' | 'received';
  capturedAt: string;
  requestId: string;
  url?: string | null;
  timestamp: number;
  opcode: number;
  // Current recorder field; `payload` retained for older logs.
  payloadData?: string;
  payload?: string;
};

type LoadResult = {
  frames: CapturedFrame[];
  warnings: string[];
};

const TEXT_OPCODE = 1;

function parseLine(line: string): RawCreated | RawFrame | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === 'object') return obj as RawCreated | RawFrame;
    return null;
  } catch {
    return null;
  }
}

function isCreated(entry: RawCreated | RawFrame): entry is RawCreated {
  return (entry as RawCreated).kind === 'created';
}

function framePayload(frame: RawFrame): string {
  return frame.payloadData ?? frame.payload ?? '';
}

function synthesizedUrl(requestId: string): string {
  return `wss://captured/${requestId}`;
}

function resolveUrl(
  frame: RawFrame,
  urlByRequestId: Map<string, string>,
): string {
  if (frame.url && frame.url.length > 0) return frame.url;
  const known = urlByRequestId.get(frame.requestId);
  if (known && known.length > 0) return known;
  return synthesizedUrl(frame.requestId);
}

export async function loadWsFrames(crawlDir: string): Promise<LoadResult> {
  const filePath = join(crawlDir, 'websocket.jsonl');
  const warnings: string[] = [];

  if (!existsSync(filePath)) {
    return { frames: [], warnings };
  }

  const urlByRequestId = new Map<string, string>();
  const rawFrames: RawFrame[] = [];
  let parseFailures = 0;
  let binaryDropped = 0;
  let synthesizedCount = 0;

  // Stream line-by-line so a multi-GB log never becomes a single string
  // (Node caps strings at ~512MB).
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    const parsed = parseLine(line);
    if (!parsed) {
      parseFailures++;
      continue;
    }
    if (isCreated(parsed)) {
      urlByRequestId.set(parsed.requestId, parsed.url);
      continue;
    }
    if (parsed.opcode !== TEXT_OPCODE) {
      binaryDropped++;
      continue;
    }
    // Backfill the map from any frame that already carries its url so
    // later frames sharing the requestId resolve consistently.
    if (parsed.url && parsed.url.length > 0) {
      urlByRequestId.set(parsed.requestId, parsed.url);
    }
    rawFrames.push(parsed);
  }

  if (parseFailures > 0) {
    warnings.push(`Skipped ${parseFailures} unparseable websocket.jsonl lines`);
  }
  if (binaryDropped > 0) {
    warnings.push(`Dropped ${binaryDropped} binary websocket frames (text only supported)`);
  }

  const earliestByUrl = new Map<string, number>();
  const resolved: { url: string; raw: RawFrame }[] = [];

  for (const frame of rawFrames) {
    const url = resolveUrl(frame, urlByRequestId);
    if (url === synthesizedUrl(frame.requestId)) synthesizedCount++;
    const prev = earliestByUrl.get(url);
    if (prev === undefined || frame.timestamp < prev) {
      earliestByUrl.set(url, frame.timestamp);
    }
    resolved.push({ url, raw: frame });
  }

  if (synthesizedCount > 0) {
    warnings.push(
      `Synthesized stable urls for ${synthesizedCount} frames with no captured connection url`,
    );
  }

  const frames: CapturedFrame[] = resolved.map(({ url, raw }) => {
    const earliest = earliestByUrl.get(url) ?? raw.timestamp;
    const relativeMs = Math.max(0, Math.round((raw.timestamp - earliest) * 1000));
    return {
      direction: raw.direction,
      url,
      payload: redactString(framePayload(raw)),
      capturedAt: raw.capturedAt,
      relativeMs,
    };
  });

  return { frames, warnings };
}
