#!/usr/bin/env tsx
/**
 * Deterministic static-clone -> Astro slicer CLI.
 *
 * Usage:
 *   tsx scripts/build-astro.ts <clone-dir> [--out=<dir>] [--name=<slug>] [--force]
 *   tsx scripts/build-astro.ts --help
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import { buildAstroProject } from '../engine/astro/build';
import type { BuildSummary } from '../engine/astro/types';

interface ParsedArgs {
  help: boolean;
  cloneDir: string | null;
  outDir: string | null;
  name: string | null;
  force: boolean;
}

const HELP = `Usage: tsx scripts/build-astro.ts <clone-dir> [options]

Arguments:
  <clone-dir>     Path to a captured clone directory containing index.html
                  and manifest.json.

Options:
  --out=<dir>     Output directory. Defaults to a sibling 'astro-site/'
                  next to <clone-dir>.
  --name=<slug>   Project name written into package.json. Defaults to the
                  documentUrl host from manifest.json (or the clone folder).
  --force         Overwrite the output directory if it already exists.
  --help          Show this help text.

The script never modifies the clone directory.`;

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    cloneDir: null,
    outDir: null,
    name: null,
    force: false,
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') result.help = true;
    else if (raw === '--force') result.force = true;
    else if (raw.startsWith('--out=')) result.outDir = raw.slice('--out='.length);
    else if (raw.startsWith('--name=')) result.name = raw.slice('--name='.length);
    else if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    } else if (result.cloneDir === null) {
      result.cloneDir = raw;
    } else {
      throw new Error(`Unexpected positional argument: ${raw}`);
    }
  }
  return result;
}

function deriveDefaultName(cloneDir: string): string {
  const manifestPath = join(cloneDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { documentUrl?: string };
      const url = manifest.documentUrl;
      if (typeof url === 'string' && url.length > 0) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          if (host.length > 0) return host.replace(/[^a-z0-9.-]/gi, '-');
        } catch {
          // fall through
        }
      }
    } catch {
      // fall through
    }
  }
  return basename(resolve(cloneDir, '..')) || 'astro-site';
}

function defaultOutDir(cloneDir: string): string {
  return join(dirname(resolve(cloneDir)), 'astro-site');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function printSummary(summary: BuildSummary, outDir: string): void {
  console.log(`\nWrote Astro project: ${outDir}`);
  console.log(`Assets copied: ${summary.assetCount} files (${formatBytes(summary.assetBytes)})`);
  console.log('Components emitted:');
  for (const entry of summary.components) {
    console.log(`  - ${entry.name}  ${formatBytes(entry.bytes)}`);
  }
}

function main(): void {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(HELP);
    process.exit(2);
    return;
  }

  if (parsed.help || parsed.cloneDir === null) {
    console.log(HELP);
    process.exit(parsed.help ? 0 : 2);
    return;
  }

  const cloneDir = resolve(parsed.cloneDir);
  const outDir = parsed.outDir ? (isAbsolute(parsed.outDir) ? parsed.outDir : resolve(parsed.outDir)) : defaultOutDir(cloneDir);
  const name = parsed.name ?? deriveDefaultName(cloneDir);

  try {
    const summary = buildAstroProject({
      cloneDir,
      outDir,
      name,
      force: parsed.force,
    });
    printSummary(summary, outDir);
  } catch (err) {
    console.error(`build-astro failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
