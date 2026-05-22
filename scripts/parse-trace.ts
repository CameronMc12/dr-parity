#!/usr/bin/env tsx
/**
 * Parse Playwright trace.zip archives under a captures dir.
 * Extracts and emits dom-snapshots.jsonl tolerant of format variations.
 *
 * Usage: tsx scripts/parse-trace.ts <captures-dir>
 */

import { existsSync, mkdirSync, readdirSync, statSync, createWriteStream, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createReadStream } from 'node:fs';
import yauzl from 'yauzl';

type ZipFile = Awaited<ReturnType<typeof openZip>>;

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('failed to open zip'));
      resolve(zip);
    });
  });
}

function ensureDirFor(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function extractZip(zipPath: string, destDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extracted: string[] = [];
    openZip(zipPath)
      .then((zip: ZipFile) => {
        zip.on('error', reject);
        zip.on('end', () => resolve(extracted));
        zip.on('entry', (entry) => {
          const target = join(destDir, entry.fileName);
          if (/\/$/.test(entry.fileName)) {
            mkdirSync(target, { recursive: true });
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
              console.error('[parse-trace] failed to open entry:', entry.fileName, err);
              zip.readEntry();
              return;
            }
            ensureDirFor(target);
            const ws = createWriteStream(target);
            readStream.pipe(ws);
            ws.on('finish', () => {
              extracted.push(target);
              zip.readEntry();
            });
            ws.on('error', (werr) => {
              console.error('[parse-trace] write error:', target, werr);
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      })
      .catch(reject);
  });
}

async function readJsonLines(filePath: string, onLine: (obj: unknown) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';
    stream.on('data', (chunk: string | Buffer) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          onLine(JSON.parse(trimmed));
        } catch {
          /* swallow malformed lines */
        }
      }
    });
    stream.on('end', () => {
      const trimmed = buffer.trim();
      if (trimmed) {
        try {
          onLine(JSON.parse(trimmed));
        } catch {
          /* noop */
        }
      }
      resolve();
    });
    stream.on('error', reject);
  });
}

function isSnapshotEvent(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type : '';
  return type === 'frame-snapshot' || type === 'dom-snapshot' || type.includes('snapshot');
}

function findTraceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith('.trace')) {
        out.push(full);
      }
    }
  }
  return out;
}

function findViewportDirs(rootDir: string): string[] {
  const out: string[] = [];
  if (!existsSync(rootDir)) return out;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(rootDir, entry.name);
    if (existsSync(join(dir, 'trace.zip'))) out.push(dir);
  }
  return out;
}

async function processViewport(viewportDir: string): Promise<{ name: string; snapshots: number; errors: number }> {
  const name = viewportDir.split('/').pop() ?? 'unknown';
  const zipPath = join(viewportDir, 'trace.zip');
  const parsedDir = join(viewportDir, 'parsed');
  const unpackedDir = join(parsedDir, 'trace-unpacked');
  mkdirSync(unpackedDir, { recursive: true });

  let errors = 0;

  try {
    await extractZip(zipPath, unpackedDir);
  } catch (err) {
    console.error(`[parse-trace] extract failed for ${name}:`, err instanceof Error ? err.message : err);
    return { name, snapshots: 0, errors: 1 };
  }

  const traceFiles = findTraceFiles(unpackedDir);
  const outPath = join(parsedDir, 'dom-snapshots.jsonl');
  const ws = createWriteStream(outPath, { encoding: 'utf8' });
  let snapshotCount = 0;

  for (const tf of traceFiles) {
    try {
      await readJsonLines(tf, (obj) => {
        if (isSnapshotEvent(obj)) {
          ws.write(JSON.stringify(obj) + '\n');
          snapshotCount++;
        }
      });
    } catch (err) {
      errors++;
      console.error(`[parse-trace] read failed for ${tf}:`, err instanceof Error ? err.message : err);
    }
  }

  await new Promise<void>((resolve) => ws.end(resolve));

  writeFileSync(
    join(parsedDir, 'trace-manifest.json'),
    JSON.stringify({ viewport: name, traceFiles: traceFiles.length, snapshots: snapshotCount, errors }, null, 2)
  );

  return { name, snapshots: snapshotCount, errors };
}

export async function parseTraceMain(argv: string[]): Promise<number> {
  const arg = argv[0];
  if (!arg) {
    console.error('Usage: tsx scripts/parse-trace.ts <captures-dir>');
    return 1;
  }
  if (!existsSync(arg) || !statSync(arg).isDirectory()) {
    console.error(`Not a directory: ${arg}`);
    return 1;
  }

  const dirs = findViewportDirs(arg);
  if (dirs.length === 0) {
    console.error(`No <viewport>/trace.zip found under ${arg}`);
    return 1;
  }

  console.log(`Parsing ${dirs.length} trace archive(s)...`);
  for (const d of dirs) {
    const res = await processViewport(d);
    console.log(`  [${res.errors ? 'WARN' : 'OK '}] ${res.name.padEnd(8)} snapshots=${res.snapshots} errors=${res.errors}`);
  }
  return 0;
}

const isDirect = process.argv[1] && process.argv[1].endsWith('parse-trace.ts');
if (isDirect) {
  parseTraceMain(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('[parse-trace] fatal:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
