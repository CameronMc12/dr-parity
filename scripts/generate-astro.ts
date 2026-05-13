#!/usr/bin/env tsx
/**
 * Emit the production Astro static-first clone.
 *
 * Usage:
 *   npx tsx scripts/generate-astro.ts
 *   npx tsx scripts/generate-astro.ts --input docs/research --output clone-astro
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { PageData } from '../engine/types/extraction';
import { extractDesignTokens } from '../engine/analyze/design-tokens';
import { buildTopology } from '../engine/analyze/topology';
import { buildComponentTree } from '../engine/analyze/component-tree';
import { renderAstro, type Analysis } from '../engine/generate/astro/renderer';

interface CliArgs {
  inputDir: string;
  outputDir: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let inputDir = 'docs/research';
  let outputDir = 'clone-astro';

  const inIdx = args.indexOf('--input');
  if (inIdx !== -1 && args[inIdx + 1]) inputDir = args[inIdx + 1];

  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) outputDir = args[outIdx + 1];

  return { inputDir, outputDir };
}

async function main(): Promise<void> {
  const { inputDir, outputDir } = parseArgs();

  const pageDataPath = resolve(join(inputDir, 'page-data.json'));
  if (!existsSync(pageDataPath)) {
    console.error(`Error: ${pageDataPath} not found. Run extract.ts first.`);
    process.exit(1);
  }

  const pageData = JSON.parse(await readFile(pageDataPath, 'utf-8')) as PageData;

  let analysis: Analysis;
  const analysisPath = resolve(join(inputDir, 'analysis.json'));
  if (existsSync(analysisPath)) {
    analysis = JSON.parse(await readFile(analysisPath, 'utf-8')) as Analysis;
  } else {
    analysis = {
      tokens: extractDesignTokens(pageData),
      topology: buildTopology(pageData),
      componentTree: buildComponentTree(pageData),
    };
  }

  const result = renderAstro({ pageData, analysis });

  const outAbs = resolve(outputDir);
  await rm(outAbs, { recursive: true, force: true });
  await mkdir(outAbs, { recursive: true });

  const written: string[] = [];
  for (const [relPath, contents] of Object.entries(result.files)) {
    const fullPath = join(outAbs, relPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, 'utf-8');
    written.push(fullPath);
  }

  for (const f of written) console.log(`wrote ${f}`);
  console.log('');
  console.log(`next: cd ${outputDir} && npm install && npm run dev`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
