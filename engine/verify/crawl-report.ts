/**
 * Render a CompletenessReport to crawl-gap-report.md + crawl-gap-report.json.
 * Markdown is for humans (ranked gaps first); JSON is for downstream tooling.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CompletenessReport, CrawlGap, GapKind } from './crawl-completeness';

const GAP_TITLES: Record<GapKind, string> = {
  'uncaptured-target': 'Discovered but uncaptured targets',
  'referenced-route': 'Routes referenced by links but never captured',
  'errored-state': 'States / interactions with errors',
  'empty-state': 'States with empty bodies',
  'unfollowed-popup': 'Popups / new tabs not followed',
};

const GAP_ORDER: GapKind[] = [
  'uncaptured-target',
  'referenced-route',
  'unfollowed-popup',
  'errored-state',
  'empty-state',
];

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

function gapsByKind(gaps: CrawlGap[]): Map<GapKind, CrawlGap[]> {
  const map = new Map<GapKind, CrawlGap[]>();
  for (const g of gaps) {
    const list = map.get(g.kind) ?? [];
    list.push(g);
    map.set(g.kind, list);
  }
  return map;
}

function discoveryCurveBlock(report: CompletenessReport): string[] {
  const lines: string[] = [];
  const curve = report.discoveryCurve;
  if (curve.length === 0) {
    lines.push('_No interactions recorded; discovery curve unavailable._');
    return lines;
  }
  // Sample at most ~20 points so the table stays readable.
  const step = Math.max(1, Math.ceil(curve.length / 20));
  lines.push('| Interaction | Distinct states |');
  lines.push('|-------------|-----------------|');
  for (let i = 0; i < curve.length; i += step) {
    const p = curve[i];
    lines.push(`| ${p.interaction} | ${p.distinctStates} |`);
  }
  const last = curve[curve.length - 1];
  if ((curve.length - 1) % step !== 0) {
    lines.push(`| ${last.interaction} | ${last.distinctStates} |`);
  }
  return lines;
}

export function renderMarkdown(report: CompletenessReport): string {
  const lines: string[] = [];
  lines.push('# Crawl Completeness & Gap Report');
  lines.push('');
  lines.push(`- Crawl dir: \`${report.crawlDir}\``);
  lines.push(`- Distinct routes: ${report.distinctRoutes}`);
  lines.push(`- Distinct canonical states: ${report.distinctStates}`);
  lines.push(`- Total captured states: ${report.totalStates}`);
  lines.push(`- Total interactions: ${report.totalInteractions}`);
  lines.push(`- Dedup ratio: ${pct(report.dedupRatio)} (distinct / total states)`);
  lines.push(
    `- Recent discovery rate: ${pct(report.recentDiscoveryRate)} ` +
      `(over the last interactions)`,
  );
  lines.push(`- **Saturated: ${report.saturated ? 'yes' : 'no'}**`);
  lines.push('');
  lines.push('## Completeness verdict');
  lines.push('');
  lines.push(report.verdict);
  lines.push('');

  lines.push('## New-state discovery curve');
  lines.push('');
  lines.push(...discoveryCurveBlock(report));
  lines.push('');

  lines.push('## Gap summary');
  lines.push('');
  lines.push('| Gap kind | Count |');
  lines.push('|----------|-------|');
  for (const kind of GAP_ORDER) {
    lines.push(`| ${GAP_TITLES[kind]} | ${report.gapCounts[kind]} |`);
  }
  lines.push('');

  const byKind = gapsByKind(report.gaps);
  lines.push('## Ranked gaps (most important first)');
  lines.push('');
  if (report.gaps.length === 0) {
    lines.push('_No gaps detected. Capture looks complete for the known graph._');
    lines.push('');
  }
  for (const kind of GAP_ORDER) {
    const list = byKind.get(kind);
    if (!list || list.length === 0) continue;
    lines.push(`### ${GAP_TITLES[kind]} (${list.length})`);
    lines.push('');
    lines.push('| Rank | Importance | Label | Reason | Locator | From |');
    lines.push('|------|-----------|-------|--------|---------|------|');
    list
      .sort((a, b) => b.importance - a.importance)
      .forEach((g, i) => {
        lines.push(
          `| ${i + 1} | ${g.importance} | ${escapeCell(g.label)} | ${escapeCell(
            g.reason,
          )} | \`${escapeCell(g.locator)}\` | ${g.fromStateId ?? ''} |`,
        );
      });
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of report.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  return lines.join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export type WriteResult = { mdPath: string; jsonPath: string };

export function writeCrawlReport(
  outDir: string,
  report: CompletenessReport,
): WriteResult {
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'crawl-gap-report.md');
  const jsonPath = join(outDir, 'crawl-gap-report.json');
  writeFileSync(mdPath, renderMarkdown(report), 'utf8');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { mdPath, jsonPath };
}
