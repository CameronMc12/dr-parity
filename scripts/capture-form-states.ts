#!/usr/bin/env tsx
/**
 * Phase 4 form-state capture CLI.
 *
 * Default behaviour is DRY-RUN: navigates and reports what it would
 * submit. Pass `--no-dry-run` to actually click submit and record
 * responses.
 *
 * Usage:
 *   tsx scripts/capture-form-states.ts <appUrl> --plan=<formPlan.yaml> [options]
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

import { captureForms } from '../engine/targets/webapp/form-capture';
import type { FormCaptureOptions } from '../engine/targets/webapp/form-capture';

type CliArgs = {
  appUrl?: string;
  planPath?: string;
  outDir?: string;
  userDataDir: string;
  dryRun: boolean;
  help: boolean;
};

const HELP = `
dr-parity form-state capture

Usage:
  tsx scripts/capture-form-states.ts <appUrl> --plan=<formPlan.yaml> [options]

Options:
  --plan=<path>            YAML file describing forms and scenarios (required)
  --out=<dir>              Output directory (default: docs/research/forms/<host>)
  --user-data-dir=<path>   Persistent Chrome profile (default: ~/.config/playwright-pinterest)
  --dry-run                Do not submit, just report what would happen (default ON)
  --no-dry-run             Actually submit forms and record responses
  -h, --help               Show this help
`.trim();

function defaultUserDataDir(): string {
  return join(homedir(), '.config', 'playwright-pinterest');
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    userDataDir: defaultUserDataDir(),
    dryRun: true,
    help: false,
  };
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (raw === '--no-dry-run') {
      out.dryRun = false;
      continue;
    }
    if (raw.startsWith('--plan=')) {
      out.planPath = raw.slice('--plan='.length);
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.outDir = raw.slice('--out='.length);
      continue;
    }
    if (raw.startsWith('--user-data-dir=')) {
      out.userDataDir = raw.slice('--user-data-dir='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    positional.push(raw);
  }
  out.appUrl = positional[0];
  return out;
}

function validateUrl(input: string | undefined): URL {
  if (!input) throw new Error('Missing <appUrl>. Run with --help.');
  return new URL(input);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const url = validateUrl(args.appUrl);
  if (!args.planPath) throw new Error('Missing --plan=<path>. Run with --help.');

  const outDir = args.outDir ?? join('docs', 'research', 'forms', url.hostname);

  const opts: FormCaptureOptions = {
    appUrl: url.toString(),
    planPath: args.planPath,
    outDir,
    userDataDir: args.userDataDir,
    dryRun: args.dryRun,
  };

  console.log(`[forms] appUrl      : ${opts.appUrl}`);
  console.log(`[forms] plan        : ${opts.planPath}`);
  console.log(`[forms] outDir      : ${opts.outDir}`);
  console.log(`[forms] userDataDir : ${opts.userDataDir}`);
  console.log(`[forms] dryRun      : ${opts.dryRun}`);

  const summary = await captureForms(opts);

  console.log('[forms] done');
  console.log(`  scenariosRun  : ${summary.scenariosRun}`);
  console.log(`  captured      : ${summary.captured}`);
  console.log(`  skipDryRun    : ${summary.skippedDryRun}`);
  console.log(`  outFile       : ${summary.outFile}`);
}

main().catch((err) => {
  console.error('[forms] fatal:', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
