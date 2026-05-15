#!/usr/bin/env tsx
/**
 * Single-page clone CLI.
 *
 * Thin alias over `run-clone.ts` for the "clone this page" verb. Captures the
 * given URL across all viewports, parses HAR/trace, then emits a static clone.
 *
 * Usage:
 *   tsx scripts/clone-page.ts <url> [--viewport=desktop,...] [--out=<dir>]
 */

import { spawn } from 'node:child_process';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`Usage: tsx scripts/clone-page.ts <url> [options]

A single-page clone. Forwards every flag to \`scripts/run-clone.ts\`.

Options:
  --viewport=<v>   Viewport selection. One of:
                     all                    (default, all 4 viewports)
                     desktop|mobile|
                     tablet|wide            (single viewport, ~4x faster)
                     <name>,<name>,...      (comma-separated subset)
  --out=<dir>      Output root for captures. Default: docs/research/captures.
  --no-tour        Skip the scroll/hover tour during capture.
  --no-preview     Suppress the printed preview command at the end.
  -h, --help       Show this help.

See \`scripts/run-clone.ts --help\` for the full flag list.
Use \`scripts/clone-site.ts <url>\` for autonomous multi-page crawling.`);
    return args.length === 0 ? 2 : 0;
  }

  return new Promise((resolveExit) => {
    const child = spawn('npx', ['tsx', 'scripts/run-clone.ts', ...args], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolveExit(code ?? 0));
    child.on('error', (err) => {
      console.error(`clone-page spawn error: ${err.message}`);
      resolveExit(1);
    });
  });
}

main().then((code) => process.exit(code));
