/**
 * Parity tracking orchestrator. Drives reference + candidate through the same
 * states via Playwright, runs every avenue scorer, aggregates, and emits
 * reports + history. The thin CLI in scripts/parity-track.ts wraps this.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { driveState, type CapturedState, type ObservedResponse } from './drive';
import type { ParityState } from './state-spec';
import { scoreVisualAvenue } from './visual-avenue';
import { scoreDomAvenue } from './dom-avenue';
import { scoreApiAvenue } from './api-avenue';
import { scoreStateAvenue, type StateCase } from './state-avenue';
import { scoreTransitionAvenue } from './transition-avenue';
import { buildReport, writeReports, appendHistory } from './aggregate';
import {
  DEFAULT_AVENUE_WEIGHTS,
  type AvenueScore,
  type AvenueWeights,
  type ParityTrackReport,
} from './avenue-types';

export type TrackViewport = { name: string; width: number; height: number; dsf: number };

export type TrackOptions = {
  reference: string;
  candidate: string;
  states: ParityState[];
  viewport: TrackViewport;
  weights?: AvenueWeights;
  outDir: string;
  historyPath: string;
  target?: number;
  /** Optional state-avenue cases (wired by the owned backend later). */
  stateCases?: StateCase[];
  onProgress?: (message: string) => void;
};

export type TrackResult = {
  report: ParityTrackReport;
  jsonPath: string;
  mdPath: string;
};

function flatten(states: CapturedState[][]): CapturedState[] {
  return states.flat();
}

function flattenResponses(states: CapturedState[]): ObservedResponse[] {
  return states.flatMap((s) => s.responses);
}

async function driveAll(
  ctx: BrowserContext,
  side: 'reference' | 'candidate',
  base: string,
  states: ParityState[],
  outDir: string,
  captureMaskShot: boolean,
  onProgress?: (m: string) => void,
): Promise<CapturedState[]> {
  const out: CapturedState[][] = [];
  for (const state of states) {
    onProgress?.(`  ${side}: ${state.path}`);
    out.push(
      await driveState(state, { ctx, side, base, outDir, captureMaskShot }),
    );
  }
  return flatten(out);
}

export async function runTracking(opts: TrackOptions): Promise<TrackResult> {
  const weights = opts.weights ?? DEFAULT_AVENUE_WEIGHTS;
  const target = opts.target ?? 98;
  const diffDir = join(opts.outDir, 'diffs');
  await mkdir(diffDir, { recursive: true });

  const start = Date.now();
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctxOpts = {
      viewport: { width: opts.viewport.width, height: opts.viewport.height },
      deviceScaleFactor: opts.viewport.dsf,
    };
    const refCtx = await browser.newContext(ctxOpts);
    const candCtx = await browser.newContext(ctxOpts);

    let refStates: CapturedState[] = [];
    let candStates: CapturedState[] = [];
    try {
      // Reference captures the mask shot (second load); candidate does not.
      refStates = await driveAll(
        refCtx,
        'reference',
        opts.reference,
        opts.states,
        opts.outDir,
        true,
        opts.onProgress,
      );
      candStates = await driveAll(
        candCtx,
        'candidate',
        opts.candidate,
        opts.states,
        opts.outDir,
        false,
        opts.onProgress,
      );
    } finally {
      await Promise.allSettled([refCtx.close(), candCtx.close()]);
    }

    opts.onProgress?.('  scoring avenues...');
    const visual = await scoreVisualAvenue({
      reference: refStates,
      candidate: candStates,
      diffDir,
      weight: weights.visual,
    });
    const dom = scoreDomAvenue({
      reference: refStates,
      candidate: candStates,
      weight: weights.dom,
    });
    const api = scoreApiAvenue({
      reference: flattenResponses(refStates),
      candidate: flattenResponses(candStates),
      weight: weights.api,
    });
    const state = scoreStateAvenue({
      cases: opts.stateCases ?? [],
      weight: weights.state,
    });
    const transition = scoreTransitionAvenue({
      states: opts.states,
      reference: refStates,
      candidate: candStates,
      weight: weights.transition,
    });

    const avenues: AvenueScore[] = [visual, dom, api, state, transition];
    const report = buildReport({
      reference: opts.reference,
      candidate: opts.candidate,
      viewport: opts.viewport,
      weights,
      avenues,
      target,
      durationMs: Date.now() - start,
    });

    const { jsonPath, mdPath } = await writeReports(opts.outDir, report);
    await appendHistory(opts.historyPath, report);

    return { report, jsonPath, mdPath };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}
