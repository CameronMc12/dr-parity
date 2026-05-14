#!/usr/bin/env tsx
/**
 * Wave 2 token extractor.
 *
 * Consumes the JSON artifacts produced by scripts/extract-css.ts and emits a
 * deterministic, numerically named design-token system into the target
 * Astro project's styles directory.
 *
 * Usage:
 *   tsx scripts/extract-tokens.ts <analysis-dir> --out=<styles-out-dir> [--force]
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { CATEGORY_ORDER, type CategorisedTokens } from '../engine/tokens/types';
import {
  assertAnalysisDir,
  loadAnalysis,
  ValidationError,
} from '../engine/tokens/validate';
import { buildTokens } from '../engine/tokens/name';
import { emitOverridesCss, emitTokensCss } from '../engine/tokens/emit-css';
import { emitTokensTs } from '../engine/tokens/emit-ts';
import { buildTokenMap, emitTokenMapJson } from '../engine/tokens/emit-map';

interface CliArgs {
  analysisDir: string;
  outDir: string;
  force: boolean;
}

const HELP = `Usage: tsx scripts/extract-tokens.ts <analysis-dir> --out=<styles-out-dir> [--force]

Wave 2 deterministic token extractor.

Inputs:
  <analysis-dir>       Directory produced by scripts/extract-css.ts.
                       Required files:
                         color-usage.json, typography.json, spacing.json,
                         breakpoints.json, css-rules.json

Options:
  --out=<dir>          Target styles directory (e.g. the Astro project's
                       src/styles/). Required.
  --force              Overwrite existing output files.
  -h, --help           Show this help and exit.

Outputs (written to <out>/):
  tokens.css           :root custom properties grouped by category.
  overrides.css        Commented-out overrides ready to be customised.
  tokens.ts            Typed exports referencing each token via var().
  token-map.json       Reverse lookup from raw CSS value → token name.
`;

const OUTPUT_FILES = [
  'tokens.css',
  'overrides.css',
  'tokens.ts',
  'token-map.json',
] as const;

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function parseArgs(argv: string[]): CliArgs | { help: true } {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  let analysisDir: string | null = null;
  let outDir: string | null = null;
  let force = false;

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg.startsWith('--out=')) {
      const v = arg.slice('--out='.length);
      if (!v) throw new UsageError('--out= requires a value');
      outDir = v;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new UsageError(`Unknown option: ${arg}`);
    }
    if (analysisDir !== null) {
      throw new UsageError(`Unexpected extra argument: ${arg}`);
    }
    analysisDir = arg;
  }

  if (!analysisDir) {
    throw new UsageError('Missing <analysis-dir> argument.');
  }
  if (!outDir) {
    throw new UsageError('Missing --out=<styles-out-dir> option.');
  }

  return {
    analysisDir: resolve(analysisDir),
    outDir: resolve(outDir),
    force,
  };
}

function assertWritable(outDir: string, force: boolean): void {
  if (!isAbsolute(outDir)) {
    throw new UsageError(`--out must resolve to an absolute path: ${outDir}`);
  }
  if (!force) {
    for (const name of OUTPUT_FILES) {
      const target = join(outDir, name);
      if (existsSync(target)) {
        throw new UsageError(
          `Refusing to overwrite existing file: ${target}\n  Pass --force to overwrite.`,
        );
      }
    }
  }
}

interface WriteResult {
  file: string;
  bytes: number;
}

function writeOutputs(
  outDir: string,
  tokens: CategorisedTokens,
): WriteResult[] {
  mkdirSync(outDir, { recursive: true });

  const tokensCss = emitTokensCss(tokens);
  const overridesCss = emitOverridesCss(tokens);
  const tokensTs = emitTokensTs(tokens);
  const tokenMap = emitTokenMapJson(buildTokenMap(tokens));

  return [
    writeFile(join(outDir, 'tokens.css'), tokensCss),
    writeFile(join(outDir, 'overrides.css'), overridesCss),
    writeFile(join(outDir, 'tokens.ts'), tokensTs),
    writeFile(join(outDir, 'token-map.json'), tokenMap),
  ];
}

function writeFile(path: string, contents: string): WriteResult {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return { file: path, bytes: Buffer.byteLength(contents, 'utf8') };
}

function printSummary(
  args: CliArgs,
  tokens: CategorisedTokens,
  files: WriteResult[],
): void {
  const rows: [string, string | number][] = [
    ['analysis-dir', args.analysisDir],
    ['out-dir', args.outDir],
  ];
  for (const category of CATEGORY_ORDER) {
    rows.push([category, tokens[category].length]);
  }

  const labelWidth = rows.reduce((m, [k]) => Math.max(m, k.length), 0);
  console.log('extract-tokens summary');
  console.log('-'.repeat(labelWidth + 4));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(labelWidth)}  ${v}`);
  }
  console.log('');
  console.log('wrote:');
  for (const f of files) {
    console.log(`  ${f.file} (${f.bytes} bytes)`);
  }
}

function main(): void {
  let args: CliArgs;
  try {
    const parsed = parseArgs(process.argv);
    if ('help' in parsed) {
      process.stdout.write(HELP);
      return;
    }
    args = parsed;
    assertAnalysisDir(args.analysisDir);
    assertWritable(args.outDir, args.force);
  } catch (err) {
    if (err instanceof UsageError || err instanceof ValidationError) {
      console.error(`extract-tokens: ${err.message}\n`);
      process.stderr.write(HELP);
      process.exit(2);
    }
    throw err;
  }

  const bundle = loadAnalysis(args.analysisDir);
  const tokens = buildTokens(bundle);
  const files = writeOutputs(args.outDir, tokens);
  printSummary(args, tokens, files);
}

main();
