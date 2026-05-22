#!/usr/bin/env tsx
/**
 * Asset completer.
 *
 * Scans every captured CSS file under <capture>/<viewport>/parsed/ for
 * url(...) and @import references that resolve to absolute URLs not
 * already present in the captured index. For each missing URL, fetches
 * the resource and writes it into the matching parsed/{styles,scripts,assets}
 * folder so the downstream clone step picks it up.
 *
 * Usage:
 *   tsx scripts/complete-assets.ts <capture-dir> [--viewport=<name>]
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

import { collectHtmlAssetCandidates } from '../engine/extract/asset-inventory/from-html';

type CliArgs = {
  captureDir?: string;
  viewport?: string;
  help: boolean;
};

type IndexRow = {
  url: string;
  status: number;
  size: number;
  mimeType: string;
  file: string;
};

type FailureRow = {
  url: string;
  file: string;
  reason: string;
};

const HELP_TEXT = `
dr-parity complete-assets

Usage:
  tsx scripts/complete-assets.ts <capture-dir> [--viewport=<name>]
`.trim();

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 10_000;
const CONCURRENCY = 6;
/**
 * Per-viewport candidate cap. Image-heavy origins (apple.com, news, e-com)
 * routinely emit several hundred unrequested srcset siblings per page.
 * Cap is generous enough for them while still preventing runaway scans
 * on pathological pages.
 */
const MAX_CANDIDATES = 2000;

const URL_FUNC_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const AT_IMPORT_BARE_RE = /@import\s+(['"])([^'"]+)\1/g;
const AT_IMPORT_URL_RE = /@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { help: false };
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      out.viewport = raw.slice('--viewport='.length).trim();
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    positional.push(raw);
  }
  out.captureDir = positional[0];
  return out;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

type Category = 'styles' | 'scripts' | 'assets' | null;

function classifyMime(mimeType: string): Category {
  const m = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (m === 'text/css') return 'styles';
  if (
    m === 'application/javascript' ||
    m === 'text/javascript' ||
    m === 'application/x-javascript'
  ) {
    return 'scripts';
  }
  if (
    m.startsWith('image/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/') ||
    m.startsWith('font/') ||
    m === 'application/font-woff' ||
    m === 'application/font-woff2' ||
    m === 'application/x-font-ttf' ||
    m === 'application/vnd.ms-fontobject'
  ) {
    return 'assets';
  }
  return null;
}

function extFromMimeOrUrl(url: string, mimeType: string): string {
  const m = (mimeType || '').toLowerCase().split(';')[0].trim();
  const mimeExt: Record<string, string> = {
    'text/css': 'css',
    'application/javascript': 'js',
    'text/javascript': 'js',
    'application/x-javascript': 'js',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
  };
  if (mimeExt[m]) return mimeExt[m];
  try {
    const p = new URL(url).pathname;
    const e = extname(p).replace(/^\./, '');
    if (e) return e;
  } catch {
    /* noop */
  }
  return 'bin';
}

function findViewportDirs(captureDir: string, viewportFilter?: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(captureDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (viewportFilter && e.name !== viewportFilter) continue;
    const parsedDir = join(captureDir, e.name, 'parsed');
    const stylesIdx = join(parsedDir, 'styles', 'index.json');
    if (existsSync(stylesIdx)) out.push(join(captureDir, e.name));
  }
  return out;
}

function extractCssRefs(css: string): string[] {
  const refs = new Set<string>();
  for (const match of css.matchAll(URL_FUNC_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  for (const match of css.matchAll(AT_IMPORT_BARE_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  for (const match of css.matchAll(AT_IMPORT_URL_RE)) {
    const v = (match[2] ?? '').trim();
    if (v) refs.add(v);
  }
  return Array.from(refs);
}

function shouldSkipRef(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (!raw || lower.startsWith('data:')) return true;
  if (lower.startsWith('blob:')) return true;
  if (lower.startsWith('javascript:')) return true;
  if (raw.startsWith('#')) return true;
  return false;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

type CandidateContext = { url: string; sourceFile: string };

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

async function completeForViewport(viewportDir: string): Promise<{
  fetched: number;
  failed: number;
}> {
  const parsedDir = join(viewportDir, 'parsed');
  const stylesDir = join(parsedDir, 'styles');
  const scriptsDir = join(parsedDir, 'scripts');
  const assetsDir = join(parsedDir, 'assets');
  const stylesIdxPath = join(stylesDir, 'index.json');
  const scriptsIdxPath = join(scriptsDir, 'index.json');
  const assetsIdxPath = join(assetsDir, 'index.json');

  if (!existsSync(stylesIdxPath)) return { fetched: 0, failed: 0 };

  const stylesIdx = readJson<IndexRow[]>(stylesIdxPath);
  const scriptsIdx = existsSync(scriptsIdxPath) ? readJson<IndexRow[]>(scriptsIdxPath) : [];
  const assetsIdx = existsSync(assetsIdxPath) ? readJson<IndexRow[]>(assetsIdxPath) : [];

  const known = new Set<string>();
  for (const row of [...stylesIdx, ...scriptsIdx, ...assetsIdx]) {
    if (row.url) known.add(row.url);
  }

  const candidates = new Map<string, CandidateContext>();
  for (const css of stylesIdx) {
    if (!existsSync(css.file)) continue;
    const text = readFileSync(css.file, 'utf8');
    const refs = extractCssRefs(text);
    for (const ref of refs) {
      if (shouldSkipRef(ref)) continue;
      let abs: string;
      try {
        abs = new URL(ref, css.url).toString();
      } catch {
        continue;
      }
      const lower = abs.toLowerCase();
      if (!lower.startsWith('http:') && !lower.startsWith('https:')) continue;
      if (known.has(abs)) continue;
      if (candidates.has(abs)) continue;
      candidates.set(abs, { url: abs, sourceFile: css.file });
    }
  }

  // Walk the parsed HTML for image / media / preload references the
  // browser never actually requested (typically srcset siblings outside
  // the captured viewport's <picture> match). Capability-detected:
  // trips only when parsed/document.html and document.url both exist.
  const documentHtmlPath = join(parsedDir, 'document.html');
  const documentUrlPath = join(parsedDir, 'document.url');
  if (existsSync(documentHtmlPath) && existsSync(documentUrlPath)) {
    try {
      const documentHtml = readFileSync(documentHtmlPath, 'utf8');
      const documentUrl = readFileSync(documentUrlPath, 'utf8').trim();
      if (documentUrl) {
        const htmlCandidates = collectHtmlAssetCandidates({
          html: documentHtml,
          documentUrl,
        });
        for (const abs of htmlCandidates) {
          if (known.has(abs)) continue;
          if (candidates.has(abs)) continue;
          candidates.set(abs, { url: abs, sourceFile: documentHtmlPath });
        }
      }
    } catch (err) {
      console.warn(
        `  [WARN] HTML asset inventory failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (candidates.size === 0) return { fetched: 0, failed: 0 };
  if (candidates.size > MAX_CANDIDATES) {
    console.warn(
      `  [WARN] ${candidates.size} candidates exceeds cap ${MAX_CANDIDATES}; skipping completer for this viewport`
    );
    return { fetched: 0, failed: 0 };
  }

  mkdirSync(stylesDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  const failures: FailureRow[] = [];
  let fetched = 0;

  const items = Array.from(candidates.values());
  await runWithConcurrency(items, CONCURRENCY, async (cand) => {
    try {
      const res = await fetchWithTimeout(cand.url);
      if (!res.ok) {
        failures.push({
          url: cand.url,
          file: cand.sourceFile,
          reason: `HTTP ${res.status}`,
        });
        console.warn(`  [WARN] fetch ${cand.url} -> HTTP ${res.status}`);
        return;
      }
      const mimeType = res.headers.get('content-type') ?? '';
      const category = classifyMime(mimeType);
      if (!category) {
        failures.push({
          url: cand.url,
          file: cand.sourceFile,
          reason: `unsupported MIME: ${mimeType || '<empty>'}`,
        });
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const size = buf.byteLength;
      const ext = extFromMimeOrUrl(cand.url, mimeType);
      const hash = shortHash(cand.url);
      const dir = category === 'styles' ? stylesDir : category === 'scripts' ? scriptsDir : assetsDir;
      const file = join(dir, `${hash}.${ext}`);
      writeFileSync(file, buf);
      const row: IndexRow = { url: cand.url, status: res.status, size, mimeType, file };
      if (category === 'styles') stylesIdx.push(row);
      else if (category === 'scripts') scriptsIdx.push(row);
      else assetsIdx.push(row);
      fetched += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ url: cand.url, file: cand.sourceFile, reason });
      console.warn(`  [WARN] fetch ${cand.url} failed: ${reason}`);
    }
  });

  writeFileSync(stylesIdxPath, JSON.stringify(stylesIdx, null, 2));
  writeFileSync(scriptsIdxPath, JSON.stringify(scriptsIdx, null, 2));
  writeFileSync(assetsIdxPath, JSON.stringify(assetsIdx, null, 2));
  if (failures.length > 0) {
    writeFileSync(
      join(parsedDir, 'completer-failures.json'),
      JSON.stringify(failures, null, 2)
    );
  }
  return { fetched, failed: failures.length };
}

export async function completeAssetsMain(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(HELP_TEXT);
    return 2;
  }
  if (args.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (!args.captureDir) {
    console.error('Missing <capture-dir> positional argument.');
    console.error(HELP_TEXT);
    return 2;
  }
  if (!existsSync(args.captureDir) || !statSync(args.captureDir).isDirectory()) {
    console.error(`Not a directory: ${args.captureDir}`);
    return 2;
  }

  const viewportDirs = findViewportDirs(args.captureDir, args.viewport);
  if (viewportDirs.length === 0) {
    console.warn(`No viewport dirs with parsed/styles/index.json under ${args.captureDir}`);
    return 0;
  }

  for (const vp of viewportDirs) {
    const name = vp.split('/').pop() ?? vp;
    try {
      const result = await completeForViewport(vp);
      console.log(`  [OK]  ${name.padEnd(8)} fetched=${result.fetched} failed=${result.failed}`);
    } catch (err) {
      console.error(`  [ERR] ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return 0;
}

const isDirect = process.argv[1] && process.argv[1].endsWith('complete-assets.ts');
if (isDirect) {
  completeAssetsMain(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    }
  );
}
