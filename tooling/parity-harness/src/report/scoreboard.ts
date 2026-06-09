import type { RouteResult, Scoreboard, ShellRouteResult, ShellScoreboard } from '../types.js';
import { ORACLE_BASE, REACT_BASE, SHELL_PIXEL_THRESHOLD, SHELL_DOM_THRESHOLD } from '../config.js';

export function buildScoreboard(runId: string, results: RouteResult[]): Scoreboard {
  // Only include routes where both sides ran for aggregate scoring
  const scored = results.filter(r => r.pixel !== null && r.dom !== null);

  const pixel_mean = scored.length === 0
    ? null
    : scored.reduce((s, r) => s + (r.pixel ?? 0), 0) / scored.length;

  const dom_mean = scored.length === 0
    ? null
    : scored.reduce((s, r) => s + (r.dom ?? 0), 0) / scored.length;

  const passCount = results.filter(r => r.verdict === 'pass' || r.verdict === 'oracle-only').length;
  const pass_rate = results.length === 0 ? 1 : passCount / results.length;

  return {
    runId,
    oracle: ORACLE_BASE,
    react: REACT_BASE,
    results,
    aggregate: { pixel_mean, dom_mean, pass_rate },
  };
}

export function buildShellScoreboard(runId: string, results: ShellRouteResult[]): ShellScoreboard {
  const scored = results.filter(r => r.pixel !== null && r.dom !== null);

  const pixel_mean = scored.length === 0
    ? null
    : scored.reduce((s, r) => s + (r.pixel ?? 0), 0) / scored.length;

  const dom_mean = scored.length === 0
    ? null
    : scored.reduce((s, r) => s + (r.dom ?? 0), 0) / scored.length;

  const passCount = results.filter(r => r.verdict === 'pass' || r.verdict === 'oracle-only').length;
  const pass_rate = results.length === 0 ? 1 : passCount / results.length;

  return {
    runId,
    mode: 'shell-only',
    oracle: ORACLE_BASE,
    react: REACT_BASE,
    shellPixelThreshold: SHELL_PIXEL_THRESHOLD,
    shellDomThreshold: SHELL_DOM_THRESHOLD,
    results,
    aggregate: { pixel_mean, dom_mean, pass_rate },
  };
}
