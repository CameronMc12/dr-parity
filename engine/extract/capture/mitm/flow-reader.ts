/**
 * Stream a mitm NDJSON flow log into typed {@link Flow}s.
 *
 * Uses `readline` over a file stream — never `readFileSync` — so a multi-GB
 * capture log is processed line-by-line without loading it all into memory.
 *
 * Websocket frames are written by the addon as separate `kind: "ws"` lines
 * keyed by their parent flow id. The reader folds those frames back into a
 * single websocket {@link Flow} so consumers see one envelope per socket.
 */

import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { Flow, WsMessage } from './flow-types';

type RawHttpLine = {
  id: string;
  kind: 'http';
  method: string;
  url: string;
  reqHeaders?: Record<string, string>;
  reqBody?: Flow['reqBody'];
  status?: number | null;
  respHeaders?: Record<string, string>;
  respBody?: Flow['respBody'] | null;
  timing?: Flow['timing'];
  clientPort?: number | null;
  t?: number;
};

type RawWsLine = {
  id: string;
  kind: 'ws';
  url: string;
  direction: 'sent' | 'received';
  type: 'text' | 'binary';
  payload: string;
  t?: number;
};

const EMPTY_BODY: Flow['reqBody'] = { encoding: 'empty', size: 0 };

function normalizeHttp(raw: RawHttpLine): Flow {
  return {
    id: raw.id,
    kind: 'http',
    method: raw.method,
    url: raw.url,
    reqHeaders: raw.reqHeaders ?? {},
    reqBody: raw.reqBody ?? EMPTY_BODY,
    status: raw.status ?? undefined,
    respHeaders: raw.respHeaders ?? {},
    respBody: raw.respBody ?? undefined,
    timing: raw.timing ?? {},
    wsMessages: [],
    clientPort: raw.clientPort ?? undefined,
    t: raw.t ?? raw.timing?.requestStart ?? 0,
  };
}

/**
 * Parse an NDJSON flow log from a Readable source into typed flows.
 * Websocket frame lines are merged into their parent socket flow.
 */
export async function readFlowsFromStream(source: Readable): Promise<Flow[]> {
  const rl = createInterface({ input: source, crlfDelay: Infinity });
  const httpFlows: Flow[] = [];
  const wsFlows = new Map<string, Flow>();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: RawHttpLine | RawWsLine;
    try {
      parsed = JSON.parse(trimmed) as RawHttpLine | RawWsLine;
    } catch {
      // Skip a corrupt line rather than abort the whole stream.
      continue;
    }

    if (parsed.kind === 'http') {
      httpFlows.push(normalizeHttp(parsed));
      continue;
    }

    if (parsed.kind === 'ws') {
      const frame: WsMessage = {
        direction: parsed.direction,
        type: parsed.type,
        payload: parsed.payload,
        t: parsed.t ?? 0,
      };
      const existing = wsFlows.get(parsed.id);
      if (existing) {
        existing.wsMessages.push(frame);
      } else {
        wsFlows.set(parsed.id, {
          id: parsed.id,
          kind: 'websocket',
          method: 'GET',
          url: parsed.url,
          reqHeaders: {},
          reqBody: EMPTY_BODY,
          respHeaders: {},
          timing: {},
          wsMessages: [frame],
          t: parsed.t ?? 0,
        });
      }
    }
  }

  return [...httpFlows, ...wsFlows.values()];
}

/** Read flows from an NDJSON file path. */
export async function readFlows(path: string): Promise<Flow[]> {
  return readFlowsFromStream(createReadStream(path, { encoding: 'utf8' }));
}
