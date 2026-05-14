#!/usr/bin/env tsx
/**
 * Static 1:1 clone builder.
 *
 * Reads a capture dir produced by parse-har + parse-trace and emits a
 * runnable static clone per viewport at <capture>/<viewport>/clone/.
 *
 * Usage:
 *   tsx scripts/clone.ts <capture-dir> [--viewport=desktop[,...]] [--out=<dir>]
 */

import { readFileSync, existsSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildUrlMap } from '../engine/clone/url-map';
import { rewriteHtml } from '../engine/clone/html-rewriter';
import { rewriteCss } from '../engine/clone/css-rewriter';
import { copyMappedFiles, ensureDir, writeManifest, writeText } from '../engine/clone/asset-copier';
import type {
  CloneManifest,
  CloneStats,
  ParsedIndexEntry,
  ViewportCloneResult,
} from '../engine/clone/types';

type CliArgs = {
  captureDir?: string;
  viewports?: string[];
  out?: string;
  help: boolean;
};

const HELP_TEXT = `
dr-parity clone

Usage:
  tsx scripts/clone.ts <capture-dir> [options]

Options:
  --viewport=<list>  Comma-separated viewport names. Default: every viewport found.
  --out=<dir>        Override clone output root (default: <capture>/<viewport>/clone).
  -h, --help         Show this help.
`.trim();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { help: false };
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      out.viewports = raw
        .slice('--viewport='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
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
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse JSON at ${path}: ${err instanceof Error ? err.message : err}`
    );
  }
}

function discoverViewports(captureDir: string, requested?: string[]): string[] {
  const entries = readdirSync(captureDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(captureDir, name, 'parsed', 'document.html')));
  if (!requested || requested.length === 0) return entries;
  const set = new Set(entries);
  const missing = requested.filter((v) => !set.has(v));
  if (missing.length) {
    throw new Error(
      `Requested viewport(s) not present in capture dir: ${missing.join(', ')}. Have: ${entries.join(', ') || '<none>'}`
    );
  }
  return requested;
}

function cloneOneViewport(args: {
  parsedDir: string;
  cloneRoot: string;
  viewport: string;
}): CloneStats {
  const documentHtmlPath = join(args.parsedDir, 'document.html');
  const documentUrlPath = join(args.parsedDir, 'document.url');
  if (!existsSync(documentHtmlPath)) {
    throw new Error(`Missing document.html at ${documentHtmlPath}`);
  }
  if (!existsSync(documentUrlPath)) {
    throw new Error(`Missing document.url at ${documentUrlPath}`);
  }
  const documentUrl = readFileSync(documentUrlPath, 'utf8').trim();
  if (!documentUrl) {
    throw new Error(`Empty document.url at ${documentUrlPath}`);
  }

  const styles = readJson<ParsedIndexEntry[]>(join(args.parsedDir, 'styles', 'index.json'));
  const scripts = readJson<ParsedIndexEntry[]>(join(args.parsedDir, 'scripts', 'index.json'));
  const assets = readJson<ParsedIndexEntry[]>(join(args.parsedDir, 'assets', 'index.json'));

  const urlMap = buildUrlMap({ documentUrl, styles, scripts, assets });
  const unresolved = new Set<string>();

  ensureDir(args.cloneRoot);
  copyMappedFiles({ cloneRoot: args.cloneRoot, urlMap });

  for (const entry of urlMap.values()) {
    if (entry.bucket !== 'styles') continue;
    const dest = join(args.cloneRoot, entry.cloneRelPath);
    if (!existsSync(dest)) continue;
    const css = readFileSync(dest, 'utf8');
    const rewritten = rewriteCss({
      css,
      cssSourceUrl: findUrlByEntry(urlMap, entry.cloneRelPath) ?? documentUrl,
      ownClonePath: entry.cloneRelPath,
      urlMap,
      unresolved,
    });
    writeFileSync(dest, rewritten, 'utf8');
  }

  const html = readFileSync(documentHtmlPath, 'utf8');
  const rewrittenHtml = rewriteHtml({
    html,
    documentUrl,
    ownClonePath: 'index.html',
    urlMap,
    unresolved,
  });
  const htmlPath = join(args.cloneRoot, 'index.html');
  const htmlBytes = writeText(htmlPath, rewrittenHtml);

  const stats: CloneStats = {
    viewport: args.viewport,
    htmlBytes,
    styles: styles.length,
    scripts: scripts.length,
    assets: assets.length,
    unresolvedExternal: unresolved.size,
    unresolvedSample: Array.from(unresolved).slice(0, 25),
  };
  const manifest: CloneManifest = {
    ...stats,
    documentUrl,
    generatedAt: new Date().toISOString(),
  };
  writeManifest(args.cloneRoot, manifest);
  return stats;
}

function findUrlByEntry(
  urlMap: ReturnType<typeof buildUrlMap>,
  cloneRelPath: string
): string | null {
  for (const [url, entry] of urlMap.entries()) {
    if (entry.cloneRelPath === cloneRelPath) return url;
  }
  return null;
}

function summary(rows: ViewportCloneResult[]): void {
  const widths = { vp: 10, html: 12, css: 6, js: 6, asset: 7, unres: 11 };
  const head =
    'viewport'.padEnd(widths.vp) +
    'html'.padStart(widths.html) +
    'css'.padStart(widths.css) +
    'js'.padStart(widths.js) +
    'assets'.padStart(widths.asset) +
    'unresolved'.padStart(widths.unres);
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const row of rows) {
    if (!row.ok) {
      console.log(`${row.viewport.padEnd(widths.vp)} ERROR: ${row.error}`);
      continue;
    }
    const s = row.stats;
    console.log(
      s.viewport.padEnd(widths.vp) +
        String(s.htmlBytes).padStart(widths.html) +
        String(s.styles).padStart(widths.css) +
        String(s.scripts).padStart(widths.js) +
        String(s.assets).padStart(widths.asset) +
        String(s.unresolvedExternal).padStart(widths.unres)
    );
  }
}

function main(): number {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
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

  let viewports: string[];
  try {
    viewports = discoverViewports(args.captureDir, args.viewports);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }
  if (viewports.length === 0) {
    console.error(
      `No viewports with parsed/document.html found under ${args.captureDir}. Did you run parse:har?`
    );
    return 2;
  }

  const results: ViewportCloneResult[] = [];
  for (const vp of viewports) {
    const parsedDir = join(args.captureDir, vp, 'parsed');
    const cloneRoot = args.out ?? join(args.captureDir, vp, 'clone');
    try {
      const stats = cloneOneViewport({ parsedDir, cloneRoot, viewport: vp });
      results.push({ ok: true, stats, viewport: vp });
      console.log(`  [OK]  ${vp}: clone -> ${cloneRoot}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ok: false, viewport: vp, error: message });
      console.error(`  [ERR] ${vp}: ${message}`);
    }
  }

  console.log('');
  summary(results);

  const allFailed = results.every((r) => !r.ok);
  return allFailed ? 1 : 0;
}

process.exit(main());
