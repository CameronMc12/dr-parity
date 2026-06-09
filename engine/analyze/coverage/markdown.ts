/**
 * Markdown renderers for each coverage report plus the top-line dashboard.
 */

import { basename } from 'node:path';
import type {
  CoverageReport,
  EndpointCoverage,
  InteractionCoverage,
  RouteCoverage,
} from './types.js';
import { INTERACTION_CLASSES } from './types.js';

function bar(pct: number): string {
  const filled = Math.round(pct / 5);
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${pct}%`;
}

export function renderEndpointMd(c: EndpointCoverage): string {
  const lines: string[] = [];
  lines.push('# Endpoint Coverage');
  lines.push('');
  lines.push(`Overall: **${c.overall.hit}/${c.overall.total}** (${c.overall.pct}%) ${bar(c.overall.pct)}`);
  lines.push('');
  lines.push('## Per service');
  lines.push('');
  lines.push('| Service | Hit | Total | % |');
  lines.push('| --- | --: | --: | --: |');
  for (const s of c.byService) lines.push(`| ${s.service} | ${s.hit} | ${s.total} | ${s.pct}% |`);
  lines.push('');
  lines.push(`## MISSED endpoints (${c.missed.length})`);
  lines.push('');
  if (c.missed.length === 0) {
    lines.push('_None — full endpoint coverage._');
  } else {
    lines.push('| surface calls | method | pathTemplate |');
    lines.push('| --: | --- | --- |');
    for (const m of c.missed) lines.push(`| ${m.surfaceCount} | ${m.method} | \`${m.pathTemplate}\` |`);
  }
  lines.push('');
  lines.push(`## New discoveries (hit in run, not in surface map) — ${c.newDiscoveries.length}`);
  lines.push('');
  if (c.newDiscoveries.length === 0) {
    lines.push('_None._');
  } else {
    lines.push('| run calls | method | pathTemplate |');
    lines.push('| --: | --- | --- |');
    for (const d of c.newDiscoveries) lines.push(`| ${d.runCount} | ${d.method} | \`${d.pathTemplate}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function renderRouteMd(c: RouteCoverage): string {
  const lines: string[] = [];
  lines.push('# Route Coverage');
  lines.push('');
  lines.push(`Overall: **${c.overall.hit}/${c.overall.total}** (${c.overall.pct}%) ${bar(c.overall.pct)}`);
  lines.push('');
  lines.push('## Visited routes');
  lines.push('');
  lines.push('| surface count | pattern | matched via |');
  lines.push('| --: | --- | --- |');
  for (const r of c.routes.filter((x) => x.hit)) {
    lines.push(`| ${r.surfaceCount} | \`${r.pattern}\` | ${r.source} |`);
  }
  lines.push('');
  lines.push(`## MISSED routes (${c.missed.length})`);
  lines.push('');
  if (c.missed.length === 0) {
    lines.push('_None — every observed nav pattern was visited._');
  } else {
    lines.push('| surface count | pattern |');
    lines.push('| --: | --- |');
    for (const m of c.missed) lines.push(`| ${m.surfaceCount} | \`${m.pattern}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function renderInteractionMd(c: InteractionCoverage): string {
  const lines: string[] = [];
  lines.push('# Interaction Coverage');
  lines.push('');
  lines.push(`Captured states: **${c.totalStates}**`);
  lines.push('');
  lines.push('## By interaction class');
  lines.push('');
  lines.push('| class | states | status |');
  lines.push('| --- | --: | --- |');
  for (const cls of INTERACTION_CLASSES) {
    const n = c.byClass[cls];
    lines.push(`| ${cls} | ${n} | ${n === 0 ? '⚠️ ZERO — harness did not fire' : 'ok'} |`);
  }
  lines.push('');
  if (c.emptyClasses.length > 0) {
    lines.push(`> **Coverage holes:** ${c.emptyClasses.join(', ')} had zero captures.`);
    lines.push('');
  }
  lines.push('## Raw labels');
  lines.push('');
  lines.push('| label | count |');
  lines.push('| --- | --: |');
  for (const [label, n] of Object.entries(c.byLabel).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${label}\` | ${n} |`);
  }
  lines.push('');
  const unclassified = Object.entries(c.unclassified);
  if (unclassified.length > 0) {
    lines.push('## Unclassified labels (not mapped to a known class)');
    lines.push('');
    for (const [label, n] of unclassified.sort((a, b) => b[1] - a[1])) {
      lines.push(`- \`${label}\` (${n})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function renderDashboardMd(report: CoverageReport): string {
  const { endpoint, route, interaction } = report;
  const lines: string[] = [];
  lines.push('# Crawl Coverage Dashboard');
  lines.push('');
  lines.push(`Run: \`${basename(report.runDir)}\``);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  if (report.missingInputs.length > 0) {
    lines.push(`> ⚠️ Missing inputs: ${report.missingInputs.join(', ')}`);
    lines.push('');
  }
  lines.push('## Top line');
  lines.push('');
  lines.push('| metric | value |');
  lines.push('| --- | --- |');
  lines.push(`| Endpoint coverage | ${endpoint.overall.hit}/${endpoint.overall.total} (${endpoint.overall.pct}%) |`);
  lines.push(`| Route coverage | ${route.overall.hit}/${route.overall.total} (${route.overall.pct}%) |`);
  lines.push(`| States captured | ${interaction.totalStates} |`);
  lines.push(`| New endpoint discoveries | ${endpoint.newDiscoveries.length} |`);
  lines.push('');
  lines.push('### Interaction classes fired');
  lines.push('');
  for (const cls of INTERACTION_CLASSES) {
    const n = interaction.byClass[cls];
    lines.push(`- ${n === 0 ? '❌' : '✅'} **${cls}**: ${n}`);
  }
  lines.push('');
  lines.push('## GAPS TO CLOSE (prioritized)');
  lines.push('');
  lines.push('Highest-traffic missed endpoints first (by surface-map call count):');
  lines.push('');
  const topMissed = endpoint.missed.slice(0, 25);
  if (topMissed.length === 0) {
    lines.push('_No missed endpoints._');
  } else {
    lines.push('| surface calls | method | pathTemplate |');
    lines.push('| --: | --- | --- |');
    for (const m of topMissed) lines.push(`| ${m.surfaceCount} | ${m.method} | \`${m.pathTemplate}\` |`);
  }
  lines.push('');
  if (interaction.emptyClasses.length > 0) {
    lines.push('### Interaction holes');
    lines.push('');
    for (const cls of interaction.emptyClasses) {
      lines.push(`- ❌ **${cls}** never fired — harness coverage hole.`);
    }
    lines.push('');
  }
  if (route.missed.length > 0) {
    lines.push('### Top missed routes');
    lines.push('');
    for (const m of route.missed.slice(0, 10)) {
      lines.push(`- \`${m.pattern}\` (${m.surfaceCount} surface hits)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
