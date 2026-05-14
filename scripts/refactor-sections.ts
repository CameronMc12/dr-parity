#!/usr/bin/env tsx
import path from 'node:path';
import { runRefactor, renderSummaryTable } from '../engine/refactor/index';
import type { RefactorOptions } from '../engine/refactor/types';

interface ParsedArgs {
  componentsDir: string | null;
  primitiveMap: string | null;
  iconSwapMap: string | null;
  iconImportBase: string;
  primitiveImportBase: string;
  prettify: boolean;
  force: boolean;
  help: boolean;
}

const HELP = `refactor-sections — Wave 3 deterministic section refactor

Usage:
  tsx scripts/refactor-sections.ts \\
    --components-dir=<dir> \\
    --primitive-map=<path> \\
    --icon-swap-map=<path> \\
    [--icon-import-base=<rel-path>] \\
    [--primitive-import-base=<rel-path>] \\
    [--prettify=true|false] \\
    [--force]

Flags:
  --components-dir          Directory of section .astro components (required)
  --primitive-map           Path to primitive-map.json (required)
  --icon-swap-map           Path to dom-swap-map.json (required)
  --icon-import-base        Relative path from section to icons dir (default: ../icons)
  --primitive-import-base   Relative path from section to primitives dir (default: ../primitives)
  --prettify                Pretty-print final output (default: true)
  --force                   Overwrite already-refactored files
  -h, --help                Show this help
`;

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    componentsDir: null,
    primitiveMap: null,
    iconSwapMap: null,
    iconImportBase: '../icons',
    primitiveImportBase: '../primitives',
    prettify: true,
    force: false,
    help: false,
  };

  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      args.help = true;
      continue;
    }
    if (raw === '--force') {
      args.force = true;
      continue;
    }
    const eq = raw.indexOf('=');
    if (!raw.startsWith('--') || eq === -1) {
      throw new Error(`Unrecognised argument: ${raw}`);
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);

    switch (key) {
      case 'components-dir':
        args.componentsDir = value;
        break;
      case 'primitive-map':
        args.primitiveMap = value;
        break;
      case 'icon-swap-map':
        args.iconSwapMap = value;
        break;
      case 'icon-import-base':
        args.iconImportBase = value;
        break;
      case 'primitive-import-base':
        args.primitiveImportBase = value;
        break;
      case 'prettify':
        args.prettify = value.toLowerCase() === 'true';
        break;
      case 'force':
        args.force = value.toLowerCase() === 'true';
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  return args;
}

function toOptions(parsed: ParsedArgs): RefactorOptions {
  if (!parsed.componentsDir) {
    throw new Error('Missing required flag: --components-dir');
  }
  if (!parsed.primitiveMap) {
    throw new Error('Missing required flag: --primitive-map');
  }
  if (!parsed.iconSwapMap) {
    throw new Error('Missing required flag: --icon-swap-map');
  }
  return {
    componentsDir: path.resolve(parsed.componentsDir),
    primitiveMapPath: path.resolve(parsed.primitiveMap),
    iconSwapMapPath: path.resolve(parsed.iconSwapMap),
    iconImportBase: parsed.iconImportBase,
    primitiveImportBase: parsed.primitiveImportBase,
    prettify: parsed.prettify,
    force: parsed.force,
  };
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }

  if (parsed.help) {
    process.stdout.write(HELP);
    return;
  }

  let options: RefactorOptions;
  try {
    options = toOptions(parsed);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }

  try {
    const { report, reportPath } = await runRefactor(options);
    process.stdout.write(renderSummaryTable(report));
    process.stdout.write(`\n\nReport written to: ${reportPath}\n`);
  } catch (err) {
    process.stderr.write(`refactor-sections failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

void main();
