/**
 * Aggregator: blends per-avenue scores into a weighted overall, builds the
 * ranked gap ledger, writes parity-report.{json,md}, and appends one line to
 * parity-history.jsonl so refinement is tracked over time.
 */

import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  AvenueName,
  AvenueScore,
  AvenueWeights,
  Gap,
  ParityHistoryEntry,
  ParityTrackReport,
} from './avenue-types';
import { AVENUE_NAMES } from './avenue-types';

export type AggregateInput = {
  reference: string;
  candidate: string;
  viewport: { name: string; width: number; height: number; dsf: number };
  weights: AvenueWeights;
  avenues: AvenueScore[];
  target: number;
  durationMs: number;
};

/** Weighted overall over NON-skipped avenues, weights re-normalized. */
function weightedOverall(avenues: AvenueScore[], weights: AvenueWeights): number {
  let weightSum = 0;
  let acc = 0;
  for (const a of avenues) {
    if (a.skipped) continue;
    const w = weights[a.avenue];
    weightSum += w;
    acc += w * a.score;
  }
  return weightSum > 0 ? acc / weightSum : 0;
}

function buildGapLedger(avenues: AvenueScore[]): Gap[] {
  const all: Gap[] = [];
  for (const a of avenues) all.push(...a.gaps);
  return all.sort((x, y) => y.severity - x.severity);
}

export function buildReport(input: AggregateInput): ParityTrackReport {
  const overall = weightedOverall(input.avenues, input.weights);
  const passed = input.avenues
    .filter((a) => !a.skipped)
    .every((a) => a.score >= input.target);
  return {
    reference: input.reference,
    candidate: input.candidate,
    viewport: input.viewport,
    weights: input.weights,
    avenues: input.avenues,
    overall,
    target: input.target,
    passed,
    gapLedger: buildGapLedger(input.avenues),
    generatedAt: new Date().toISOString(),
    durationMs: input.durationMs,
  };
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function scoreByAvenue(report: ParityTrackReport): Record<AvenueName, AvenueScore | undefined> {
  const map: Partial<Record<AvenueName, AvenueScore>> = {};
  for (const a of report.avenues) map[a.avenue] = a;
  return map as Record<AvenueName, AvenueScore | undefined>;
}

export async function writeReports(
  outDir: string,
  report: ParityTrackReport,
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, 'parity-report.json');
  const mdPath = join(outDir, 'parity-report.md');

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const byAvenue = scoreByAvenue(report);
  const lines: string[] = [];
  lines.push('# Parity Tracking Report');
  lines.push('');
  lines.push(`- Reference: \`${report.reference}\``);
  lines.push(`- Candidate: \`${report.candidate}\``);
  lines.push(
    `- Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height}@${report.viewport.dsf}x)`,
  );
  lines.push(`- Duration: ${(report.durationMs / 1000).toFixed(2)}s`);
  lines.push(`- Target per avenue: ${pct(report.target)}`);
  lines.push(`- **Overall parity: ${pct(report.overall)}** ${report.passed ? '(PASS)' : '(below target)'}`);
  lines.push('');

  lines.push('## Avenue scores');
  lines.push('');
  lines.push('| Avenue | Score | Weight | Samples | Gaps | Status |');
  lines.push('|--------|-------|--------|---------|------|--------|');
  for (const name of AVENUE_NAMES) {
    const a = byAvenue[name];
    if (!a) continue;
    const status = a.skipped ? 'skipped' : a.score >= report.target ? 'pass' : 'below';
    const score = a.skipped ? 'n/a' : pct(a.score);
    lines.push(
      `| ${name} | ${score} | ${report.weights[name]} | ${a.sampleSize} | ${a.gaps.length} | ${status} |`,
    );
  }
  lines.push('');

  lines.push('## Ranked gap ledger (most severe first)');
  lines.push('');
  if (report.gapLedger.length === 0) {
    lines.push('_No gaps. Full parity on every scored avenue._');
  } else {
    lines.push('| Rank | Avenue | Severity | Label | Reason | Locator |');
    lines.push('|------|--------|----------|-------|--------|---------|');
    report.gapLedger.slice(0, 60).forEach((g, i) => {
      const loc = g.locator ? `\`${relative(outDir, g.locator) || g.locator}\`` : '';
      lines.push(
        `| ${i + 1} | ${g.avenue} | ${g.severity.toFixed(1)} | ${g.label} | ${g.reason} | ${loc} |`,
      );
    });
    if (report.gapLedger.length > 60) {
      lines.push('');
      lines.push(`_+${report.gapLedger.length - 60} more gaps in parity-report.json._`);
    }
  }
  lines.push('');

  const notesAvenues = report.avenues.filter((a) => a.notes.length > 0);
  if (notesAvenues.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const a of notesAvenues) {
      for (const note of a.notes.slice(0, 10)) lines.push(`- [${a.avenue}] ${note}`);
    }
    lines.push('');
  }

  await writeFile(mdPath, lines.join('\n'), 'utf8');
  return { jsonPath, mdPath };
}

export async function appendHistory(
  historyPath: string,
  report: ParityTrackReport,
): Promise<void> {
  const scores = {} as Record<AvenueName, number | null>;
  for (const name of AVENUE_NAMES) {
    const a = report.avenues.find((x) => x.avenue === name);
    scores[name] = a && !a.skipped ? Number(a.score.toFixed(2)) : null;
  }
  const entry: ParityHistoryEntry = {
    timestamp: report.generatedAt,
    reference: report.reference,
    candidate: report.candidate,
    viewport: report.viewport.name,
    overall: Number(report.overall.toFixed(2)),
    scores,
    passed: report.passed,
    topGap: report.gapLedger[0]
      ? `${report.gapLedger[0].avenue}: ${report.gapLedger[0].label}`
      : null,
  };
  await appendFile(historyPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export function printSummary(report: ParityTrackReport): void {
  const out = process.stdout;
  out.write(`\nOverall parity: ${pct(report.overall)} ${report.passed ? '(PASS)' : '(below target)'}\n`);
  out.write('Per-avenue:\n');
  for (const name of AVENUE_NAMES) {
    const a = report.avenues.find((x) => x.avenue === name);
    if (!a) continue;
    const score = a.skipped ? 'skipped' : pct(a.score);
    out.write(`  ${name.padEnd(11)} ${score.padStart(8)}  (${a.sampleSize} samples, ${a.gaps.length} gaps)\n`);
  }
  if (report.gapLedger.length > 0) {
    out.write('\nTop gaps:\n');
    report.gapLedger.slice(0, 5).forEach((g, i) => {
      out.write(`  ${i + 1}. [${g.avenue}] ${g.label} — ${g.reason}\n`);
    });
  }
}
