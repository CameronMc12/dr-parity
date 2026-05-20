/**
 * Top-level build orchestrator: validate inputs, copy assets, slice the
 * captured HTML, and write the Astro project.
 *
 * Head extraction, body slicing, and asset copying are delegated to the
 * shared (target-agnostic) layer. This file owns the Astro-specific emit,
 * scaffold, and prettify steps.
 */

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as cheerio from 'cheerio';

import { extractHead, sliceBody, copyAssetsToPublic } from '../shared';
import { writeComponent, writeLayout, writePage } from './emit';
import { prettifyEmittedDir } from './prettify';
import { writeScaffold, writeSeoConfigs } from './scaffold';
import type { BuildOptions, BuildSummary } from './types';

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

export async function buildAstroProject(options: BuildOptions): Promise<BuildSummary> {
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
  writeSeoConfigs(absOut, { title: head.title, description: head.description });

  // Emit-time prettify pass — runs across every .astro file emitted into the
  // project. Roundtrip-safe: any file whose prettified output drifts from
  // the original AST is silently reverted. Set DR_PARITY_NO_PRETTIFY=1 to
  // bypass entirely (escape hatch for problem fixtures).
  const srcDir = join(absOut, 'src');
  const prettifySummary = await prettifyEmittedDir(srcDir);
  if (prettifySummary.failures.length > 0) {
    for (const f of prettifySummary.failures) {
      process.stderr.write(`prettify: skipped ${f.file} (${f.reason})\n`);
    }
  }

  return summary;
}
