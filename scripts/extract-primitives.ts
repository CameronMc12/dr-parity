#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { loadConfig, ConfigError } from '../engine/primitives/config';
import { validateConfig, ValidationError } from '../engine/primitives/validate';
import { emitIndex, emitPrimitives } from '../engine/primitives/emit';
import { buildPrimitiveMap } from '../engine/primitives/map';
import type {
  ClassCatalogEntryLite,
  ClassCoverage,
  EmittedPrimitive,
  ExtractionResult,
  PrimitiveConfig,
} from '../engine/primitives/types';

interface CliArgs {
  analysisDir: string;
  outDir: string;
  configPath: string;
  force: boolean;
}

const HELP = `Usage: tsx scripts/extract-primitives.ts <analysis-dir> --out=<components-out-dir> [--config=<config-file>] [--force]

Wave 2: generate primitive Astro components for the target site.

Inputs:
  <analysis-dir>           Directory produced by extract-css.ts. Must contain class-catalog.json.

Options:
  --out=<dir>              REQUIRED. Target directory for emitted primitive .astro files
                           (e.g. <astro-project>/src/components/primitives/).
  --config=<file>          Path to PrimitiveConfig file (.ts/.mts/.mjs/.js/.json).
                           Default: ./dr-parity-primitives.config.ts in cwd.
                           Created from defaults if it does not exist.
  --force                  Overwrite existing files in --out without prompting.
  -h, --help               Show this help and exit.

Outputs (written to <out>/):
  <PrimitiveName>.astro    One file per primitive defined in config.
  index.ts                 Barrel re-export of every emitted primitive.
  primitive-map.json       Lookup tables for downstream refactor-sections.ts.
`;

class UsageError extends Error {}

function parseArgs(argv: string[]): CliArgs | { help: true } {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  let analysisDir: string | null = null;
  let outDir: string | null = null;
  let configPath: string | null = null;
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
    if (arg.startsWith('--config=')) {
      const v = arg.slice('--config='.length);
      if (!v) throw new UsageError('--config= requires a value');
      configPath = v;
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
    throw new UsageError('Missing required --out=<components-out-dir> option.');
  }

  return {
    analysisDir: resolve(analysisDir),
    outDir: isAbsolute(outDir) ? outDir : resolve(outDir),
    configPath: configPath
      ? isAbsolute(configPath)
        ? configPath
        : resolve(configPath)
      : resolve(process.cwd(), 'dr-parity-primitives.config.ts'),
    force,
  };
}

function validateInputs(args: CliArgs): void {
  if (!existsSync(args.analysisDir)) {
    throw new UsageError(`Analysis directory does not exist: ${args.analysisDir}`);
  }
  if (!statSync(args.analysisDir).isDirectory()) {
    throw new UsageError(`Analysis path is not a directory: ${args.analysisDir}`);
  }
  const catalogPath = join(args.analysisDir, 'class-catalog.json');
  if (!existsSync(catalogPath)) {
    throw new UsageError(`Missing class-catalog.json in analysis dir: ${catalogPath}`);
  }

  if (!args.force && existsSync(args.outDir) && statSync(args.outDir).isDirectory()) {
    const conflicts = readdirSync(args.outDir).filter(
      (f) => f.endsWith('.astro') || f === 'index.ts' || f === 'primitive-map.json',
    );
    if (conflicts.length > 0) {
      throw new UsageError(
        `Output directory already contains primitive files (${conflicts.length}). Re-run with --force to overwrite:\n  ${args.outDir}`,
      );
    }
  }
}

function loadCatalog(analysisDir: string): ClassCatalogEntryLite[] {
  const catalogPath = join(analysisDir, 'class-catalog.json');
  let raw: string;
  try {
    raw = readFileSync(catalogPath, 'utf8');
  } catch (err) {
    throw new UsageError(
      `Failed to read class-catalog.json: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(
      `Failed to parse class-catalog.json: ${(err as Error).message}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new UsageError(
      `class-catalog.json must be an array; got ${typeof parsed}.`,
    );
  }
  const out: ClassCatalogEntryLite[] = [];
  for (const entry of parsed) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { className?: unknown }).className === 'string' &&
      typeof (entry as { count?: unknown }).count === 'number'
    ) {
      const e = entry as { className: string; count: number };
      out.push({ className: e.className, count: e.count });
    }
  }
  return out;
}

function crossReference(
  config: PrimitiveConfig,
  catalog: ClassCatalogEntryLite[],
): { coverage: ClassCoverage[]; warnings: string[] } {
  const countByClass = new Map<string, number>();
  for (const entry of catalog) {
    countByClass.set(entry.className, entry.count);
  }

  const coverage: ClassCoverage[] = [];
  const warnings: string[] = [];

  for (const name of Object.keys(config.primitives).sort()) {
    const def = config.primitives[name];
    const classes = [
      ...(def.matchClasses ?? []),
      ...(def.variants ? Object.values(def.variants) : []),
      ...(def.sizes ? Object.values(def.sizes) : []),
    ];
    for (const cls of classes) {
      const count = countByClass.get(cls) ?? 0;
      coverage.push({ className: cls, primitive: name, occurrencesInCatalog: count });
      if (count === 0) {
        warnings.push(
          `[extract-primitives] class "${cls}" (primitive ${name}) has 0 occurrences in class-catalog.json — config may be stale for this site.`,
        );
      }
    }
  }

  return { coverage, warnings };
}

function writeMap(outDir: string, config: PrimitiveConfig): string {
  const map = buildPrimitiveMap(config);
  const file = join(outDir, 'primitive-map.json');
  writeFileSync(file, JSON.stringify(map, null, 2) + '\n', 'utf8');
  return file;
}

function printSummary(args: CliArgs, result: ExtractionResult): void {
  console.log('extract-primitives summary');
  console.log('--------------------------');
  console.log(`analysis-dir  ${args.analysisDir}`);
  console.log(`out-dir       ${args.outDir}`);
  console.log(`config        ${args.configPath}`);
  console.log(`primitives    ${result.emitted.length}`);
  console.log(`classes       ${result.coverage.length}`);
  console.log(`warnings      ${result.warnings.length}`);
  console.log('');
  console.log('emitted:');
  for (const p of result.emitted) {
    const flags: string[] = [];
    if (p.variantKeys.length) flags.push(`variants=${p.variantKeys.length}`);
    if (p.sizeKeys.length) flags.push(`sizes=${p.sizeKeys.length}`);
    const suffix = flags.length ? `  [${flags.join(', ')}]` : '';
    console.log(`  ${p.file}${suffix}`);
  }
  console.log(`  ${result.indexFile}`);
  console.log(`  ${result.mapFile}`);
  if (result.warnings.length > 0) {
    console.log('');
    console.log('warnings:');
    for (const w of result.warnings) {
      console.log(`  ${w}`);
    }
  }
}

async function run(args: CliArgs): Promise<ExtractionResult> {
  const { config, createdDefault } = await loadConfig(args.configPath);
  if (createdDefault) {
    console.log(`[extract-primitives] wrote default config: ${args.configPath}`);
  }
  validateConfig(config);

  const catalog = loadCatalog(args.analysisDir);
  const { coverage, warnings } = crossReference(config, catalog);
  for (const w of warnings) console.warn(w);

  const emitted: EmittedPrimitive[] = emitPrimitives(config, {
    outDir: args.outDir,
    force: args.force,
  });
  const indexFile = emitIndex(args.outDir, emitted);
  const mapFile = writeMap(args.outDir, config);

  return {
    emitted,
    coverage,
    warnings,
    outDir: args.outDir,
    configPath: args.configPath,
    indexFile,
    mapFile,
  };
}

async function main(): Promise<void> {
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
      console.error(`extract-primitives: ${err.message}\n`);
      process.stderr.write(HELP);
      process.exit(2);
    }
    throw err;
  }

  try {
    const result = await run(args);
    printSummary(args, result);
  } catch (err) {
    if (err instanceof ConfigError || err instanceof ValidationError) {
      console.error(`extract-primitives: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
