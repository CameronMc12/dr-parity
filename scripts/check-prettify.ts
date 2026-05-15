#!/usr/bin/env tsx
/**
 * Roundtrip validation for the emit-time prettify pass.
 *
 * Strategy:
 *   1. Take a representative set of `.astro` fixtures (synthetic + the most
 *      recent real test output under clone-enerblock/src/).
 *   2. Prettify each source.
 *   3. Re-parse the prettified output and assert AST equivalence with the
 *      original (modulo whitespace + attribute order + quote style).
 *   4. Fail loudly with file + first divergence if any drift is detected.
 *
 * Run via:
 *   npm run check:prettify
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { prettifyAstro, structurallyEquivalent } from '../engine/astro/prettify';

interface CaseResult {
  label: string;
  status: 'ok' | 'unchanged' | 'parser-skip' | 'fail';
  reason?: string;
}

const SYNTHETIC_CASES: { label: string; source: string }[] = [
  {
    label: 'minimal-section',
    source: `<section class="hero"><div class="wrp"><h1>Hello world</h1><p>Body copy here that is long enough to wrap.</p></div></section>\n`,
  },
  {
    label: 'frontmatter-and-body',
    source: `---
const title = 'Test';
---
<section class="hero" data-anim="hero"><div class="wrp"><div class="grid"><h1>Heading</h1><p>Long paragraph that should wrap when prettified at width 100.</p><a href="/contact" class="btn btn--primary">Get in touch</a></div></div></section>
<style>.hero { color: red; }</style>
`,
  },
  {
    label: 'inline-script-and-style',
    source: `---
---
<section><div><script is:inline>console.log('hi');</script><style is:inline>.x{color:blue;}</style></div></section>
`,
  },
  {
    label: 'preserves-attribute-set',
    source: `<a href="/path" class="btn btn--lg" data-x="1" aria-label="Open menu" target="_blank" rel="noopener">Open menu now</a>\n`,
  },
];

function collectAstro(rootDir: string): string[] {
  const files: string[] = [];
  if (!existsSync(rootDir)) return files;
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (entry.endsWith('.astro')) files.push(full);
    }
  }
  return files;
}

async function runCase(label: string, source: string): Promise<CaseResult> {
  const result = await prettifyAstro(source);
  if (!result.changed) {
    if (result.fallback === 'roundtrip-mismatch') {
      // Real failure: prettier ran cleanly but the output AST drifted.
      return { label, status: 'fail', reason: result.fallback };
    }
    if (result.fallback === 'prettier-error') {
      // Safe fallback: prettier could not parse this file's Astro JSX, and
      // we kept the original byte-for-byte. Zero parity loss.
      return { label, status: 'parser-skip', reason: result.fallback };
    }
    return { label, status: 'unchanged' };
  }
  if (!structurallyEquivalent(source, result.output)) {
    return { label, status: 'fail', reason: 'roundtrip drift after prettify' };
  }
  return { label, status: 'ok' };
}

async function main(): Promise<void> {
  const results: CaseResult[] = [];

  for (const c of SYNTHETIC_CASES) {
    results.push(await runCase(c.label, c.source));
  }

  // Pull the most recent real output (clone-enerblock) — verifies the pass
  // works against captured production-shaped HTML, not just toy fixtures.
  const repoRoot = process.cwd();
  const realRoot = join(repoRoot, 'clone-enerblock', 'src');
  const realFiles = collectAstro(realRoot);
  for (const file of realFiles) {
    const source = readFileSync(file, 'utf8');
    results.push(await runCase(file.replace(repoRoot + '/', ''), source));
  }

  const failed = results.filter((r) => r.status === 'fail');
  const ok = results.filter((r) => r.status === 'ok');
  const unchanged = results.filter((r) => r.status === 'unchanged');
  const parserSkip = results.filter((r) => r.status === 'parser-skip');

  process.stdout.write(`check:prettify\n`);
  process.stdout.write(`  cases       : ${results.length}\n`);
  process.stdout.write(`  ok          : ${ok.length}\n`);
  process.stdout.write(`  unchanged   : ${unchanged.length}\n`);
  process.stdout.write(`  parser-skip : ${parserSkip.length} (kept original, zero drift)\n`);
  process.stdout.write(`  failed      : ${failed.length}\n`);

  if (failed.length > 0) {
    process.stdout.write(`\nFAILURES:\n`);
    for (const f of failed) {
      process.stdout.write(`  - ${f.label}: ${f.reason}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack ?? err.message : err}\n`);
  process.exit(1);
});
