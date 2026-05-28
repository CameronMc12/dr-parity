/**
 * View-template inference.
 *
 * Scans network.jsonl files for GET /viz/v1/view/<id> responses with
 * status 200, extracts one canonical template per viewType integer.
 *
 * Heuristic for "best" template when multiple captures exist for the same
 * viewType: prefer the response whose total field count (recursively summed
 * across the entire JSON body) is greatest. This yields the richest schema
 * — a view body captured while all optional blocks were populated beats a
 * sparse one. Field count is computed once per candidate and the current
 * maximum retained; equal counts keep the first-encountered candidate.
 *
 * Pure read — no side effects, no file writes. Processes files line-by-line
 * (streaming) so very large network.jsonl files do not OOM.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';

export type ViewTemplate = {
  /** The raw JSON template body (the full captured response, un-parameterised). */
  template: unknown;
  /** The viewId that was captured (used as the replacement source in synthViewResponse). */
  exampleViewId: string;
  /** ClickUp view type integer (1=list, 2=board, 5=calendar, 8=chat, 9=gantt, …). */
  viewType: string;
  /** Top-level keys present in the template's `view` object. */
  capturedFields: string[];
  /** Path to the network.jsonl file this template was sourced from. */
  sourceFile: string;
};

/** Inline JSON line from network.jsonl. */
type NetworkEntry = {
  kind: 'request' | 'response';
  method?: string;
  url?: string;
  status?: number;
  body?: string;
  bodyEncoding?: string;
  headers?: Record<string, string>;
};

/** Pattern for a bare GET /viz/v1/view/<id> (no trailing slash or extra segments). */
const VIZ_VIEW_RE = /\/viz\/v1\/view\/([^/?]+)(?:\?.*)?$/;

function decodeBody(entry: NetworkEntry): string | null {
  const raw = entry.body;
  if (!raw) return null;
  if (entry.bodyEncoding === 'base64') {
    const buf = Buffer.from(raw, 'base64');
    try {
      return gunzipSync(buf).toString('utf8');
    } catch {
      return buf.toString('utf8');
    }
  }
  return raw;
}

/** Recursively count every key in a JSON value. */
function countFields(value: unknown, depth = 0): number {
  if (depth > 8 || value === null || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, v) => sum + countFields(v, depth + 1), 0);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  return keys.length + keys.reduce((sum, k) => sum + countFields(obj[k], depth + 1), 0);
}

/**
 * Process a single network.jsonl file, streaming line-by-line, and update
 * the `best` map in place with any higher-quality templates found.
 */
async function processFile(
  filePath: string,
  best: Map<string, { template: unknown; fieldCount: number; meta: Omit<ViewTemplate, 'template'> }>,
): Promise<void> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: NetworkEntry;
    try {
      entry = JSON.parse(trimmed) as NetworkEntry;
    } catch {
      continue;
    }

    if (entry.kind !== 'response') continue;
    if (entry.status !== 200) continue;

    const url = entry.url ?? '';
    const match = VIZ_VIEW_RE.exec(url);
    if (!match) continue;

    const viewId = match[1];

    const bodyStr = decodeBody(entry);
    if (!bodyStr) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      continue;
    }

    const asObj = parsed as Record<string, unknown>;
    const view = (asObj['view'] ?? asObj) as Record<string, unknown>;
    const viewType = view['type'];
    if (viewType === undefined || viewType === null) continue;

    const typeKey = String(viewType);
    const fieldCount = countFields(parsed);
    const existing = best.get(typeKey);

    if (!existing || fieldCount > existing.fieldCount) {
      best.set(typeKey, {
        template: parsed,
        fieldCount,
        meta: {
          exampleViewId: viewId,
          viewType: typeKey,
          capturedFields: Object.keys(view),
          sourceFile: filePath,
        },
      });
    }
  }
}

/**
 * Infer one ViewTemplate per viewType from a list of network.jsonl file paths.
 *
 * Returns a Map keyed by viewType string (e.g. '1', '2', '5', '8', '9').
 * Empty Map when no qualifying captures are found.
 * Files are processed sequentially to avoid parallel I/O on large files.
 */
export async function inferViewTemplates(
  networkLogPaths: string[],
): Promise<Map<string, ViewTemplate>> {
  const best = new Map<string, { template: unknown; fieldCount: number; meta: Omit<ViewTemplate, 'template'> }>();

  for (const filePath of networkLogPaths) {
    try {
      await processFile(filePath, best);
    } catch {
      // File missing or unreadable — skip silently (best-effort corpus).
    }
  }

  const result = new Map<string, ViewTemplate>();
  for (const [typeKey, entry] of best) {
    result.set(typeKey, {
      template: entry.template,
      ...entry.meta,
    });
  }
  return result;
}
