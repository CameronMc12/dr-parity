#!/usr/bin/env tsx
/**
 * CLI: build a static HTML mirror from a crawl directory.
 *
 * Usage:
 *   tsx scripts/build-html-mirror.ts --crawl-dir=<path> [--out=<dir>]
 *
 * Output defaults to clones/<host>-html-<iso-timestamp>/.
 */

import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { buildHtmlMirror } from '../engine/targets/html-mirror';

interface CliArgs {
  crawlDir: string | null;
  outDir: string | null;
  help: boolean;
}

const HELP = `Usage:
  tsx scripts/build-html-mirror.ts --crawl-dir=<path> [--out=<dir>]

Options:
  --crawl-dir=<path>   Path to a crawl directory (contains routes.json,
                       routes/, assets.jsonl, trace.zip). Required.
  --out=<dir>          Output directory. Defaults to
                       clones/<host>-html-<iso-timestamp>/.
  --help               Show this help text.
`;

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { crawlDir: null, outDir: null, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--crawl-dir=')) out.crawlDir = arg.slice('--crawl-dir='.length);
    else if (arg.startsWith('--out=')) out.outDir = arg.slice('--out='.length);
    else if (arg.startsWith('--out-dir=')) out.outDir = arg.slice('--out-dir='.length);
  }
  return out;
}

function defaultOutDir(crawlDir: string): string {
  const host = basename(dirname(resolve(crawlDir))) || 'site';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const cwd = process.cwd();
  return join(cwd, 'clones', `${host}-html-${ts}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!args.crawlDir) {
    process.stderr.write('Error: --crawl-dir=<path> is required.\n\n' + HELP);
    process.exit(2);
  }

  const crawlDir = resolve(args.crawlDir);
  if (!existsSync(crawlDir)) {
    process.stderr.write(`Error: crawl directory not found: ${crawlDir}\n`);
    process.exit(2);
  }

  const outDir = resolve(args.outDir ?? defaultOutDir(crawlDir));

  const summary = await buildHtmlMirror({ crawlDir, outDir });

  const lines: string[] = [];
  lines.push(`> HTML mirror: ${summary.outDir}`);
  lines.push(`Routes emitted: ${summary.routesEmitted}`);
  lines.push(`Assets copied: ${summary.assetsCopied} (${summary.assetsBytes} bytes)`);
  lines.push(`Internal links rewritten: ${summary.internalLinksRewritten}`);
  lines.push(`Scripts stripped: ${summary.scriptsStripped}`);
  if (summary.warnings.length > 0) {
    lines.push(`Warnings: ${summary.warnings.length}`);
    for (const w of summary.warnings.slice(0, 5)) lines.push(`  - ${w}`);
    if (summary.warnings.length > 5) lines.push(`  ... and ${summary.warnings.length - 5} more`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

main().catch((err) => {
  process.stderr.write(
    `build-html-mirror failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
