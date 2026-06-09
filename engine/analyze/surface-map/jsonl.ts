/**
 * Defensive streaming JSONL reader for the recorded network logs.
 * Files can be multiple GB, so lines are streamed (never fully buffered).
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { NetworkRequestLine, NetworkResponseLine } from './types.js';

type AnyLine = NetworkRequestLine | NetworkResponseLine | { kind?: string };

/** Stream a JSONL file line-by-line, invoking `onLine` for each valid object. */
export async function forEachJsonlLine(
  filePath: string,
  onLine: (line: AnyLine) => void,
): Promise<void> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const raw of rl) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      onLine(JSON.parse(trimmed));
    } catch {
      // Malformed line — skip silently per spec.
    }
  }
}

export function isRequest(line: AnyLine): line is NetworkRequestLine {
  return line.kind === 'request' && typeof (line as NetworkRequestLine).url === 'string';
}

export function isResponse(line: AnyLine): line is NetworkResponseLine {
  return line.kind === 'response' && typeof (line as NetworkResponseLine).url === 'string';
}

/** Decode a recorded body, returning null for binary / undecodable content. */
export function decodeBody(body: string | null | undefined, encoding?: string): string | null {
  if (body == null) return null;
  if (encoding === 'base64') {
    try {
      const text = Buffer.from(body, 'base64').toString('utf8');
      if (text.includes('�')) return null; // replacement char → binary
      return text;
    } catch {
      return null;
    }
  }
  return body;
}
