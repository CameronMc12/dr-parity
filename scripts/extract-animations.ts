#!/usr/bin/env tsx
/**
 * Phase 1 animation extraction.
 *
 * Usage:
 *   tsx scripts/extract-animations.ts <clone-dir> [--out=<animations-dir>] [--force]
 */

import { resolve, dirname, join, isAbsolute } from 'path';
import { stat } from 'fs/promises';
import {
  discoverJsFiles,
  extractInlineScripts,
  parseFile,
  parseSource,
  isFailure,
  type ParsedSource,
} from '../engine/animations/parser';
import { detectAnimations } from '../engine/animations/detect';
import {
  buildModules,
  buildSummary,
  ensureOutDir,
  writeJsonOutputs,
  writeModules,
} from '../engine/animations/emit';
import type {
  AnimationCall,
  ExtractResult,
  PluginRegistration,
  UneditableEntry,
} from '../engine/animations/types';

interface CliArgs {
  cloneDir: string;
  outDir: string;
  force: boolean;
}

const HELP = `extract-animations - Phase 1 animation extractor

Usage:
  tsx scripts/extract-animations.ts <clone-dir> [--out=<animations-dir>] [--force]

Args:
  <clone-dir>         Directory of the captured static site clone.

Options:
  --out=<dir>         Output directory. Default: <clone-dir>/../analysis/animations
  --force             Overwrite output directory if it exists.
  -h, --help          Show this help.

Outputs:
  <out>/animations-raw.json
  <out>/animations-uneditable.json
  <out>/animations-summary.json
  <out>/modules/anim-NNN[-slug].ts
  <out>/modules/index.ts
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function parseArgs(argv: string[]): CliArgs | null {
  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return null;
  }
  const positional = argv.filter((a) => !a.startsWith('-'));
  const cloneDirArg = positional[0];
  if (!cloneDirArg) {
    process.stderr.write('Error: <clone-dir> is required.\n\n');
    process.stderr.write(HELP);
    process.exit(1);
  }
  const cloneDir = resolve(cloneDirArg);
  const outArg = argv.find((a) => a.startsWith('--out='));
  const outRaw = outArg ? outArg.slice('--out='.length) : null;
  let outDir: string;
  if (outRaw) {
    outDir = isAbsolute(outRaw) ? outRaw : resolve(outRaw);
  } else {
    outDir = join(dirname(cloneDir), 'analysis', 'animations');
  }
  const force = argv.includes('--force');
  return { cloneDir, outDir, force };
}

async function validateCloneDir(p: string): Promise<void> {
  try {
    const s = await stat(p);
    if (!s.isDirectory()) {
      throw new Error(`Not a directory: ${p}`);
    }
  } catch (err) {
    throw new Error(`Clone dir not accessible: ${p} (${(err as Error).message})`);
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;

  await validateCloneDir(args.cloneDir);
  await ensureOutDir(args.outDir, args.force);

  const jsFiles = await discoverJsFiles(args.cloneDir);
  const indexHtml = join(args.cloneDir, 'index.html');
  const inlineScripts = await extractInlineScripts(indexHtml);

  const allCalls: AnimationCall[] = [];
  const allUneditable: UneditableEntry[] = [];
  const plugins: PluginRegistration[] = [];

  let filesScanned = 0;
  let filesFailed = 0;

  for (const file of jsFiles) {
    const parsed = await parseFile(args.cloneDir, file);
    if (isFailure(parsed)) {
      filesFailed += 1;
      process.stderr.write(`[parse-fail] ${parsed.relativeFile}: ${parsed.error}\n`);
      continue;
    }
    filesScanned += 1;
    runDetect(parsed, allCalls, allUneditable, plugins);
  }

  for (let i = 0; i < inlineScripts.length; i += 1) {
    const code = inlineScripts[i];
    const virtualPath = `index.html#inline-${i + 1}`;
    try {
      const ast = parseSource(code);
      const synthetic: ParsedSource = {
        file: virtualPath,
        relativeFile: virtualPath,
        code,
        ast,
      };
      filesScanned += 1;
      runDetect(synthetic, allCalls, allUneditable, plugins);
    } catch (err) {
      filesFailed += 1;
      process.stderr.write(
        `[parse-fail] ${virtualPath}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  const modules = buildModules(allCalls);
  const summary = buildSummary(allCalls, allUneditable, filesScanned, filesFailed);
  const result: ExtractResult = {
    calls: allCalls,
    uneditable: allUneditable,
    modules,
    summary,
  };

  await writeJsonOutputs(args.outDir, result, plugins);
  await writeModules(args.outDir, modules);

  printSummary(args.outDir, result, plugins.length);
}

function runDetect(
  parsed: ParsedSource,
  calls: AnimationCall[],
  uneditable: UneditableEntry[],
  plugins: PluginRegistration[],
): void {
  try {
    const out = detectAnimations({
      file: parsed.file,
      relativeFile: parsed.relativeFile,
      code: parsed.code,
      ast: parsed.ast,
    });
    calls.push(...out.calls);
    uneditable.push(...out.uneditable);
    plugins.push(...out.plugins);
  } catch (err) {
    process.stderr.write(
      `[detect-fail] ${parsed.relativeFile}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function printSummary(outDir: string, result: ExtractResult, pluginCount: number): void {
  const { summary } = result;
  const lines = [
    `Animation extraction complete.`,
    `  Output:           ${outDir}`,
    `  Files scanned:    ${summary.filesScanned}`,
    `  Files failed:     ${summary.filesFailed}`,
    `  Total call sites: ${summary.totalCalls}`,
    `  Editable:         ${summary.editable}`,
    `  Uneditable:       ${summary.uneditable}`,
    `  Plugins detected: ${pluginCount}`,
    `  By library:`,
  ];
  for (const lib of Object.keys(summary.byLibrary)) {
    const b = summary.byLibrary[lib as keyof typeof summary.byLibrary];
    if (b.total === 0) continue;
    lines.push(`    - ${lib.padEnd(22)} total=${b.total} editable=${b.editable} uneditable=${b.uneditable}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

run().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
