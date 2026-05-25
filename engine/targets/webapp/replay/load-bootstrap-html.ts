/**
 * Locate the ORIGINAL navigation document for the captured SPA and load its
 * raw response body from the crawl's `network.jsonl`. This is the pre-JS
 * bootstrap HTML the server sent, NOT the post-hydration DOM snapshot under
 * the crawl `states` directory. The bundle must render fresh against the
 * recordings.
 *
 * Bootstrap URL resolution order:
 *   1. graph.json `startUrl`
 *   2. graph.json `nodes[0].url` (root state)
 *   3. the first text/html response in network.jsonl
 *
 * Storage seeding: ClickUp-style crawls may carry a `storage-state.json` at
 * the crawl root (Playwright storageState shape: { cookies, origins }). It is
 * optional; absent => no seeding.
 */

import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

import type { SeededIdbDatabase, SeededIdbStore, SeededState } from './types';

type GraphNode = { id?: string; url?: string };
type Graph = { startUrl?: string; nodes?: GraphNode[] };

type RawResponseLine = {
  kind?: string;
  url?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string | null;
  bodyEncoding?: 'utf8' | 'base64';
};

export type BootstrapDocument = {
  url: string;
  html: string;
};

function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string {
  if (!headers) return '';
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value ?? '';
  }
  return '';
}

function isHtmlResponse(headers: Record<string, string> | undefined): boolean {
  return headerValue(headers, 'content-type').toLowerCase().includes('text/html');
}

function readGraph(crawlDir: string): Graph | null {
  const graphPath = join(crawlDir, 'graph.json');
  if (!existsSync(graphPath)) return null;
  try {
    return JSON.parse(readFileSync(graphPath, 'utf8')) as Graph;
  } catch {
    return null;
  }
}

/** Candidate bootstrap URLs, most-trusted first. */
function bootstrapCandidates(crawlDir: string): string[] {
  const graph = readGraph(crawlDir);
  const out: string[] = [];
  if (graph?.startUrl) out.push(graph.startUrl);
  const firstNodeUrl = graph?.nodes?.[0]?.url;
  if (firstNodeUrl && !out.includes(firstNodeUrl)) out.push(firstNodeUrl);
  return out;
}

/**
 * Stream network.jsonl, returning the response body for the first candidate
 * URL that resolves to an html response, else the first html response found.
 */
async function findBootstrap(
  crawlDir: string,
  candidates: string[],
): Promise<BootstrapDocument | null> {
  const networkPath = join(crawlDir, 'network.jsonl');
  if (!existsSync(networkPath)) return null;

  const wanted = new Set(candidates);
  let firstHtml: BootstrapDocument | null = null;

  const rl = createInterface({
    input: createReadStream(networkPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let rec: RawResponseLine;
    try {
      rec = JSON.parse(trimmed) as RawResponseLine;
    } catch {
      continue;
    }
    if (rec.kind !== 'response') continue;
    if (!isHtmlResponse(rec.headers)) continue;

    const url = rec.url ?? '';
    const body = decodeBody(rec);
    if (!body) continue;

    const doc: BootstrapDocument = { url, html: body };
    if (wanted.has(url)) {
      rl.close();
      return doc;
    }
    if (!firstHtml) firstHtml = doc;
  }

  return firstHtml;
}

function decodeBody(rec: RawResponseLine): string {
  const body = rec.body;
  if (body == null || body.length === 0) return '';
  if (rec.bodyEncoding === 'base64') {
    return Buffer.from(body, 'base64').toString('utf8');
  }
  return body;
}

export async function loadBootstrapDocument(
  crawlDir: string,
): Promise<BootstrapDocument | null> {
  const candidates = bootstrapCandidates(crawlDir);
  return findBootstrap(crawlDir, candidates);
}

/** Raw IndexedDB store as emitted by the crawler (additive, may be absent). */
type RawIdbStore = {
  name?: string;
  keyPath?: string | string[] | null;
  autoIncrement?: boolean;
  records?: { key?: IDBValidKey; value?: unknown }[];
};

/** Raw IndexedDB database entry on an origin (additive, may be absent). */
type RawIdbDatabase = {
  database?: string;
  name?: string;
  version?: number;
  stores?: RawIdbStore[];
};

type StorageStateOrigin = {
  origin?: string;
  localStorage?: { name: string; value: string }[];
  sessionStorage?: { name: string; value: string }[];
  /** Additive field added by the crawler; older captures omit it. */
  indexedDB?: RawIdbDatabase[];
};

type PlaywrightStorageState = {
  cookies?: { name?: string; value?: string }[];
  origins?: StorageStateOrigin[];
};

/**
 * The crawler writes storage-state.json in one of two shapes:
 *   - flat:    { cookies, origins }                     (raw Playwright)
 *   - wrapped: { capturedAt, url, appOrigin, storageState: { cookies, origins } }
 * Unwrap to the inner Playwright shape, tolerating both.
 */
function unwrapStorageState(raw: unknown): PlaywrightStorageState {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const inner = obj.storageState;
  if (inner && typeof inner === 'object') return inner as PlaywrightStorageState;
  return obj as PlaywrightStorageState;
}

/**
 * Read the crawler's top-level `indexedDB` block, which sits beside
 * `storageState`: `{ indexedDB: { origin, databases: [...], errors } }`.
 * Returns the `databases` array (or empty when absent).
 */
function topLevelIdbDatabases(raw: unknown): RawIdbDatabase[] {
  if (!raw || typeof raw !== 'object') return [];
  const idb = (raw as Record<string, unknown>).indexedDB;
  if (!idb || typeof idb !== 'object') return [];
  const databases = (idb as Record<string, unknown>).databases;
  return Array.isArray(databases) ? (databases as RawIdbDatabase[]) : [];
}

/** Map one raw IndexedDB database to the seed shape, dropping malformed stores. */
function normalizeIdbDatabase(raw: RawIdbDatabase): SeededIdbDatabase | null {
  const database = raw.database ?? raw.name;
  if (!database) return null;
  const version = typeof raw.version === 'number' && raw.version >= 1 ? raw.version : 1;

  const stores: SeededIdbStore[] = [];
  for (const store of raw.stores ?? []) {
    if (!store?.name) continue;
    const records = (store.records ?? [])
      .filter((r): r is { key?: IDBValidKey; value: unknown } => r != null && 'value' in r)
      .map((r) => (r.key !== undefined ? { key: r.key, value: r.value } : { value: r.value }));
    stores.push({
      name: store.name,
      keyPath: store.keyPath ?? null,
      autoIncrement: store.autoIncrement === true,
      records,
    });
  }
  if (stores.length === 0) return null;
  return { database, version, stores };
}

/**
 * Load optional `storage-state.json` and flatten it into the seed shape the boot
 * shim consumes. Handles both the flat and wrapped Playwright shapes, and the
 * additive `indexedDB` field. Returns null when absent or empty so the caller can
 * mark `storageSeeded: false`.
 */
export function loadSeededState(crawlDir: string): SeededState | null {
  const statePath = join(crawlDir, 'storage-state.json');
  if (!existsSync(statePath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
  const parsed = unwrapStorageState(raw);

  const localStorage: Record<string, string> = {};
  const sessionStorage: Record<string, string> = {};
  const indexedDB: SeededIdbDatabase[] = [];
  for (const origin of parsed.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item?.name) localStorage[item.name] = item.value ?? '';
    }
    for (const item of origin.sessionStorage ?? []) {
      if (item?.name) sessionStorage[item.name] = item.value ?? '';
    }
    // Legacy per-origin indexedDB shape (older captures embedded it here).
    for (const db of origin.indexedDB ?? []) {
      const normalized = normalizeIdbDatabase(db);
      if (normalized) indexedDB.push(normalized);
    }
  }

  // Current crawler shape: a sibling of `storageState`, not per-origin —
  // `{ indexedDB: { origin, databases: [{ name, version, stores }], errors } }`.
  for (const db of topLevelIdbDatabases(raw)) {
    const normalized = normalizeIdbDatabase(db);
    if (normalized) indexedDB.push(normalized);
  }

  const cookies: string[] = [];
  for (const cookie of parsed.cookies ?? []) {
    if (cookie?.name) cookies.push(`${cookie.name}=${cookie.value ?? ''}`);
  }

  if (
    Object.keys(localStorage).length === 0 &&
    Object.keys(sessionStorage).length === 0 &&
    cookies.length === 0 &&
    indexedDB.length === 0
  ) {
    return null;
  }

  return { localStorage, sessionStorage, cookies, indexedDB };
}
