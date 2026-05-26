#!/usr/bin/env tsx
/**
 * parity:track — the parity tracking loop CLI.
 *
 * Drives a reference and a candidate through the same states/requests via
 * Playwright, scores five independent avenues (visual, dom, api, state,
 * transition), aggregates to a weighted overall + ranked gap ledger, writes
 * parity-report.{json,md}, and appends to parity-history.jsonl so refinement is
 * tracked over time. Loop until >= target on every avenue.
 */

import { resolve } from 'node:path';
import { VIEWPORTS, VIEWPORT_NAMES, type Viewport } from '../engine/verify/types';
import {
  DEFAULT_AVENUE_WEIGHTS,
  AVENUE_NAMES,
  type AvenueWeights,
} from '../engine/verify/parity/avenue-types';
import {
  loadStatesFile,
  loadStatesFromCrawl,
  rootState,
  type ParityState,
} from '../engine/verify/parity/state-spec';
import { runTracking } from '../engine/verify/parity/track';
import { printSummary } from '../engine/verify/parity/aggregate';

const USAGE = `Usage: tsx scripts/parity-track.ts --reference=<url|captureDir> --candidate=<url> [options]

Run the parity tracking loop. Scores visual, dom, api, state, and transition
avenues independently, aggregates to a weighted overall + ranked gap ledger.

Required:
  --reference=<url|dir>   Reference base URL (live original or replay clone), or
                          a capture/crawl dir to derive states from.
  --candidate=<url>       Candidate base URL (e.g. the replay on :7799).

State source (optional; default: a single root "/" state for self-parity):
  --states=<file>         JSON file: { states: [{ path, label?, interactions? }] }
  --crawl-dir=<dir>       Crawl output dir with graph.json (derives states).

Options:
  --viewport=<name>       One of: ${VIEWPORT_NAMES.join(', ')}. Default: desktop.
  --out=<dir>             Output dir for reports + shots. Default: ./parity-track-report
  --history=<file>        History JSONL path. Default: <out>/parity-history.jsonl
  --target=<n>            Per-avenue pass target (0..100). Default: 98
  --weight-visual=<n>     Default: ${DEFAULT_AVENUE_WEIGHTS.visual}
  --weight-dom=<n>        Default: ${DEFAULT_AVENUE_WEIGHTS.dom}
  --weight-api=<n>        Default: ${DEFAULT_AVENUE_WEIGHTS.api}
  --weight-state=<n>      Default: ${DEFAULT_AVENUE_WEIGHTS.state}
  --weight-transition=<n> Default: ${DEFAULT_AVENUE_WEIGHTS.transition}
  --help, -h
`;

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      out.help = true;
      continue;
    }
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) {
      out[raw.slice(2)] = true;
      continue;
    }
    out[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return out;
}

function str(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function resolveViewport(name: string | undefined): Viewport {
  const target = name ?? 'desktop';
  const found = VIEWPORTS.find((v) => v.name === target);
  if (!found) {
    throw new Error(`Unknown viewport "${target}". Available: ${VIEWPORT_NAMES.join(', ')}`);
  }
  return found;
}

function resolveWeights(args: Args): AvenueWeights {
  const num = (key: string, fallback: number): number => {
    const v = str(args, key);
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${key} "${v}"`);
    return n;
  };
  return {
    visual: num('weight-visual', DEFAULT_AVENUE_WEIGHTS.visual),
    dom: num('weight-dom', DEFAULT_AVENUE_WEIGHTS.dom),
    api: num('weight-api', DEFAULT_AVENUE_WEIGHTS.api),
    state: num('weight-state', DEFAULT_AVENUE_WEIGHTS.state),
    transition: num('weight-transition', DEFAULT_AVENUE_WEIGHTS.transition),
  };
}

async function resolveStates(args: Args): Promise<ParityState[]> {
  const statesFile = str(args, 'states');
  if (statesFile) return loadStatesFile(resolve(statesFile));
  const crawlDir = str(args, 'crawl-dir');
  if (crawlDir) return loadStatesFromCrawl(resolve(crawlDir));
  return [rootState()];
}

async function run(args: Args): Promise<number> {
  const reference = str(args, 'reference');
  const candidate = str(args, 'candidate');
  if (!reference || !candidate) {
    process.stderr.write('Error: --reference and --candidate are required.\n\n');
    process.stderr.write(USAGE);
    return 1;
  }

  const viewport = resolveViewport(str(args, 'viewport'));
  const weights = resolveWeights(args);
  const outDir = resolve(str(args, 'out') ?? './parity-track-report');
  const historyPath = resolve(str(args, 'history') ?? `${outDir}/parity-history.jsonl`);
  const target = str(args, 'target') ? Number(str(args, 'target')) : 98;
  const states = await resolveStates(args);

  process.stdout.write(
    `Parity tracking ${states.length} state(s) at "${viewport.name}":\n` +
      `  reference: ${reference}\n` +
      `  candidate: ${candidate}\n` +
      `  weights: ${AVENUE_NAMES.map((n) => `${n}=${weights[n]}`).join(' ')}\n`,
  );

  const { report, jsonPath, mdPath } = await runTracking({
    reference,
    candidate,
    states,
    viewport,
    weights,
    outDir,
    historyPath,
    target,
    onProgress: (m) => process.stdout.write(`${m}\n`),
  });

  printSummary(report);
  process.stdout.write(`\nReports:\n  ${jsonPath}\n  ${mdPath}\n  ${historyPath}\n`);
  return report.passed ? 0 : 2;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  try {
    process.exit(await run(args));
  } catch (err) {
    process.stderr.write(
      `parity-track error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

void main();
