/**
 * Final summary + run-report serialisation for rebuild-pro.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatDuration } from './run-phase';
import type { OrchestratorContext, PhaseResult, RunReport } from './types';

function pad(text: string, width: number): string {
  if (text.length >= width) return text;
  return text + ' '.repeat(width - text.length);
}

function statusGlyph(status: PhaseResult['status']): string {
  switch (status) {
    case 'success':
      return 'ok';
    case 'failed':
      return 'FAIL';
    case 'skipped':
      return 'skip';
    case 'running':
      return 'run';
    default:
      return 'pend';
  }
}

export function printSummary(results: PhaseResult[]): void {
  process.stdout.write('\nPhase summary:\n');
  const rows: string[][] = [['#', 'phase', 'status', 'duration', 'outputs']];
  for (const r of results) {
    rows.push([
      String(r.id),
      r.slug,
      statusGlyph(r.status),
      formatDuration(r.durationMs),
      (r.outputs[0] ?? '').toString(),
    ]);
  }
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map((row) => row[col].length)),
  );
  for (const row of rows) {
    const line = row.map((cell, i) => pad(cell, widths[i])).join('  ');
    process.stdout.write(`  ${line}\n`);
  }

  for (const r of results) {
    if (r.warning) process.stdout.write(`  warn[${r.slug}]: ${r.warning}\n`);
    if (r.error) process.stdout.write(`  fail[${r.slug}]: ${r.error}\n`);
  }
}

export function buildReport(
  ctx: OrchestratorContext,
  startedAt: Date,
  finishedAt: Date,
): RunReport {
  const hasFailure = ctx.results.some((r) => r.status === 'failed');
  const hasSuccess = ctx.results.some((r) => r.status === 'success');
  const status: RunReport['status'] = hasFailure
    ? hasSuccess
      ? 'partial'
      : 'failed'
    : 'success';
  return {
    cloneDir: ctx.cloneDir,
    outDir: ctx.outDir,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalDurationMs: finishedAt.getTime() - startedAt.getTime(),
    status,
    phases: ctx.results,
  };
}

export function writeReport(ctx: OrchestratorContext, report: RunReport): string {
  const target = join(ctx.outDir, 'dr-parity-run.json');
  writeFileSync(target, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return target;
}
