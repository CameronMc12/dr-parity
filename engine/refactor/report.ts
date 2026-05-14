import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProtectionCounters, RefactorReport } from './types';

export function emptyProtectionCounters(): ProtectionCounters {
  return {
    protectedElements: 0,
    protectedByCause: { customElement: 0, dataAttr: 0, ancestor: 0 },
    wouldHaveSwapped: 0,
  };
}

export function emptyReport(): RefactorReport {
  return {
    filesScanned: 0,
    filesRefactored: 0,
    filesSkipped: [],
    primitivesUsed: {},
    iconsUsed: {},
    classSwapsBySection: {},
    iconSwapsBySection: {},
    protection: emptyProtectionCounters(),
  };
}

export function bumpCount(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

export function mergeProtection(
  target: ProtectionCounters,
  source: ProtectionCounters,
): void {
  target.protectedElements += source.protectedElements;
  target.protectedByCause.customElement += source.protectedByCause.customElement;
  target.protectedByCause.dataAttr += source.protectedByCause.dataAttr;
  target.protectedByCause.ancestor += source.protectedByCause.ancestor;
  target.wouldHaveSwapped += source.wouldHaveSwapped;
}

export async function writeReport(
  componentsDir: string,
  report: RefactorReport,
): Promise<string> {
  const analysisDir = path.resolve(componentsDir, '..', 'analysis');
  await mkdir(analysisDir, { recursive: true });
  const outFile = path.join(analysisDir, 'refactor-report.json');
  await writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');
  return outFile;
}

export function renderSummaryTable(report: RefactorReport): string {
  const lines: string[] = [];
  lines.push('refactor-sections summary');
  lines.push('─────────────────────────');
  lines.push(`Files scanned    : ${report.filesScanned}`);
  lines.push(`Files refactored : ${report.filesRefactored}`);
  lines.push(`Files skipped    : ${report.filesSkipped.length}`);

  const primTotal = sumValues(report.primitivesUsed);
  const iconTotal = sumValues(report.iconsUsed);
  lines.push(`Primitive swaps  : ${primTotal} (${Object.keys(report.primitivesUsed).length} distinct)`);
  lines.push(`Icon swaps       : ${iconTotal} (${Object.keys(report.iconsUsed).length} distinct)`);

  const p = report.protection;
  lines.push(`Protected els    : ${p.protectedElements} (custom=${p.protectedByCause.customElement}, data=${p.protectedByCause.dataAttr}, ancestor=${p.protectedByCause.ancestor})`);
  lines.push(`Swaps blocked    : ${p.wouldHaveSwapped}`);

  if (report.filesSkipped.length > 0) {
    lines.push('');
    lines.push('Skipped:');
    for (const s of report.filesSkipped.slice(0, 10)) {
      lines.push(`  - ${s.path}: ${s.reason}`);
    }
    if (report.filesSkipped.length > 10) {
      lines.push(`  ... (${report.filesSkipped.length - 10} more)`);
    }
  }

  return lines.join('\n');
}

function sumValues(obj: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(obj)) total += v;
  return total;
}
