#!/usr/bin/env tsx
/**
 * DATA FEEDER bridge: regenerate apps/web/src/data/* from the engine's real
 * ClickUp export (and, where useful, the merged crawl) so the hand-built
 * apps/web React app is fed REAL data instead of hand-curated seeds.
 *
 * Idempotent + safe: writes ONLY into the --out dir, backing up any existing
 * files to <out>/.backup-<stamp>/ before overwriting. Files the export cannot
 * reproduce (home-dashboard, sidebar-sections, status-order, status-set, the
 * .ts wrappers) are left untouched and reported as skipped.
 *
 * Usage:
 *   tsx scripts/seed-apps-web-from-engine.ts \
 *     --export-dir=docs/research/clickup-export/<iso> \
 *     [--crawl-dir=docs/research/crawl/app.clickup.com/seed-full] \
 *     [--out=apps/web/src/data]
 */

import { resolve } from 'node:path';
import { runFeeder } from '../engine/analyze/apps-web-feeder/index';

interface CliArgs {
  exportDir?: string;
  crawlDir: string;
  outDir: string;
  help: boolean;
}

const DEFAULT_CRAWL = 'docs/research/crawl/app.clickup.com/seed-full';
const DEFAULT_OUT = 'apps/web/src/data';

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { crawlDir: DEFAULT_CRAWL, outDir: DEFAULT_OUT, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--export-dir=')) args.exportDir = arg.slice('--export-dir='.length);
    else if (arg.startsWith('--crawl-dir=')) args.crawlDir = arg.slice('--crawl-dir='.length);
    else if (arg.startsWith('--out=')) args.outDir = arg.slice('--out='.length);
    else if (!arg.startsWith('--') && !args.exportDir) args.exportDir = arg;
  }
  return args;
}

function printUsage(): void {
  process.stdout.write(
    [
      'Usage:',
      '  tsx scripts/seed-apps-web-from-engine.ts --export-dir=<dir> [--crawl-dir=<dir>] [--out=<dir>]',
      '',
      'Flags:',
      '  --export-dir=<dir>  ClickUp API export dir (required)',
      `  --crawl-dir=<dir>   merged/seed-full crawl dir (default: ${DEFAULT_CRAWL})`,
      `  --out=<dir>         output data dir (default: ${DEFAULT_OUT})`,
      '',
    ].join('\n'),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.exportDir) {
    process.stderr.write('ERROR: --export-dir is required.\n\n');
    printUsage();
    process.exit(1);
  }

  const exportDir = resolve(args.exportDir);
  const crawlDir = resolve(args.crawlDir);
  const outDir = resolve(args.outDir);

  let report;
  try {
    report = runFeeder({ exportDir, crawlDir, outDir });
  } catch (err) {
    process.stderr.write(`Feeder failed: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const c = report.counts;
  const lines = [
    '',
    'apps/web data feeder — done',
    `  out:     ${report.outDir}`,
    `  backup:  ${report.backupDir ?? '(none — out dir was empty)'}`,
    '',
    '  regenerated:',
    ...report.written.map((f) => `    + ${f}`),
    '',
    '  preserved / skipped:',
    ...report.skipped.map((s) => `    - ${s.file}  (${s.reason})`),
    '',
    '  counts:',
    `    members:   ${c.members}`,
    `    tasks:     ${c.tasks}`,
    `    spaces:    ${c.spaces}`,
    `    folders:   ${c.folders}`,
    `    lists:     ${c.lists}`,
    `    docs:      ${c.docs}${c.droppedDocs ? ` (+${c.droppedDocs} unplaceable, dropped)` : ''}`,
    `    docPages:  ${c.docPages}`,
    '',
  ];
  process.stdout.write(lines.join('\n'));
}

main();
