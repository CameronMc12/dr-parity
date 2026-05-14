import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParityReport, ViewportResult } from './types';

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(3)}%`;
}

function formatStatus(pass: boolean): string {
  return pass ? 'PASS' : 'FAIL';
}

export async function writeJsonReport(outDir: string, report: ParityReport): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, 'summary.json');
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return path;
}

function buildMarkdown(report: ParityReport): string {
  const lines: string[] = [];
  lines.push('# Parity Report');
  lines.push('');
  lines.push(`- Clone: \`${report.clone}\``);
  lines.push(`- Rebuilt: \`${report.rebuilt}\``);
  lines.push(`- Threshold: ${formatPercent(report.thresholdRatio)}`);
  lines.push(`- Duration: ${(report.durationMs / 1000).toFixed(2)}s`);
  lines.push(`- Overall: **${formatStatus(report.overallPass)}**`);
  lines.push('');
  lines.push('| Viewport | Size | DSF | Diff | Mismatched / Total | Result |');
  lines.push('|----------|------|-----|------|--------------------|--------|');
  for (const v of report.viewports) {
    const size = `${v.width}x${v.height}`;
    const ratios = `${formatPercent(v.diffRatio)}`;
    const counts = `${v.mismatchedPixels} / ${v.totalPixels}`;
    lines.push(`| ${v.name} | ${size} | ${v.dsf}x | ${ratios} | ${counts} | ${formatStatus(v.pass)} |`);
  }
  lines.push('');
  if (!report.overallPass) {
    lines.push('## If failed');
    lines.push('');
    lines.push('- Open `<viewport>/diff.png` for each failing viewport to see highlighted regions.');
    lines.push('- Compare `clone.png` vs `rebuilt.png` side-by-side.');
    lines.push('- Common causes: missing fonts, layout shifts, animation timing, image loading.');
    lines.push('- Re-run with a higher `--threshold` only if the diff is acceptable.');
    lines.push('');
  }
  return lines.join('\n');
}

export async function writeMarkdownReport(outDir: string, report: ParityReport): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, 'summary.md');
  await writeFile(path, buildMarkdown(report), 'utf8');
  return path;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function printStdoutTable(viewports: ViewportResult[], overallPass: boolean): void {
  const headers = ['VIEWPORT', 'SIZE', 'DIFF', 'RESULT'];
  const rows = viewports.map((v) => [
    v.name,
    `${v.width}x${v.height}@${v.dsf}x`,
    formatPercent(v.diffRatio),
    formatStatus(v.pass),
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );

  const renderRow = (cells: string[]): string =>
    cells.map((cell, i) => pad(cell, widths[i]!)).join('  ');

  process.stdout.write(`${renderRow(headers)}\n`);
  process.stdout.write(`${widths.map((w) => '-'.repeat(w)).join('  ')}\n`);
  for (const row of rows) {
    process.stdout.write(`${renderRow(row)}\n`);
  }
  process.stdout.write(`\nOverall: ${formatStatus(overallPass)}\n`);
}
