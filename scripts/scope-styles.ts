#!/usr/bin/env tsx
/**
 * Wave 2: split captured CSS rules into per-component scoped style blocks
 * for an Astro project plus a slimmed shared base.css.
 *
 * Two modes are supported:
 *   --mode=safe       (default) — analyze and write analysis/scope-styles-plan.json
 *                     ONLY. No .astro files modified, no base.css emitted, no
 *                     token substitution applied. Guarantees parity.
 *   --mode=aggressive — full original behaviour: emit per-component
 *                     <style is:global> blocks + base.css + token substitution.
 *                     WARNING: may degrade visual parity.
 *
 * Usage:
 *   tsx scripts/scope-styles.ts <analysis-dir> \
 *     --components-dir=<dir> \
 *     --styles-out-dir=<dir> \
 *     [--token-map=<path>] [--force] [--mode=safe|aggressive]
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { CssRule } from '../engine/analyze/css/types';
import { assignRules } from '../engine/scope-styles/assign';
import { emit } from '../engine/scope-styles/emit';
import { writePlan } from '../engine/scope-styles/plan';
import { indexComponents } from '../engine/scope-styles/index-components';
import { indexRules } from '../engine/scope-styles/index-rules';
import {
  buildSubstitutionTable,
  flattenTokenMap,
} from '../engine/scope-styles/substitute';
import type { ScopeStylesMode, SubstitutionStats } from '../engine/scope-styles/types';

const HELP = `Usage: tsx scripts/scope-styles.ts <analysis-dir> \\
  --components-dir=<dir> \\
  --styles-out-dir=<dir> \\
  [--token-map=<path>] [--force] [--mode=safe|aggressive]

Splits captured CSS rules into per-component <style is:global> blocks plus a
slimmed shared base.css for an Astro project.

Inputs:
  <analysis-dir>       Directory containing css-rules.json (from extract-css).
  --components-dir=    Astro components dir (e.g. src/components/sections).
  --styles-out-dir=    Target Astro styles dir (e.g. src/styles). base.css is
                       written here (aggressive mode only).
  --token-map=         Optional token-map.json. When provided in aggressive
                       mode, raw values are rewritten to var(--token).
  --force              Overwrite a component's existing <style> block even if
                       it was hand-written (aggressive mode only).
  --mode=              "safe" (default) writes analysis/scope-styles-plan.json
                       only. "aggressive" performs full emit + substitution.
  -h, --help           Show this help and exit.
`;

interface CliArgs {
  analysisDir: string;
  componentsDir: string;
  stylesOutDir: string;
  tokenMapPath: string | null;
  force: boolean;
  mode: ScopeStylesMode;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): CliArgs | { help: true } {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    return { help: true };
  }

  let analysisDir: string | null = null;
  let componentsDir: string | null = null;
  let stylesOutDir: string | null = null;
  let tokenMapPath: string | null = null;
  let force = false;
  let mode: ScopeStylesMode = 'safe';

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg.startsWith('--components-dir=')) {
      componentsDir = requireValue(arg, '--components-dir=');
      continue;
    }
    if (arg.startsWith('--styles-out-dir=')) {
      stylesOutDir = requireValue(arg, '--styles-out-dir=');
      continue;
    }
    if (arg.startsWith('--token-map=')) {
      tokenMapPath = requireValue(arg, '--token-map=');
      continue;
    }
    if (arg.startsWith('--mode=')) {
      mode = parseMode(requireValue(arg, '--mode='));
      continue;
    }
    if (arg.startsWith('--')) {
      throw new UsageError(`Unknown option: ${arg}`);
    }
    if (analysisDir !== null) {
      throw new UsageError(`Unexpected extra argument: ${arg}`);
    }
    analysisDir = arg;
  }

  if (!analysisDir) throw new UsageError('Missing <analysis-dir> argument.');
  if (!componentsDir) throw new UsageError('Missing --components-dir=<dir>.');
  if (!stylesOutDir) throw new UsageError('Missing --styles-out-dir=<dir>.');

  return {
    analysisDir: resolveAbs(analysisDir),
    componentsDir: resolveAbs(componentsDir),
    stylesOutDir: resolveAbs(stylesOutDir),
    tokenMapPath: tokenMapPath ? resolveAbs(tokenMapPath) : null,
    force,
    mode,
  };
}

function parseMode(raw: string): ScopeStylesMode {
  if (raw === 'safe' || raw === 'aggressive') return raw;
  throw new UsageError(`Invalid --mode value: "${raw}". Expected "safe" or "aggressive".`);
}

function requireValue(arg: string, prefix: string): string {
  const v = arg.slice(prefix.length);
  if (!v) throw new UsageError(`${prefix} requires a value`);
  return v;
}

function resolveAbs(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function validateInputs(args: CliArgs): void {
  if (!existsSync(args.analysisDir)) {
    throw new UsageError(`Analysis directory does not exist: ${args.analysisDir}`);
  }
  if (!statSync(args.analysisDir).isDirectory()) {
    throw new UsageError(`Analysis path is not a directory: ${args.analysisDir}`);
  }
  const cssRulesPath = `${args.analysisDir}/css-rules.json`;
  if (!existsSync(cssRulesPath)) {
    throw new UsageError(`Missing css-rules.json at ${cssRulesPath}`);
  }
  if (!existsSync(args.componentsDir)) {
    throw new UsageError(`Components dir does not exist: ${args.componentsDir}`);
  }
  if (!statSync(args.componentsDir).isDirectory()) {
    throw new UsageError(`Components path is not a directory: ${args.componentsDir}`);
  }
  if (args.tokenMapPath && !existsSync(args.tokenMapPath)) {
    throw new UsageError(`Token map does not exist: ${args.tokenMapPath}`);
  }
}

function loadRules(analysisDir: string): CssRule[] {
  const raw = readFileSync(`${analysisDir}/css-rules.json`, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new UsageError('css-rules.json: expected a top-level array.');
  }
  for (const r of parsed) {
    if (
      typeof r !== 'object' ||
      r === null ||
      typeof (r as { selector?: unknown }).selector !== 'string' ||
      !Array.isArray((r as { declarations?: unknown }).declarations)
    ) {
      throw new UsageError('css-rules.json: malformed rule entry encountered.');
    }
  }
  return parsed as CssRule[];
}

function loadTokenMap(path: string | null): Map<string, string> {
  if (!path) return new Map();
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(
      `Failed to parse token-map JSON (${path}): ${(err as Error).message}`,
    );
  }
  const tokens = flattenTokenMap(parsed);
  return buildSubstitutionTable(tokens);
}

function main(): void {
  let args: CliArgs;
  try {
    const parsed = parseArgs(process.argv);
    if ('help' in parsed) {
      process.stdout.write(HELP);
      return;
    }
    args = parsed;
    validateInputs(args);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`scope-styles: ${err.message}\n\n`);
      process.stderr.write(HELP);
      process.exit(2);
    }
    throw err;
  }

  const rules = loadRules(args.analysisDir);
  const components = indexComponents(args.componentsDir);
  if (components.length === 0) {
    throw new UsageError(`No .astro components found under ${args.componentsDir}`);
  }
  const ruleIndex = indexRules(rules);
  const assignment = assignRules(components, ruleIndex);

  if (args.mode === 'safe') {
    const planPath = writePlan({
      analysisDir: args.analysisDir,
      rules,
      assignment,
      components,
    });
    process.stdout.write('scope-styles: safe mode — no source modifications\n');
    process.stdout.write(`plan written to ${planPath}\n`);
    return;
  }

  process.stdout.write(
    'WARNING: scope-styles running in AGGRESSIVE mode — this rewrites .astro files,\n' +
      '         emits base.css, and applies token substitution. Parity may degrade.\n',
  );

  const substitutionTable = loadTokenMap(args.tokenMapPath);
  const substitutionStats: SubstitutionStats = { totalReplacements: 0 };

  const result = emit({
    rules,
    assignment,
    components,
    substitutionTable,
    substitutionStats,
    stylesOutDir: args.stylesOutDir,
    force: args.force,
  });

  const counts = Array.from(result.perComponentCounts.values()).filter((n) => n > 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = counts.length > 0 ? total / counts.length : 0;
  const max = counts.length > 0 ? Math.max(...counts) : 0;

  process.stdout.write('scope-styles summary (aggressive)\n');
  process.stdout.write('---------------------------------\n');
  process.stdout.write(`components processed   ${result.componentFilesWritten}\n`);
  process.stdout.write(`rules per component avg ${avg.toFixed(1)}\n`);
  process.stdout.write(`rules per component max ${max}\n`);
  process.stdout.write(`global rules           ${assignment.global.length}\n`);
  process.stdout.write(`token substitutions    ${substitutionStats.totalReplacements}\n`);
  process.stdout.write(`base.css               ${result.baseCssPath}\n`);
}

main();
