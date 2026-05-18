#!/usr/bin/env tsx
/**
 * CLI: centralise editable copy from section components into src/content/site.ts.
 *
 * Usage:
 *   tsx scripts/centralize-content.ts <out-dir>
 *
 * Where <out-dir> is the root of an Astro project containing
 * src/components/sections/*.astro.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { centralizeContent } from '../engine/targets/astro/centralize-content';

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write('Usage: tsx scripts/centralize-content.ts <out-dir>\n');
    process.exit(2);
  }
  const outDir = isAbsolute(arg) ? arg : resolve(arg);
  if (!existsSync(outDir)) {
    process.stderr.write(`Output directory does not exist: ${outDir}\n`);
    process.exit(2);
  }

  const summary = await centralizeContent(outDir);
  process.stdout.write(`centralize-content\n`);
  process.stdout.write(`  sections scanned : ${summary.sectionsScanned}\n`);
  process.stdout.write(`  fields extracted : ${summary.fieldsExtracted}\n`);
  process.stdout.write(`  files rewritten  : ${summary.filesRewritten}\n`);
  if (summary.contentFile) {
    process.stdout.write(`  content file     : ${summary.contentFile}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack ?? err.message : err}\n`);
  process.exit(1);
});
