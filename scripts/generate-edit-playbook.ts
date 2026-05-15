#!/usr/bin/env tsx
/**
 * CLI wrapper for the EDIT.md playbook generator.
 *
 * Usage:
 *   tsx scripts/generate-edit-playbook.ts <project-root>
 *   tsx scripts/generate-edit-playbook.ts --help
 *
 * <project-root> should be the directory containing `src/` and `public/`
 * (typically the rebuild-pro output at <clone>/../astro-pro).
 */

import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { generateEditPlaybook } from '../engine/playbook/generate-edit-playbook';

const HELP = `Usage: tsx scripts/generate-edit-playbook.ts <project-root>

Arguments:
  <project-root>   Astro project directory (must contain src/).

Options:
  --help, -h       Show this help.
`;

function absolutise(p: string): string {
  return isAbsolute(p) ? resolve(p) : resolve(process.cwd(), p);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 2 : 0);
    return;
  }
  const root = absolutise(argv[0]);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    process.stderr.write(`Error: project root not found: ${root}\n`);
    process.exit(2);
    return;
  }
  const result = generateEditPlaybook(root);
  process.stdout.write(`Wrote ${result.path} (${result.bytes} bytes)\n`);
}

main();
