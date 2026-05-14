#!/usr/bin/env tsx
import { access, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { discoverSvgs } from '../engine/iconify/discover';
import { normaliseAll } from '../engine/iconify/normalise';
import { groupAndName } from '../engine/iconify/name';
import { emitIcons } from '../engine/iconify/emit';
import type { IconifyOptions } from '../engine/iconify/types';

interface CliArgs {
  cloneDir: string;
  outDir: string;
  force: boolean;
  help: boolean;
}

const HELP_TEXT = `iconify-svgs — extract inline <svg> elements into reusable Astro components

Usage:
  tsx scripts/iconify-svgs.ts <clone-dir> [--out=<icons-dir>] [--force]
  tsx scripts/iconify-svgs.ts --help

Args:
  <clone-dir>            Directory containing index.html (required)

Options:
  --out=<icons-dir>      Output directory for generated icon components
                         (default: <clone-dir>/../analysis/icons/)
  --force                Overwrite existing output directory
  --help, -h             Show this help message

Outputs:
  <PascalName>.astro per unique inline SVG
  icon-manifest.json     — manifest of unique icons
  dom-swap-map.json      — per-occurrence swap entries for downstream refactor
`;

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { cloneDir: '', outDir: '', force: false, help: true };
  }

  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional.length === 0) {
    throw new Error('Missing <clone-dir> argument. Run with --help for usage.');
  }
  if (positional.length > 1) {
    throw new Error(
      `Too many positional arguments. Expected 1 (<clone-dir>), got ${positional.length}.`,
    );
  }

  const cloneDir = resolve(positional[0]);

  let outDir = resolve(join(cloneDir, '..', 'analysis', 'icons'));
  const outArg = argv.find((a) => a.startsWith('--out='));
  if (outArg) {
    const value = outArg.slice('--out='.length);
    if (!value) throw new Error('--out= requires a directory path.');
    outDir = resolve(value);
  }

  const force = argv.includes('--force');

  return { cloneDir, outDir, force, help: false };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isNonEmptyDir(path: string): Promise<boolean> {
  if (!(await exists(path))) return false;
  const s = await stat(path);
  if (!s.isDirectory()) return true;
  const entries = await readdir(path);
  return entries.length > 0;
}

async function validateInputs(args: CliArgs): Promise<void> {
  if (!(await exists(args.cloneDir))) {
    throw new Error(`Clone directory not found: ${args.cloneDir}`);
  }
  const cloneStat = await stat(args.cloneDir);
  if (!cloneStat.isDirectory()) {
    throw new Error(`Clone path is not a directory: ${args.cloneDir}`);
  }

  const indexPath = join(args.cloneDir, 'index.html');
  if (!(await exists(indexPath))) {
    throw new Error(`index.html not found in clone-dir: ${indexPath}`);
  }

  if (await isNonEmptyDir(args.outDir)) {
    if (!args.force) {
      throw new Error(
        `Output directory exists and is not empty: ${args.outDir}\nUse --force to overwrite.`,
      );
    }
  }
}

function printSummary(
  totalCaptured: number,
  uniqueCount: number,
  outDir: string,
): void {
  const header = 'iconify-svgs summary';
  const sep = '─'.repeat(header.length);
  process.stdout.write(`\n${header}\n${sep}\n`);
  process.stdout.write(`Total inline <svg> elements : ${totalCaptured}\n`);
  process.stdout.write(`Unique icons (by hash)      : ${uniqueCount}\n`);
  process.stdout.write(`Output directory            : ${outDir}\n\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  await validateInputs(args);

  const options: IconifyOptions = {
    cloneDir: args.cloneDir,
    outDir: args.outDir,
    force: args.force,
  };

  const indexPath = join(args.cloneDir, 'index.html');
  const captured = await discoverSvgs(indexPath);

  if (captured.length === 0) {
    process.stdout.write('No inline <svg> elements found in index.html.\n');
    return;
  }

  const normalised = normaliseAll(captured);
  const groups = groupAndName(normalised);

  const projectRoot = resolve(join(dirname(args.outDir), '..'));
  const result = await emitIcons(groups, options, projectRoot);

  printSummary(captured.length, result.unique, result.outDir);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`iconify-svgs error: ${msg}\n`);
  process.exit(1);
});
