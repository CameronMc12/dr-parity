import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { CapturedResponse, NetLine } from './types.js';

const CLICKUP_HOST = /clickup\.com/;

function decodeBody(line: NetLine): string | null {
  if (line.body == null) return null;
  if (line.bodyEncoding === 'base64') {
    try {
      return Buffer.from(line.body, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  return line.body;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Stream a network.jsonl file and yield every successful ClickUp JSON response.
 * Malformed lines, binary bodies, and non-JSON payloads are skipped silently.
 */
export async function readResponses(
  jsonlPath: string,
  runLabel: string,
): Promise<CapturedResponse[]> {
  const out: CapturedResponse[] = [];
  const rl = createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const raw of rl) {
    if (!raw) continue;
    let line: NetLine;
    try {
      line = JSON.parse(raw) as NetLine;
    } catch {
      continue;
    }
    if (line.kind !== 'response') continue;
    if (typeof line.status !== 'number' || line.status >= 400) continue;
    if (!line.url || !CLICKUP_HOST.test(line.url)) continue;

    const decoded = decodeBody(line);
    if (decoded == null) continue;
    const json = safeJson(decoded);
    if (json === undefined) continue;

    out.push({
      url: line.url,
      status: line.status,
      method: (line.method ?? 'GET').toUpperCase(),
      json,
      run: runLabel,
    });
  }

  return out;
}

/** Strip the origin so endpoint matching is host-agnostic. */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname + new URL(url).search;
  } catch {
    return url;
  }
}

/** True when the URL path (origin-stripped) matches the given RegExp. */
export function matches(res: CapturedResponse, re: RegExp): boolean {
  return re.test(pathOf(res.url));
}
