#!/usr/bin/env tsx
/**
 * Run the prototype renderer against the in-tree fixture.
 *
 *   npx tsx engine/generate/prototype/__fixtures__/run-fixture.ts
 *
 * Writes to `clone-prototype-fixture/` at the repo root so you can:
 *   open clone-prototype-fixture/*.html
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PageData } from '../../../types/extraction';
import { renderPrototype, type Analysis } from '../renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const pageDataPath = join(__dirname, 'sample-page-data.json');
  const analysisPath = join(__dirname, 'sample-analysis.json');

  const pageData = JSON.parse(await readFile(pageDataPath, 'utf-8')) as PageData;
  const analysis = JSON.parse(await readFile(analysisPath, 'utf-8')) as Analysis;

  const result = renderPrototype({ pageData, analysis, designName: 'sample' });

  const outDir = resolve(join(__dirname, '..', '..', '..', '..', 'clone-prototype-fixture'));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const [rel, contents] of Object.entries(result.files)) {
    const full = join(outDir, rel);
    await writeFile(full, contents, 'utf-8');
    console.log(`wrote ${full}`);
  }

  console.log('');
  console.log(`next: open ${join(outDir, result.entryHtml)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
