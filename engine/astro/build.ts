/**
 * Top-level build orchestrator: validate inputs, copy assets, slice the
 * captured HTML, and write the Astro project.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as cheerio from 'cheerio';

import { extractHead } from './extract-head';
import { sliceBody } from './slice-body';
import { writeComponent, writeLayout, writePage } from './emit';
import { writeScaffold } from './scaffold';
import type { BuildOptions, BuildSummary } from './types';

const SKIP_FILES = new Set(['index.html', 'manifest.json']);

export function validateCloneDir(cloneDir: string): void {
  const abs = resolve(cloneDir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`Clone directory not found: ${abs}`);
  }
  if (!existsSync(join(abs, 'index.html'))) {
    throw new Error(`Clone is missing index.html: ${abs}`);
  }
  if (!existsSync(join(abs, 'manifest.json'))) {
    throw new Error(`Clone is missing manifest.json: ${abs}`);
  }
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

function copyAssetsToPublic(cloneDir: string, publicDir: string): { count: number; bytes: number } {
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

export function buildAstroProject(options: BuildOptions): BuildSummary {
  const { cloneDir, outDir, name, force } = options;
  const absClone = resolve(cloneDir);
  const absOut = resolve(outDir);

  if (absOut === absClone || absOut.startsWith(absClone + '/')) {
    throw new Error('Refusing to write into the clone directory itself.');
  }

  validateCloneDir(absClone);

  if (existsSync(absOut)) {
    if (!force) {
      throw new Error(`Output directory already exists: ${absOut} (pass --force to overwrite)`);
    }
  }

  mkdirSync(absOut, { recursive: true });

  const publicDir = join(absOut, 'public');
  const assetStats = copyAssetsToPublic(absClone, publicDir);

  const html = readFileSync(join(absClone, 'index.html'), 'utf8');
  const $ = cheerio.load(html, null, true);

  const head = extractHead($);
  const { components, pageImports } = sliceBody($);

  const layoutsDir = join(absOut, 'src', 'layouts');
  const componentsDir = join(absOut, 'src', 'components');
  const pagesDir = join(absOut, 'src', 'pages');

  const summary: BuildSummary = {
    components: [],
    assetCount: assetStats.count,
    assetBytes: assetStats.bytes,
  };

  const layoutEntry = writeLayout(layoutsDir, head);
  summary.components.push(layoutEntry);

  for (const comp of components) {
    summary.components.push(writeComponent(componentsDir, comp));
  }

  const pageEntry = writePage({
    pagesDir,
    pageImports,
    title: head.title,
    description: head.description,
  });
  summary.components.push(pageEntry);

  writeScaffold(absOut, name);

  return summary;
}
