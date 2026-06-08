/**
 * Matching primitives. A lightweight scorer that prefers, in order:
 *   1. exact title match
 *   2. prefix match
 *   3. contiguous substring match (earlier = better)
 *   4. subsequence (fuzzy) match
 * Returns null when the query does not match at all. Matching is
 * case-insensitive; ranges are reported against the ORIGINAL string so the UI
 * can highlight with correct casing.
 */

import type { MatchRange } from './types';

export interface MatchOutcome {
  score: number;
  ranges: MatchRange[];
}

const EXACT = 1000;
const PREFIX = 600;
const SUBSTRING = 400;
const SUBSEQUENCE = 150;

export function matchText(query: string, text: string): MatchOutcome | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const lower = text.toLowerCase();

  if (lower === q) {
    return { score: EXACT, ranges: [{ start: 0, end: text.length }] };
  }

  const idx = lower.indexOf(q);
  if (idx === 0) {
    return { score: PREFIX, ranges: [{ start: 0, end: q.length }] };
  }
  if (idx > 0) {
    // Closer to the start scores higher; word-boundary starts get a bump.
    const boundary = idx === 0 || /\s/.test(text[idx - 1] ?? '');
    const score = SUBSTRING - idx + (boundary ? 40 : 0);
    return { score, ranges: [{ start: idx, end: idx + q.length }] };
  }

  return subsequenceMatch(q, text, lower);
}

/** Fuzzy fallback: every query char appears in order. Tighter spans score more. */
function subsequenceMatch(
  q: string,
  text: string,
  lower: string,
): MatchOutcome | null {
  const ranges: MatchRange[] = [];
  let qi = 0;
  let spread = 0;
  let lastHit = -1;

  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] !== q[qi]) continue;
    if (lastHit >= 0) spread += i - lastHit - 1;
    lastHit = i;
    qi++;

    const prev = ranges[ranges.length - 1];
    if (prev && prev.end === i) prev.end = i + 1;
    else ranges.push({ start: i, end: i + 1 });
  }

  if (qi < q.length) return null;
  return { score: Math.max(20, SUBSEQUENCE - spread * 4), ranges };
}

/** Match across multiple fields; keeps the best-scoring outcome and its ranges. */
export function matchBest(
  query: string,
  primary: string,
  ...secondary: string[]
): MatchOutcome | null {
  let best = matchText(query, primary);
  for (const field of secondary) {
    const hit = matchText(query, field);
    if (!hit) continue;
    // Secondary-field hits are demoted so primary-title matches win.
    const demoted: MatchOutcome = { score: hit.score - 200, ranges: [] };
    if (!best || demoted.score > best.score) best = demoted;
  }
  return best;
}
