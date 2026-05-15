#!/usr/bin/env tsx
/**
 * emit-only.ts — thin CLI wrapper around engine/orchestrator/post-build/emit-only.ts
 *
 * Use cases:
 *   - capture succeeded but emit crashed mid-flight
 *   - you killed the crawl and want to salvage what was captured
 *   - you want to iterate on the emitter against a frozen capture set
 *
 * Usage:
 *   tsx scripts/emit-only.ts --capture-root=<dir> --out=<dir> --name=<slug>
 *     [--viewport=desktop] [--force] [--emit-only] [--skip-verify]
 *
 * Defaults (no flags) preserve the original fluid.glass recovery behaviour.
 */

import { runEmitOnly } from '../engine/orchestrator/post-build/emit-only';

interface CliArgs {
  captureRoot: string;
  outDir: string;
  name: string;
  viewport: string;
  force: boolean;
  emitOnly: boolean;
  skipVerify: boolean;
}

const DEFAULTS: CliArgs = {
  captureRoot: '/Users/cameronmcallister/Desktop/github/dr-parity/docs/research/captures/fluid.glass',
  outDir: '/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/fluid-glass',
  name: 'fluid-glass',
  viewport: 'desktop',
  force: true,
  emitOnly: false,
  skipVerify: false,
};

function parseArgs(argv: string[]): CliArgs {
  const args = { ...DEFAULTS };
  for (const raw of argv) {
    if (raw === '--force') args.force = true;
    else if (raw === '--emit-only') args.emitOnly = true;
    else if (raw === '--skip-verify') args.skipVerify = true;
    else if (raw.startsWith('--capture-root=')) args.captureRoot = raw.slice('--capture-root='.length);
    else if (raw.startsWith('--out=')) args.outDir = raw.slice('--out='.length);
    else if (raw.startsWith('--name=')) args.name = raw.slice('--name='.length);
    else if (raw.startsWith('--viewport=')) args.viewport = raw.slice('--viewport='.length);
    else throw new Error(`Unknown option: ${raw}`);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await runEmitOnly({
    captureRoot: args.captureRoot,
    outDir: args.outDir,
    name: args.name,
    viewport: args.viewport,
    force: args.force,
    emitOnly: args.emitOnly,
    skipVerify: args.skipVerify,
  });
  process.stdout.write(`\nemit-only complete: ${result.outDir}\n`);
  if (result.verifyReport) {
    process.stdout.write(
      `  verify-render: ${result.verifyReport.passed}/${result.verifyReport.routesChecked} routes passed\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : err}\n`);
  process.exit(1);
});
