/**
 * Per-phase parity snapshot helper.
 *
 * Builds the Astro output, snapshots dist, runs verify:parity against
 * the captured clone, and reports the diff delta versus the prior
 * snapshot. Used by aggressive-mode phases (5 and 6) to flag
 * parity-degrading transforms.
 */

import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

import type { OrchestratorContext } from './types';

const SNAPSHOT_DIR = '.dr-parity-snapshots';
const PARITY_REPORT_FILE = 'parity-report/summary.json';
const PARITY_DEGRADE_THRESHOLD = 0.01;

export interface ParityResult {
  before: number | null;
  after: number | null;
  delta: number | null;
  degraded: boolean;
  reason?: string;
}

function snapshotRoot(ctx: OrchestratorContext): string {
  return join(ctx.outDir, SNAPSHOT_DIR);
}

function buildOnce(ctx: OrchestratorContext): Promise<void> {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn('npm', ['run', 'build'], {
      cwd: ctx.outDir,
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', rejectBuild);
    child.on('close', (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`snapshot build exited with code ${code}`));
    });
  });
}

function runVerifyParity(ctx: OrchestratorContext, distDir: string): Promise<void> {
  return new Promise((resolveVerify, rejectVerify) => {
    const child = spawn(
      'npm',
      [
        'run',
        'verify:parity',
        '--',
        `--clone=${ctx.cloneDir}`,
        `--rebuilt=${distDir}`,
        '--threshold=0.01',
      ],
      { cwd: ctx.repoRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.on('error', rejectVerify);
    child.on('close', () => resolveVerify());
  });
}

function readDiffRatio(distDir: string): number | null {
  const distRoot = distDir.replace(/\/dist$/, '');
  const reportPath = join(distRoot, PARITY_REPORT_FILE);
  if (!existsSync(reportPath)) return null;
  try {
    const raw = readFileSync(reportPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'diffRatio' in parsed &&
      typeof (parsed as { diffRatio: unknown }).diffRatio === 'number'
    ) {
      return (parsed as { diffRatio: number }).diffRatio;
    }
  } catch {
    return null;
  }
  return null;
}

function copyDist(srcDist: string, destDist: string): void {
  if (existsSync(destDist)) rmSync(destDist, { recursive: true, force: true });
  cpSync(srcDist, destDist, { recursive: true });
}

export async function snapshotBefore(
  ctx: OrchestratorContext,
  slug: string,
): Promise<number | null> {
  const dist = join(ctx.outDir, 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) return null;
  const snapDist = join(snapshotRoot(ctx), slug, 'dist');
  copyDist(dist, snapDist);
  await runVerifyParity(ctx, snapDist);
  return readDiffRatio(snapDist);
}

export async function snapshotAfter(
  ctx: OrchestratorContext,
  beforeRatio: number | null,
): Promise<ParityResult> {
  try {
    await buildOnce(ctx);
  } catch (err) {
    return {
      before: beforeRatio,
      after: null,
      delta: null,
      degraded: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  const dist = join(ctx.outDir, 'dist');
  await runVerifyParity(ctx, dist);
  const after = readDiffRatio(dist);
  if (beforeRatio === null || after === null) {
    return { before: beforeRatio, after, delta: null, degraded: false };
  }
  const delta = after - beforeRatio;
  return {
    before: beforeRatio,
    after,
    delta,
    degraded: delta > PARITY_DEGRADE_THRESHOLD,
  };
}
