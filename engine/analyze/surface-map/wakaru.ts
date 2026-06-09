/**
 * Select the highest-value bundle chunks (router module, api-client, entry
 * bundles) and selectively unpack them with @wakaru/cli. Never unpacks the
 * full 1155-chunk set. Failures are recorded, not thrown.
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { WakaruResult } from './types.js';

const MAX_CHUNKS = 8;

type Candidate = { file: string; reason: string; score: number };

/** Score a chunk by how router/api-client-ish it looks. */
function scoreChunk(file: string, text: string): Candidate | null {
  const name = basename(file);
  let score = 0;
  const reasons: string[] = [];

  // Count only route-like path literals (short, no spaces, no interpolation)
  // so SVG/chart `path:` data does not inflate icon chunks.
  const routeDefs = (text.match(/path:\s*[`"'][a-zA-Z:*/][^`"' ${]{0,40}[`"']/g) ?? []).length;
  if (routeDefs > 0) {
    score += Math.min(routeDefs, 50);
    reasons.push(`${routeDefs} route defs`);
  }
  if (/loadChildren:/.test(text)) {
    score += 20;
    reasons.push('loadChildren');
  }
  if (/RouterModule|provideRouter/.test(text)) {
    score += 25;
    reasons.push('RouterModule');
  }
  if (/apiUrl|"\/v2\/"|"\/v3\/"|baseUrl/.test(text)) {
    score += 30;
    reasons.push('api-base construction');
  }
  if (/^main\d*-/.test(name) || /^common\d*-/.test(name)) {
    score += 5;
    reasons.push('entry/common chunk');
  }
  if (score === 0) return null;
  return { file, reason: reasons.join(', '), score };
}

export function selectChunks(bundleFiles: string[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const file of bundleFiles) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const c = scoreChunk(file, text);
    if (c) candidates.push(c);
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_CHUNKS);
}

export function runWakaru(candidates: Candidate[], outRoot: string): WakaruResult[] {
  mkdirSync(outRoot, { recursive: true });
  const results: WakaruResult[] = [];
  for (const cand of candidates) {
    const name = basename(cand.file).replace(/\.js$/, '');
    const outDir = join(outRoot, name);
    try {
      execFileSync(
        'npx',
        ['--yes', '@wakaru/cli', cand.file, '--unpack=auto', '-o', outDir],
        { stdio: ['ignore', 'ignore', 'pipe'], timeout: 600_000 },
      );
      results.push({ chunk: name, reason: cand.reason, status: 'unpacked' });
    } catch (err) {
      const e = err as { stderr?: Buffer; signal?: string; message?: string };
      const stderr = e.stderr ? e.stderr.toString().split('\n').filter(Boolean).pop() : '';
      const reason = e.signal === 'SIGTERM' ? 'timeout' : stderr || e.message?.split('\n')[0] || 'unknown error';
      results.push({
        chunk: name,
        reason: cand.reason,
        status: 'failed',
        note: reason.slice(0, 160),
      });
    }
  }
  return results;
}
