#!/usr/bin/env tsx
import { resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { VIEWPORTS, VIEWPORT_NAMES, type Viewport } from '../engine/verify/types';
import {
  DEFAULT_WEIGHTS,
  type ScoreWeights,
  type RouteSpec,
  type ParityScoreReport,
  type RouteScore,
} from '../engine/verify/score-types';
import { loadRoutesFile, loadRoutesFromCrawl } from '../engine/verify/route-source';
import { scoreRoute } from '../engine/verify/score-route';
import { writeScoreJson, writeScoreMarkdown, printTopGaps } from '../engine/verify/score-report';

const USAGE = `Usage: tsx scripts/parity-score.ts --reference=<url> --candidate=<url> [route source] [options]

Grade a candidate clone against a reference across routes and interactions.

Required:
  --reference=<url>        Base URL of the reference site (live original or replay clone)
  --candidate=<url>        Base URL of the candidate site (e.g. react build)

Route source (one required):
  --routes=<path>          Path to a routes.json ({ routes: [{ path, label?, interactions? }] })
  --crawl-dir=<dir>        Crawl output dir containing graph.json (derives routes + interactions)

Options:
  --viewport=<name>        Single viewport name. Default: desktop. One of: ${VIEWPORT_NAMES.join(', ')}
  --out=<dir>              Output directory for report + screenshots. Default: ./parity-score-report
  --weight-visual=<n>      Visual weight. Default: ${DEFAULT_WEIGHTS.visual}
  --weight-dom=<n>         DOM weight. Default: ${DEFAULT_WEIGHTS.dom}
  --weight-functional=<n>  Functional weight. Default: ${DEFAULT_WEIGHTS.functional}
  --help, -h               Show this help
`;

type Args = {
  reference?: string;
  candidate?: string;
  routes?: string;
  crawlDir?: string;
  viewport?: string;
  out?: string;
  weightVisual?: string;
  weightDom?: string;
  weightFunctional?: string;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      out.help = true;
      continue;
    }
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    switch (key) {
      case 'reference':
        out.reference = value;
        break;
      case 'candidate':
        out.candidate = value;
        break;
      case 'routes':
        out.routes = value;
        break;
      case 'crawl-dir':
        out.crawlDir = value;
        break;
      case 'viewport':
        out.viewport = value;
        break;
      case 'out':
        out.out = value;
        break;
      case 'weight-visual':
        out.weightVisual = value;
        break;
      case 'weight-dom':
        out.weightDom = value;
        break;
      case 'weight-functional':
        out.weightFunctional = value;
        break;
      default:
        break;
    }
  }
  return out;
}

function resolveViewport(name: string | undefined): Viewport {
  const target = name ?? 'desktop';
  const found = VIEWPORTS.find((v) => v.name === target);
  if (!found) {
    throw new Error(`Unknown viewport "${target}". Available: ${VIEWPORT_NAMES.join(', ')}`);
  }
  return found;
}

function resolveWeights(args: Args): ScoreWeights {
  const num = (v: string | undefined, fallback: number): number => {
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Invalid weight "${v}"`);
    }
    return n;
  };
  return {
    visual: num(args.weightVisual, DEFAULT_WEIGHTS.visual),
    dom: num(args.weightDom, DEFAULT_WEIGHTS.dom),
    functional: num(args.weightFunctional, DEFAULT_WEIGHTS.functional),
  };
}

async function loadRoutes(args: Args): Promise<RouteSpec[]> {
  if (args.routes) return loadRoutesFile(resolve(args.routes));
  if (args.crawlDir) return loadRoutesFromCrawl(resolve(args.crawlDir));
  throw new Error('Provide one route source: --routes=<path> or --crawl-dir=<dir>');
}

function overallScore(routes: RouteScore[]): number {
  let weightedSum = 0;
  let stateCount = 0;
  for (const route of routes) {
    for (const state of route.states) {
      weightedSum += state.blended;
      stateCount += 1;
    }
  }
  return stateCount > 0 ? weightedSum / stateCount : 0;
}

async function run(args: Args): Promise<number> {
  if (!args.reference || !args.candidate) {
    process.stderr.write('Error: --reference and --candidate are required.\n\n');
    process.stderr.write(USAGE);
    return 1;
  }

  const viewport = resolveViewport(args.viewport);
  const weights = resolveWeights(args);
  const outDir = resolve(args.out ?? './parity-score-report');
  const routes = await loadRoutes(args);

  process.stdout.write(
    `Scoring ${routes.length} route(s) at viewport "${viewport.name}"...\n` +
      `  reference: ${args.reference}\n` +
      `  candidate: ${args.candidate}\n`,
  );

  const start = Date.now();
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const referenceCtx = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dsf,
    });
    const candidateCtx = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dsf,
    });

    const routeScores: RouteScore[] = [];
    try {
      for (const route of routes) {
        process.stdout.write(`  - ${route.path} ...\n`);
        const score = await scoreRoute(route, {
          referenceCtx,
          candidateCtx,
          referenceBase: args.reference,
          candidateBase: args.candidate,
          viewport,
          weights,
          outDir,
        });
        routeScores.push(score);
      }
    } finally {
      await Promise.allSettled([referenceCtx.close(), candidateCtx.close()]);
    }

    const report: ParityScoreReport = {
      reference: args.reference,
      candidate: args.candidate,
      viewport,
      weights,
      routes: routeScores,
      overallScore: overallScore(routeScores),
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };

    const [jsonPath, mdPath] = await Promise.all([
      writeScoreJson(outDir, report),
      writeScoreMarkdown(outDir, report),
    ]);

    printTopGaps(report);
    process.stdout.write(`\nReports written:\n  ${jsonPath}\n  ${mdPath}\n`);
    return 0;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  try {
    const code = await run(args);
    process.exit(code);
  } catch (err) {
    process.stderr.write(`parity-score error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

void main();
