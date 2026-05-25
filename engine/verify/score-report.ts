import { writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ParityScoreReport, StateScore } from './score-types';

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export async function writeScoreJson(
  outDir: string,
  report: ParityScoreReport,
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, 'parity-report.json');
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return path;
}

type RankedState = StateScore & { path: string };

function collectRanked(report: ParityScoreReport): RankedState[] {
  const all: RankedState[] = [];
  for (const route of report.routes) {
    for (const state of route.states) {
      all.push({ ...state, path: route.path });
    }
  }
  return all.sort((a, b) => a.blended - b.blended);
}

function fmtFunctional(score: number | null): string {
  return score === null ? 'n/a' : pct(score);
}

export async function writeScoreMarkdown(
  outDir: string,
  report: ParityScoreReport,
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, 'parity-report.md');
  const ranked = collectRanked(report);
  const w = report.weights;

  const lines: string[] = [];
  lines.push('# Parity Score Report');
  lines.push('');
  lines.push(`- Reference: \`${report.reference}\``);
  lines.push(`- Candidate: \`${report.candidate}\``);
  lines.push(`- Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height}@${report.viewport.dsf}x)`);
  lines.push(`- Weights: visual ${w.visual}, dom ${w.dom}, functional ${w.functional}`);
  lines.push(`- Duration: ${(report.durationMs / 1000).toFixed(2)}s`);
  lines.push(`- **Overall parity: ${pct(report.overallScore)}**`);
  lines.push('');

  lines.push('## Gaps ranked (lowest score first)');
  lines.push('');
  lines.push('| Rank | Route | State | Blended | Visual | DOM | Func | Diff image | Notes |');
  lines.push('|------|-------|-------|---------|--------|-----|------|-----------|-------|');
  ranked.forEach((s, i) => {
    const diffRel = relative(outDir, s.diffShot) || s.diffShot;
    const notes = s.notes.length > 0 ? s.notes.join('; ') : '';
    lines.push(
      `| ${i + 1} | \`${s.path}\` | ${s.state} | ${pct(s.blended)} | ${pct(s.visualScore)} | ${pct(s.domScore)} | ${fmtFunctional(s.functionalScore)} | \`${diffRel}\` | ${notes} |`,
    );
  });
  lines.push('');

  lines.push('## Per-route summary');
  lines.push('');
  lines.push('| Route | Label | States | Route score |');
  lines.push('|-------|-------|--------|-------------|');
  for (const route of [...report.routes].sort((a, b) => a.routeScore - b.routeScore)) {
    lines.push(`| \`${route.path}\` | ${route.label} | ${route.states.length} | ${pct(route.routeScore)} |`);
  }
  lines.push('');

  await writeFile(path, lines.join('\n'), 'utf8');
  return path;
}

export function printTopGaps(report: ParityScoreReport): void {
  const ranked = collectRanked(report).slice(0, 5);
  process.stdout.write(`\nOverall parity: ${pct(report.overallScore)}\n`);
  process.stdout.write('\nTop 5 gaps (lowest blended score):\n');
  ranked.forEach((s, i) => {
    process.stdout.write(
      `  ${i + 1}. ${s.path} [${s.state}] -> ${pct(s.blended)} (visual ${pct(s.visualScore)}, dom ${pct(s.domScore)}, func ${fmtFunctional(s.functionalScore)})\n`,
    );
  });
}
