import type { Scoreboard, ShellScoreboard } from '../types.js';
import { SHELL_REGIONS } from '../config.js';

function fmt(n: number | null): string {
  if (n === null) return 'n/a';
  return (n * 100).toFixed(1) + '%';
}

function verdict(v: string): string {
  if (v === 'pass') return 'PASS';
  if (v === 'oracle-only') return 'ORACLE-ONLY';
  return 'FAIL';
}

export function buildMarkdownReport(board: Scoreboard): string {
  const lines: string[] = [];

  lines.push(`# Parity Report — ${board.runId}`);
  lines.push('');
  lines.push(`**Oracle:** ${board.oracle}`);
  lines.push(`**React:** ${board.react}`);
  lines.push('');

  lines.push('## Per-Route Scores');
  lines.push('');
  lines.push('| Route | Pixel | DOM | Functional | Verdict | Oracle Screenshot | React Screenshot | Diff |');
  lines.push('|-------|-------|-----|------------|---------|-------------------|------------------|------|');

  for (const r of board.results) {
    const oracle = r.oracleScreenshot ?? 'n/a';
    const react = r.reactScreenshot ?? (r.reactUnreachable ? 'react: unreachable' : 'n/a');
    const diff = r.diffScreenshot ?? 'n/a';
    lines.push(
      `| ${r.route} | ${fmt(r.pixel)} | ${fmt(r.dom)} | ${r.functional} | ${verdict(r.verdict)} | ${oracle} | ${react} | ${diff} |`,
    );
  }

  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Pixel mean | ${fmt(board.aggregate.pixel_mean)} |`);
  lines.push(`| DOM mean | ${fmt(board.aggregate.dom_mean)} |`);
  lines.push(`| Pass rate | ${fmt(board.aggregate.pass_rate)} |`);
  lines.push('');

  return lines.join('\n');
}

export function buildShellMarkdownReport(board: ShellScoreboard): string {
  const lines: string[] = [];

  lines.push(`# Shell Parity Report — ${board.runId}`);
  lines.push('');
  lines.push(`**Mode:** shell-only (content area masked)`);
  lines.push(`**Oracle:** ${board.oracle}`);
  lines.push(`**React:** ${board.react}`);
  lines.push(`**Pass criteria:** pixel ≥ ${fmt(board.shellPixelThreshold)}  DOM ≥ ${fmt(board.shellDomThreshold)}`);
  lines.push('');

  lines.push('## Shell Regions Masked');
  lines.push('');
  lines.push('| Region | x | y | w | h |');
  lines.push('|--------|---|---|---|---|');
  for (const r of SHELL_REGIONS) {
    lines.push(`| ${r.label} | ${r.x} | ${r.y} | ${r.w} | ${r.h} |`);
  }
  lines.push('');

  lines.push('## Per-Route Shell Scores');
  lines.push('');
  lines.push('| Route | Pixel | DOM | Verdict | Oracle Masked | React Masked | Diff |');
  lines.push('|-------|-------|-----|---------|---------------|--------------|------|');

  for (const r of board.results) {
    const oracleMasked = r.oracleMaskedScreenshot ?? 'n/a';
    const reactMasked = r.reactMaskedScreenshot ?? (r.reactUnreachable ? 'react: unreachable' : 'n/a');
    const diff = r.diffScreenshot ?? 'n/a';
    lines.push(
      `| ${r.route} | ${fmt(r.pixel)} | ${fmt(r.dom)} | ${verdict(r.verdict)} | ${oracleMasked} | ${reactMasked} | ${diff} |`,
    );
  }

  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Pixel mean | ${fmt(board.aggregate.pixel_mean)} |`);
  lines.push(`| DOM mean | ${fmt(board.aggregate.dom_mean)} |`);
  lines.push(`| Pass rate | ${fmt(board.aggregate.pass_rate)} |`);
  lines.push('');

  return lines.join('\n');
}
