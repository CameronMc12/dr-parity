/**
 * Read individual asset bodies out of a Playwright `trace.zip` archive.
 *
 * Playwright stores resource bodies under `resources/<sha1>` keyed by the
 * `_sha1` value attached to each network response entry. We open the zip
 * lazily, cache an in-memory index of entry offsets, and resolve each
 * `extractAssetFromTrace` call by streaming a single entry.
 *
 * The cache is per-crawlDir. Callers that extract many assets share the
 * same opened ZipFile handle.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yauzl from 'yauzl';

type ZipEntry = yauzl.Entry;

interface OpenTrace {
  zip: yauzl.ZipFile;
  /** Map from entry fileName (e.g. "resources/<sha1>") to its Entry record. */
  entries: Map<string, ZipEntry>;
}

const TRACE_CACHE = new Map<string, Promise<OpenTrace>>();

function openZipOnce(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('failed to open zip'));
      resolve(zip);
    });
  });
}

function indexAllEntries(zip: yauzl.ZipFile): Promise<Map<string, ZipEntry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, ZipEntry>();
    zip.on('error', reject);
    zip.on('end', () => resolve(entries));
    zip.on('entry', (entry: ZipEntry) => {
      // Directory entries end with `/` and have no body — skip.
      if (!/\/$/.test(entry.fileName)) {
        entries.set(entry.fileName, entry);
      }
      zip.readEntry();
    });
    zip.readEntry();
  });
}

async function openTrace(crawlDir: string): Promise<OpenTrace> {
  const cached = TRACE_CACHE.get(crawlDir);
  if (cached) return cached;

  const zipPath = join(crawlDir, 'trace.zip');
  if (!existsSync(zipPath)) {
    throw new Error(`trace.zip not found in crawl dir: ${crawlDir}`);
  }

  const pending = (async () => {
    const zip = await openZipOnce(zipPath);
    const entries = await indexAllEntries(zip);
    return { zip, entries };
  })();

  TRACE_CACHE.set(crawlDir, pending);
  try {
    return await pending;
  } catch (err) {
    TRACE_CACHE.delete(crawlDir);
    throw err;
  }
}

function readEntryBuffer(zip: yauzl.ZipFile, entry: ZipEntry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) return reject(err ?? new Error('failed to open entry stream'));
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

/**
 * Read `resources/<sha1>` (or any alternative path Playwright uses) from
 * the cached trace.zip and return the raw bytes.
 */
export async function extractAssetFromTrace(crawlDir: string, sha1: string): Promise<Buffer> {
  const trace = await openTrace(crawlDir);
  const candidates = [
    `resources/${sha1}`,
    `resources/${sha1}.bin`,
    sha1,
  ];
  for (const name of candidates) {
    const entry = trace.entries.get(name);
    if (entry) return readEntryBuffer(trace.zip, entry);
  }
  throw new Error(`Asset body not found in trace.zip for sha1=${sha1}`);
}

/**
 * Read every entry whose fileName matches the predicate. Used by the network
 * loader to discover `network.json` (or its jsonl shards) without making
 * assumptions about the exact path.
 */
export async function readTraceEntries(
  crawlDir: string,
  predicate: (fileName: string) => boolean,
): Promise<Array<{ fileName: string; body: Buffer }>> {
  const trace = await openTrace(crawlDir);
  const out: Array<{ fileName: string; body: Buffer }> = [];
  for (const [fileName, entry] of trace.entries) {
    if (!predicate(fileName)) continue;
    const body = await readEntryBuffer(trace.zip, entry);
    out.push({ fileName, body });
  }
  return out;
}

/** Release a cached trace handle. Tests use this to avoid lingering FDs. */
export function closeTrace(crawlDir: string): void {
  const cached = TRACE_CACHE.get(crawlDir);
  if (!cached) return;
  TRACE_CACHE.delete(crawlDir);
  void cached.then((open) => {
    try {
      open.zip.close();
    } catch {
      /* noop */
    }
  });
}
