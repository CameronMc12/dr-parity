#!/usr/bin/env tsx
/**
 * Phase 1 CSS extractor.
 *
 * Reads a captured clone directory (containing index.html and any .css files
 * underneath it, including inline <style> blocks in index.html) and emits a
 * deterministic set of JSON analysis artifacts plus a stdout summary.
 *
 * Usage:
 *   tsx scripts/extract-css.ts <clone-dir> [--out=<analysis-dir>]
 *
 * Default analysis-dir is `<clone-dir>/../analysis/`. The script refuses to
 * write the analysis output inside the clone directory itself to keep the
 * captured-clone tree pristine.
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  discoverCssSources,
  parseSources,
} from '../engine/analyze/css/parser';
import { analyseColors } from '../engine/analyze/css/colors';
import { analyseTypography } from '../engine/analyze/css/typography';
import { analyseSpacing } from '../engine/analyze/css/spacing';
import { analyseBreakpoints } from '../engine/analyze/css/breakpoints';
import { analyseClasses } from '../engine/analyze/css/classes';
import type {
  BreakpointEntry,
  ClassCatalogEntry,
  ColorUsageEntry,
  CssRule,
  CssSummary,
  SpacingClusterEntry,
  TypographyClusterEntry,
} from '../engine/analyze/css/types';

interface CliArgs {
  cloneDir: string;
  outDir: string;
}

const HELP = `Usage: tsx scripts/extract-css.ts <clone-dir> [--out=<analysis-dir>]

Phase 1 deterministic CSS extractor.

Inputs:
  <clone-dir>        Directory containing index.html and any .css files.
                     Inline <style> blocks in index.html are included.

Options:
  --out=<dir>        Output directory for analysis JSON.
                     Default: <clone-dir>/../analysis/
                     The output dir must be OUTSIDE <clone-dir>.
  -h, --help         Show this help and exit.

Outputs (written to <out>/):
  css-rules.json          Flat list of parsed CSS rules with provenance.
  color-usage.json        Colour values with usage counts and contexts.
  typography.json         Font-family/size/weight/line-height/letter-spacing
                          clusters (numeric clusters within 5% tolerance).
  spacing.json            Margin/padding/gap/offset/size clusters.
  breakpoints.json        Deduped @media (min|max-width) thresholds.
  class-catalog.json      DOM class usage joined with targeting CSS selectors.
  css-summary.json        Top-level counts.
`;

function parseArgs(argv: string[]): CliArgs | { help: true } {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  let cloneDir: string | null = null;
  let outDir: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      const v = arg.slice('--out='.length);
      if (!v) throw new UsageError('--out= requires a value');
      outDir = v;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new UsageError(`Unknown option: ${arg}`);
    }
    if (cloneDir !== null) {
      throw new UsageError(`Unexpected extra argument: ${arg}`);
    }
    cloneDir = arg;
  }

  if (!cloneDir) {
    throw new UsageError('Missing <clone-dir> argument.');
  }

  const cloneResolved = resolve(cloneDir);
  const outResolved = outDir
    ? resolve(outDir)
    : resolve(cloneResolved, '..', 'analysis');

  return { cloneDir: cloneResolved, outDir: outResolved };
}

class UsageError extends Error {}

function validateInputs(args: CliArgs): void {
  if (!existsSync(args.cloneDir)) {
    throw new UsageError(`Clone directory does not exist: ${args.cloneDir}`);
  }
  const stat = statSync(args.cloneDir);
  if (!stat.isDirectory()) {
    throw new UsageError(`Clone path is not a directory: ${args.cloneDir}`);
  }
  const indexPath = join(args.cloneDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new UsageError(
      `Missing index.html in clone directory: ${indexPath}`,
    );
  }
  if (isInside(args.outDir, args.cloneDir)) {
    throw new UsageError(
      `Refusing to write analysis output inside clone directory.\n  clone-dir: ${args.cloneDir}\n  out-dir:   ${args.outDir}`,
    );
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  if (isAbsolute(rel)) return false;
  return !rel.split(sep).includes('..');
}

interface AnalysisResult {
  rules: CssRule[];
  colors: ColorUsageEntry[];
  typography: TypographyClusterEntry[];
  spacing: SpacingClusterEntry[];
  breakpoints: BreakpointEntry[];
  classes: ClassCatalogEntry[];
  summary: CssSummary;
}

function analyse(cloneDir: string): AnalysisResult {
  const discovered = discoverCssSources(cloneDir);
  if (discovered.sources.length === 0) {
    console.warn(
      '[extract-css] no CSS sources found (no .css files and no inline <style> blocks).',
    );
  }

  const parsed = parseSources(discovered.sources);
  const rules = parsed.rules;

  const colors = analyseColors(rules);
  const typography = analyseTypography(rules);
  const spacing = analyseSpacing(rules);
  const breakpoints = analyseBreakpoints(rules);
  const classes = analyseClasses(cloneDir, rules);

  const selectorSet = new Set<string>();
  let totalDeclarations = 0;
  for (const r of rules) {
    selectorSet.add(r.selector);
    totalDeclarations += r.declarations.length;
  }

  const summary: CssSummary = {
    totalSources: discovered.sources.length,
    totalRules: rules.length,
    totalSelectors: selectorSet.size,
    totalDeclarations,
    totalColors: colors.length,
    totalTypographyClusters: typography.length,
    totalSpacingClusters: spacing.length,
    totalBreakpoints: breakpoints.length,
    totalClasses: classes.length,
  };

  return { rules, colors, typography, spacing, breakpoints, classes, summary };
}

function writeArtifacts(outDir: string, result: AnalysisResult): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  written.push(writeJson(outDir, 'css-rules.json', result.rules));
  written.push(writeJson(outDir, 'color-usage.json', result.colors));
  written.push(writeJson(outDir, 'typography.json', result.typography));
  written.push(writeJson(outDir, 'spacing.json', result.spacing));
  written.push(writeJson(outDir, 'breakpoints.json', result.breakpoints));
  written.push(writeJson(outDir, 'class-catalog.json', result.classes));
  written.push(writeJson(outDir, 'css-summary.json', result.summary));
  return written;
}

function writeJson(dir: string, name: string, payload: unknown): string {
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return file;
}

function printSummary(args: CliArgs, result: AnalysisResult, files: string[]): void {
  const { summary } = result;
  const rows: [string, string | number][] = [
    ['clone-dir', args.cloneDir],
    ['out-dir', args.outDir],
    ['sources', summary.totalSources],
    ['rules', summary.totalRules],
    ['selectors', summary.totalSelectors],
    ['declarations', summary.totalDeclarations],
    ['colors', summary.totalColors],
    ['typography clusters', summary.totalTypographyClusters],
    ['spacing clusters', summary.totalSpacingClusters],
    ['breakpoints', summary.totalBreakpoints],
    ['classes', summary.totalClasses],
  ];

  const labelWidth = rows.reduce((m, [k]) => Math.max(m, k.length), 0);
  console.log('extract-css summary');
  console.log('-'.repeat(labelWidth + 4));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(labelWidth)}  ${v}`);
  }
  console.log('');
  console.log('wrote:');
  for (const f of files) {
    console.log(`  ${f}`);
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
    validateInputs(args);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`extract-css: ${err.message}\n`);
      process.stderr.write(HELP);
      process.exit(2);
    }
    throw err;
  }

  const result = analyse(args.cloneDir);
  const files = writeArtifacts(args.outDir, result);
  printSummary(args, result, files);
}

main();
