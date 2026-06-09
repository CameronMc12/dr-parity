import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ORACLE_BASE, REACT_BASE, REACHABILITY_TIMEOUT_MS, OUTPUT_DIR,
  SHELL_REGIONS, SHELL_SELECTORS, SHELL_PIXEL_THRESHOLD, SHELL_DOM_THRESHOLD,
  PIXELMATCH_THRESHOLD,
} from './config.js';
import type { RouteSpec, RouteResult, ShellRouteResult } from './types.js';
import { captureScreenshot } from './capture/screenshot.js';
import { captureDomSnapshot } from './capture/dom-snapshot.js';
import { pixelDiff } from './diff/pixel-diff.js';
import { domDiff } from './diff/dom-diff.js';
import { functionalDiff } from './diff/functional-diff.js';
import { buildScoreboard, buildShellScoreboard } from './report/scoreboard.js';
import { buildMarkdownReport, buildShellMarkdownReport } from './report/markdown-report.js';
import { ROUTES } from './registry.js';

export interface RunOptions {
  route?: string;          // if set, run only this route id
  updateBaseline?: boolean; // placeholder — reserved for future use
  shellOnly?: boolean;      // mask content area, score shell chrome only
}

/**
 * Probes a base URL by fetching '/' with a short timeout.
 * Returns true if the server responds (any status), false if connection refused / timeout.
 */
async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REACHABILITY_TIMEOUT_MS);
    const resp = await fetch(baseUrl + '/', { signal: ctrl.signal }).catch(() => null);
    clearTimeout(timer);
    return resp !== null;
  } catch {
    return false;
  }
}

function makeRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function run(opts: RunOptions = {}): Promise<number> {
  const runId = makeRunId();
  const harnessRoot = path.resolve(import.meta.dirname, '..');
  const runDir = path.join(harnessRoot, OUTPUT_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const modeTag = opts.shellOnly ? ' [shell-only]' : '';
  console.log(`[parity] run=${runId}${modeTag}`);
  console.log(`[parity] oracle=${ORACLE_BASE}  react=${REACT_BASE}`);

  // Reachability probe (parallel)
  const [oracleUp, reactUp] = await Promise.all([
    isReachable(ORACLE_BASE),
    isReachable(REACT_BASE),
  ]);

  if (!oracleUp) {
    console.error(`[parity] FATAL: oracle at ${ORACLE_BASE} is unreachable. Aborting.`);
    return 1;
  }

  if (!reactUp) {
    console.warn(`[parity] react at ${REACT_BASE} is unreachable — running oracle-only mode`);
  }

  const routes: RouteSpec[] = opts.route
    ? ROUTES.filter(r => r.id === opts.route)
    : ROUTES;

  if (routes.length === 0) {
    console.error(`[parity] No routes matched filter: ${opts.route}`);
    return 1;
  }

  const browser = await chromium.launch({ headless: true });

  if (opts.shellOnly) {
    // Shell-only mode: mask content, score shell chrome
    const shellResults: ShellRouteResult[] = [];

    for (const route of routes) {
      console.log(`[parity]   [shell] route=${route.id}  settle=${route.settleMs}ms`);
      const result = await runRouteShell(browser, route, runDir, reactUp);
      shellResults.push(result);

      const tag = result.verdict === 'pass' ? 'PASS'
        : result.verdict === 'oracle-only' ? 'ORACLE-ONLY'
        : 'FAIL';
      console.log(`[parity]   [shell] ${tag}  pixel=${result.pixel?.toFixed(3) ?? 'n/a'}  dom=${result.dom?.toFixed(3) ?? 'n/a'}`);
    }

    await browser.close();

    const shellBoard = buildShellScoreboard(runId, shellResults);
    const shellScoreboardPath = path.join(runDir, 'shell-scoreboard.json');
    fs.writeFileSync(shellScoreboardPath, JSON.stringify(shellBoard, null, 2));

    const shellReport = buildShellMarkdownReport(shellBoard);
    const shellReportPath = path.join(runDir, 'shell-report.md');
    fs.writeFileSync(shellReportPath, shellReport);

    console.log(`[parity] shell-scoreboard → ${shellScoreboardPath}`);
    console.log(`[parity] shell-report     → ${shellReportPath}`);
    console.log(`[parity] shell pass_rate=${(shellBoard.aggregate.pass_rate * 100).toFixed(1)}%`);
    console.log(`[parity] shell pixel_mean=${shellBoard.aggregate.pixel_mean?.toFixed(3) ?? 'n/a'}  dom_mean=${shellBoard.aggregate.dom_mean?.toFixed(3) ?? 'n/a'}`);

    const anyFailed = shellResults.some(r => r.verdict === 'fail');
    return anyFailed ? 1 : 0;
  }

  // Full-page mode (default)
  const results: RouteResult[] = [];

  for (const route of routes) {
    console.log(`[parity]   route=${route.id}  settle=${route.settleMs}ms`);
    const result = await runRoute(browser, route, runDir, reactUp);
    results.push(result);

    const tag = result.verdict === 'pass' ? 'PASS'
      : result.verdict === 'oracle-only' ? 'ORACLE-ONLY'
      : 'FAIL';
    console.log(`[parity]   ${tag}  pixel=${result.pixel?.toFixed(3) ?? 'n/a'}  dom=${result.dom?.toFixed(3) ?? 'n/a'}`);
  }

  await browser.close();

  const board = buildScoreboard(runId, results);
  const scoreboardPath = path.join(runDir, 'scoreboard.json');
  fs.writeFileSync(scoreboardPath, JSON.stringify(board, null, 2));

  const report = buildMarkdownReport(board);
  const reportPath = path.join(runDir, 'report.md');
  fs.writeFileSync(reportPath, report);

  console.log(`[parity] scoreboard → ${scoreboardPath}`);
  console.log(`[parity] report     → ${reportPath}`);
  console.log(`[parity] pass_rate=${(board.aggregate.pass_rate * 100).toFixed(1)}%`);

  // Exit 0 if every route passed (or oracle-only), 1 if any failed
  const anyFailed = results.some(r => r.verdict === 'fail');
  return anyFailed ? 1 : 0;
}

/**
 * Shell-only route runner.
 * Captures full-page screenshots, applies the shell mask to both images,
 * scores only the shell-chrome pixels, and restricts DOM diff to shell selectors.
 * Saves masked PNGs for visual inspection.
 */
async function runRouteShell(
  browser: import('playwright').Browser,
  route: RouteSpec,
  runDir: string,
  reactUp: boolean,
): Promise<ShellRouteResult> {
  const oracleUrl = ORACLE_BASE + route.path;
  const reactUrl = REACT_BASE + route.path;

  // Oracle screenshot + DOM
  const oracleCtx = await browser.newContext();
  let oraclePng: Buffer;
  let oracleSnapshot: Awaited<ReturnType<typeof captureDomSnapshot>>;

  try {
    [oraclePng, oracleSnapshot] = await Promise.all([
      captureScreenshot(oracleCtx, oracleUrl, route.settleMs),
      captureDomSnapshot(oracleCtx, oracleUrl, route.settleMs),
    ]);
  } catch (err) {
    await oracleCtx.close();
    return {
      route: route.id,
      pixel: null,
      dom: null,
      verdict: 'fail',
      reactUnreachable: !reactUp,
      oracleMaskedScreenshot: null,
      reactMaskedScreenshot: null,
      diffScreenshot: null,
      error: `oracle capture failed: ${String(err)}`,
    };
  }
  await oracleCtx.close();

  if (!reactUp) {
    return {
      route: route.id,
      pixel: null,
      dom: null,
      verdict: 'oracle-only',
      reactUnreachable: true,
      oracleMaskedScreenshot: null,
      reactMaskedScreenshot: null,
      diffScreenshot: null,
    };
  }

  // React screenshot + DOM
  const reactCtx = await browser.newContext();
  let reactPng: Buffer;
  let reactSnapshot: Awaited<ReturnType<typeof captureDomSnapshot>>;

  try {
    [reactPng, reactSnapshot] = await Promise.all([
      captureScreenshot(reactCtx, reactUrl, route.settleMs),
      captureDomSnapshot(reactCtx, reactUrl, route.settleMs),
    ]);
  } catch (err) {
    await reactCtx.close();
    return {
      route: route.id,
      pixel: null,
      dom: null,
      verdict: 'fail',
      reactUnreachable: false,
      oracleMaskedScreenshot: null,
      reactMaskedScreenshot: null,
      diffScreenshot: null,
      error: `react capture failed: ${String(err)}`,
    };
  }
  await reactCtx.close();

  // Pixel diff with shell mask — masked buffers are returned alongside diff
  const pixelResult = pixelDiff(oraclePng, reactPng, PIXELMATCH_THRESHOLD, SHELL_REGIONS);

  // Save masked images for visual inspection
  const oracleMaskedPath = path.join(runDir, `${route.id}-oracle-shell-masked.png`);
  const reactMaskedPath = path.join(runDir, `${route.id}-react-shell-masked.png`);
  const diffMaskedPath = path.join(runDir, `${route.id}-shell-diff.png`);

  if (pixelResult.maskedOraclePng) fs.writeFileSync(oracleMaskedPath, pixelResult.maskedOraclePng);
  if (pixelResult.maskedReactPng) fs.writeFileSync(reactMaskedPath, pixelResult.maskedReactPng);
  fs.writeFileSync(diffMaskedPath, pixelResult.diffPng);

  const oracleMaskedRelPath = path.relative(runDir, oracleMaskedPath);
  const reactMaskedRelPath = path.relative(runDir, reactMaskedPath);
  const diffRelPath = path.relative(runDir, diffMaskedPath);

  // DOM diff restricted to shell selectors
  const domScore = domDiff(
    oracleSnapshot.stats,
    reactSnapshot.stats,
    SHELL_SELECTORS,
    oracleSnapshot.normalised,
    reactSnapshot.normalised,
  );

  // Verdict uses shell-specific thresholds
  const pixelPass = pixelResult.score >= SHELL_PIXEL_THRESHOLD;
  const domPass = domScore >= SHELL_DOM_THRESHOLD;
  const verdict = pixelPass && domPass ? 'pass' : 'fail';

  return {
    route: route.id,
    pixel: pixelResult.score,
    dom: domScore,
    verdict,
    reactUnreachable: false,
    oracleMaskedScreenshot: pixelResult.maskedOraclePng ? oracleMaskedRelPath : null,
    reactMaskedScreenshot: pixelResult.maskedReactPng ? reactMaskedRelPath : null,
    diffScreenshot: diffRelPath,
  };
}

async function runRoute(
  browser: import('playwright').Browser,
  route: RouteSpec,
  runDir: string,
  reactUp: boolean,
): Promise<RouteResult> {
  const oracleUrl = ORACLE_BASE + route.path;
  const reactUrl = REACT_BASE + route.path;

  // Oracle screenshot + DOM (always runs)
  const oracleCtx = await browser.newContext();
  let oraclePng: Buffer;
  let oracleResult: Awaited<ReturnType<typeof captureDomSnapshot>>;

  try {
    [oraclePng, oracleResult] = await Promise.all([
      captureScreenshot(oracleCtx, oracleUrl, route.settleMs),
      captureDomSnapshot(oracleCtx, oracleUrl, route.settleMs),
    ]);
  } catch (err) {
    await oracleCtx.close();
    return {
      route: route.id,
      pixel: null,
      dom: null,
      functional: 'skip',
      verdict: 'fail',
      reactUnreachable: !reactUp,
      oracleScreenshot: null,
      reactScreenshot: null,
      diffScreenshot: null,
      error: `oracle capture failed: ${String(err)}`,
    };
  }
  await oracleCtx.close();

  const oraclePngPath = path.join(runDir, `${route.id}-oracle.png`);
  fs.writeFileSync(oraclePngPath, oraclePng);
  const oracleRelPath = path.relative(runDir, oraclePngPath);

  // Oracle-only mode when react is unreachable
  if (!reactUp) {
    return {
      route: route.id,
      pixel: null,
      dom: null,
      functional: 'skip',
      verdict: 'oracle-only',
      reactUnreachable: true,
      oracleScreenshot: oracleRelPath,
      reactScreenshot: null,
      diffScreenshot: null,
    };
  }

  // React screenshot + DOM (parallel with oracle was already done above; now do react)
  const reactCtx = await browser.newContext();
  let reactPng: Buffer;
  let reactResult: Awaited<ReturnType<typeof captureDomSnapshot>>;

  try {
    [reactPng, reactResult] = await Promise.all([
      captureScreenshot(reactCtx, reactUrl, route.settleMs),
      captureDomSnapshot(reactCtx, reactUrl, route.settleMs),
    ]);
  } catch (err) {
    await reactCtx.close();
    return {
      route: route.id,
      pixel: null,
      dom: null,
      functional: 'skip',
      verdict: 'fail',
      reactUnreachable: false,
      oracleScreenshot: oracleRelPath,
      reactScreenshot: null,
      diffScreenshot: null,
      error: `react capture failed: ${String(err)}`,
    };
  }
  await reactCtx.close();

  const reactPngPath = path.join(runDir, `${route.id}-react.png`);
  fs.writeFileSync(reactPngPath, reactPng);
  const reactRelPath = path.relative(runDir, reactPngPath);

  // Pixel diff
  const pixelResult = pixelDiff(oraclePng, reactPng);
  const diffPngPath = path.join(runDir, `${route.id}-diff.png`);
  fs.writeFileSync(diffPngPath, pixelResult.diffPng);
  const diffRelPath = path.relative(runDir, diffPngPath);

  // DOM diff
  const domScore = domDiff(oracleResult.stats, reactResult.stats);

  // Functional diff (stub)
  const functional = functionalDiff();

  // Verdict
  const pixelPass = pixelResult.score >= route.pixelThreshold;
  const domPass = domScore >= route.domThreshold;
  const verdict = pixelPass && domPass && functional !== 'fail' ? 'pass' : 'fail';

  return {
    route: route.id,
    pixel: pixelResult.score,
    dom: domScore,
    functional,
    verdict,
    reactUnreachable: false,
    oracleScreenshot: oracleRelPath,
    reactScreenshot: reactRelPath,
    diffScreenshot: diffRelPath,
  };
}
