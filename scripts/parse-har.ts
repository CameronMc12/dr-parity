#!/usr/bin/env tsx
/**
 * Parse all <viewport>/network.har files under a captures dir into
 * structured asset folders: parsed/styles, parsed/scripts, parsed/assets.
 *
 * Usage: tsx scripts/parse-har.ts <captures-dir>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import mime from 'mime';

type HarEntry = {
  request?: { url?: string };
  response?: {
    status?: number;
    content?: {
      mimeType?: string;
      text?: string;
      encoding?: string;
      size?: number;
    };
  };
};

type Har = {
  log?: { entries?: HarEntry[] };
};

type ManualEntry = {
  url: string;
  status: number;
  mimeType: string;
  headers?: Record<string, string>;
  bodyBase64: string | null;
  bodyError?: string;
};

type ManualNetworkFile = {
  format?: string;
  entries?: ManualEntry[];
};

function manualToHarEntries(file: ManualNetworkFile): HarEntry[] {
  const entries = file.entries ?? [];
  return entries.map((e) => ({
    request: { url: e.url },
    response: {
      status: e.status,
      content:
        e.bodyBase64 === null
          ? { mimeType: e.mimeType }
          : { mimeType: e.mimeType, text: e.bodyBase64, encoding: 'base64' },
    },
  }));
}

type Category = 'styles' | 'scripts' | 'assets' | 'document' | 'skip';

type IndexRow = {
  url: string;
  status: number;
  size: number;
  mimeType: string;
  file: string;
};

type Manifest = {
  viewport: string;
  counts: Record<string, number>;
  bytes: Record<string, number>;
  skipped: number;
};

function classify(mimeType: string): Category {
  const m = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (m === 'text/css') return 'styles';
  if (
    m === 'application/javascript' ||
    m === 'text/javascript' ||
    m === 'application/x-javascript' ||
    m.startsWith('module/')
  ) {
    return 'scripts';
  }
  if (m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/') || m.startsWith('font/')) {
    return 'assets';
  }
  if (m === 'text/html') return 'document';
  return 'skip';
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

function extFromUrlOrMime(url: string, mimeType: string): string {
  try {
    const u = new URL(url);
    const pathExt = extname(u.pathname).replace(/^\./, '');
    if (pathExt) return pathExt;
  } catch {
    /* noop */
  }
  const fromMime = mime.getExtension(mimeType.split(';')[0].trim());
  return fromMime ?? 'bin';
}

function decodeContent(text: string | undefined, encoding: string | undefined): Buffer {
  if (text === undefined) return Buffer.alloc(0);
  if (encoding === 'base64') return Buffer.from(text, 'base64');
  return Buffer.from(text, 'utf8');
}

type NetworkSource = { kind: 'har' | 'manual'; path: string };

function findNetworkDirs(rootDir: string): { dir: string; source: NetworkSource }[] {
  const out: { dir: string; source: NetworkSource }[] = [];
  if (!existsSync(rootDir)) return out;
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(rootDir, entry.name);
    const harPath = join(dir, 'network.har');
    const manualPath = join(dir, 'network.json');
    if (existsSync(harPath)) {
      out.push({ dir, source: { kind: 'har', path: harPath } });
    } else if (existsSync(manualPath)) {
      out.push({ dir, source: { kind: 'manual', path: manualPath } });
    }
  }
  return out;
}

function loadEntries(source: NetworkSource): HarEntry[] {
  const raw = readFileSync(source.path, 'utf8');
  if (source.kind === 'har') {
    let har: Har;
    try {
      har = JSON.parse(raw) as Har;
    } catch (err) {
      throw new Error(`Invalid HAR JSON at ${source.path}: ${err instanceof Error ? err.message : err}`);
    }
    return har.log?.entries ?? [];
  }
  let manual: ManualNetworkFile;
  try {
    manual = JSON.parse(raw) as ManualNetworkFile;
  } catch (err) {
    throw new Error(
      `Invalid network.json at ${source.path}: ${err instanceof Error ? err.message : err}`
    );
  }
  return manualToHarEntries(manual);
}

function parseNetworkFile(source: NetworkSource, parsedDir: string, viewportName: string): Manifest {
  const entries = loadEntries(source);
  const stylesDir = join(parsedDir, 'styles');
  const scriptsDir = join(parsedDir, 'scripts');
  const assetsDir = join(parsedDir, 'assets');
  mkdirSync(stylesDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  const styleIndex: IndexRow[] = [];
  const scriptIndex: IndexRow[] = [];
  const assetIndex: IndexRow[] = [];
  const skipped: { url: string; status: number; reason: string }[] = [];

  let documentWritten = false;
  const counts: Record<string, number> = { styles: 0, scripts: 0, assets: 0, document: 0 };
  const bytes: Record<string, number> = { styles: 0, scripts: 0, assets: 0, document: 0 };

  for (const entry of entries) {
    const url = entry.request?.url ?? '';
    const status = entry.response?.status ?? 0;
    const content = entry.response?.content;
    const mimeType = content?.mimeType ?? '';

    if (status >= 400) {
      skipped.push({ url, status, reason: `status >= 400` });
      continue;
    }
    if (!content || content.text === undefined) {
      skipped.push({ url, status, reason: 'no content body' });
      continue;
    }

    const category = classify(mimeType);
    if (category === 'skip') continue;

    const buf = decodeContent(content.text, content.encoding);
    const size = buf.byteLength;

    if (category === 'document') {
      if (documentWritten) continue;
      writeFileSync(join(parsedDir, 'document.html'), buf);
      writeFileSync(join(parsedDir, 'document.url'), url, 'utf8');
      counts.document++;
      bytes.document += size;
      documentWritten = true;
      continue;
    }

    const hash = shortHash(url);
    if (category === 'styles') {
      const file = join(stylesDir, `${hash}.css`);
      writeFileSync(file, buf);
      styleIndex.push({ url, status, size, mimeType, file });
      counts.styles++;
      bytes.styles += size;
    } else if (category === 'scripts') {
      const file = join(scriptsDir, `${hash}.js`);
      writeFileSync(file, buf);
      scriptIndex.push({ url, status, size, mimeType, file });
      counts.scripts++;
      bytes.scripts += size;
    } else if (category === 'assets') {
      const ext = extFromUrlOrMime(url, mimeType);
      const file = join(assetsDir, `${hash}.${ext}`);
      writeFileSync(file, buf);
      assetIndex.push({ url, status, size, mimeType, file });
      counts.assets++;
      bytes.assets += size;
    }
  }

  writeFileSync(join(stylesDir, 'index.json'), JSON.stringify(styleIndex, null, 2));
  writeFileSync(join(scriptsDir, 'index.json'), JSON.stringify(scriptIndex, null, 2));
  writeFileSync(join(assetsDir, 'index.json'), JSON.stringify(assetIndex, null, 2));
  writeFileSync(join(parsedDir, 'skipped.json'), JSON.stringify(skipped, null, 2));

  const manifest: Manifest = {
    viewport: viewportName,
    counts,
    bytes,
    skipped: skipped.length,
  };
  writeFileSync(join(parsedDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function parseHarMain(argv: string[]): number {
  const arg = argv[0];
  if (!arg) {
    console.error('Usage: tsx scripts/parse-har.ts <captures-dir>');
    return 1;
  }
  if (!existsSync(arg) || !statSync(arg).isDirectory()) {
    console.error(`Not a directory: ${arg}`);
    return 1;
  }

  const found = findNetworkDirs(arg);
  if (found.length === 0) {
    console.error(`No <viewport>/network.har or network.json found under ${arg}`);
    return 1;
  }

  console.log(`Parsing ${found.length} network file(s)...`);
  for (const { dir, source } of found) {
    const parsedDir = join(dir, 'parsed');
    mkdirSync(parsedDir, { recursive: true });
    const viewportName = dir.split('/').pop() ?? 'unknown';
    try {
      const manifest = parseNetworkFile(source, parsedDir, viewportName);
      console.log(
        `  [OK]  ${viewportName.padEnd(8)} (${source.kind}) styles=${manifest.counts.styles} scripts=${manifest.counts.scripts} assets=${manifest.counts.assets} skipped=${manifest.skipped}`
      );
    } catch (err) {
      console.error(`  [ERR] ${viewportName}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return 0;
}

const isDirect = process.argv[1] && process.argv[1].endsWith('parse-har.ts');
if (isDirect) {
  process.exit(parseHarMain(process.argv.slice(2)));
}
