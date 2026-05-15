/**
 * Multi-page Astro build orchestrator.
 *
 * Reads N clone directories (one per crawled URL), slices each one, then
 * emits a single Astro project with:
 *   - src/components/shared/    -> components present on 2+ pages
 *   - src/components/<route>/   -> per-page sections
 *   - src/pages/<route>.astro   -> one page per crawled URL
 *
 * Reuses extractHead + sliceBody + writeScaffold from the single-page
 * pipeline so the underlying parser semantics stay identical.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as cheerio from 'cheerio';

import { extractHead } from './extract-head';
import { sliceBody } from './slice-body';
import { emitMultiPage, routeToPageName, type PageSlice } from './emit-multi';
import { prettifyEmittedDir } from './prettify';
import { writeScaffold, writeSeoConfigs } from './scaffold';

const SKIP_FILES = new Set(['index.html', 'manifest.json']);

export interface MultiPageInput {
  /** Path to a clone dir (must contain index.html + manifest.json). */
  cloneDir: string;
  /** Pathname for the original URL, e.g. "/", "/about". */
  pathname: string;
  /** Optional original full URL (for logging). */
  url?: string;
}

export interface MultiBuildOptions {
  pages: MultiPageInput[];
  outDir: string;
  name: string;
  force: boolean;
}

export interface MultiBuildSummary {
  pagesEmitted: string[];
  sharedComponents: string[];
  perPageComponents: number;
  assetCount: number;
  assetBytes: number;
}

function dirSizeBytes(dir: string): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else {
        count += 1;
        bytes += st.size;
      }
    }
  }
  return { count, bytes };
}

function copyAssetsToPublic(
  cloneDir: string,
  publicDir: string,
): { count: number; bytes: number } {
  mkdirSync(publicDir, { recursive: true });
  cpSync(cloneDir, publicDir, {
    recursive: true,
    filter: (src: string) => {
      const rel = relative(cloneDir, src);
      if (rel.length === 0) return true;
      const first = rel.split(/[\\/]/, 1)[0];
      if (SKIP_FILES.has(first)) return false;
      return true;
    },
  });
  return dirSizeBytes(publicDir);
}

export async function buildAstroMulti(
  options: MultiBuildOptions,
): Promise<MultiBuildSummary> {
  const { pages, outDir, name, force } = options;

  if (pages.length === 0) {
    throw new Error('buildAstroMulti: no pages provided');
  }

  const absOut = resolve(outDir);

  for (const p of pages) {
    const absClone = resolve(p.cloneDir);
    if (absOut === absClone || absOut.startsWith(absClone + '/')) {
      throw new Error('Refusing to write into a clone directory.');
    }
    if (!existsSync(join(absClone, 'index.html'))) {
      throw new Error(`Clone dir missing index.html: ${absClone}`);
    }
  }

  if (existsSync(absOut) && !force) {
    throw new Error(
      `Output directory already exists: ${absOut} (pass --force to overwrite)`,
    );
  }

  mkdirSync(absOut, { recursive: true });

  // Assets: copy from the homepage clone (its asset graph covers shared files).
  // If a later page introduces unique assets, layer them on top.
  const publicDir = join(absOut, 'public');
  let totalAssetCount = 0;
  let totalAssetBytes = 0;

  for (const page of pages) {
    const before = existsSync(publicDir) ? dirSizeBytes(publicDir) : { count: 0, bytes: 0 };
    copyAssetsToPublic(resolve(page.cloneDir), publicDir);
    const after = dirSizeBytes(publicDir);
    totalAssetCount = after.count;
    totalAssetBytes = after.bytes;
    // before/after diff is informational only; we keep cumulative totals.
    void before;
  }

  // Slice each page.
  const slices: PageSlice[] = pages.map((p) => {
    const html = readFileSync(join(resolve(p.cloneDir), 'index.html'), 'utf8');
    const $ = cheerio.load(html, null, true);
    const head = extractHead($);
    const { components, pageImports } = sliceBody($);
    const pageName = routeToPageName(p.pathname);
    return {
      route: p.pathname,
      pageName,
      head,
      components,
      pageImports,
    };
  });

  // Dedupe page names (collisions flatten to suffixed variants).
  const seen = new Map<string, number>();
  for (const slice of slices) {
    const count = (seen.get(slice.pageName) ?? 0) + 1;
    seen.set(slice.pageName, count);
    if (count > 1) {
      slice.pageName = `${slice.pageName}-${count}`;
    }
  }

  // Emit.
  const emitSummary = emitMultiPage({ outDir: absOut, pages: slices });

  // Scaffold (package.json, astro.config.mjs, etc.).
  writeScaffold(absOut, name);

  // Seed SEO + tracking config from the homepage's <head>. Skipped if files
  // already exist (rebuild-safe).
  const homepageHead = slices[0].head;
  writeSeoConfigs(absOut, {
    title: homepageHead.title,
    description: homepageHead.description,
  });

  // Prettify all emitted Astro files.
  const srcDir = join(absOut, 'src');
  const prettifySummary = await prettifyEmittedDir(srcDir);
  if (prettifySummary.failures.length > 0) {
    for (const f of prettifySummary.failures) {
      process.stderr.write(`prettify: skipped ${f.file} (${f.reason})\n`);
    }
  }

  return {
    pagesEmitted: emitSummary.pagesWritten,
    sharedComponents: emitSummary.sharedComponents,
    perPageComponents: emitSummary.perPageComponents,
    assetCount: totalAssetCount,
    assetBytes: totalAssetBytes,
  };
}
