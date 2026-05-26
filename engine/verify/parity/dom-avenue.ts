/**
 * DOM avenue: normalized structural diff per state. Reuses
 * engine/verify/dom-signature (captureDomSignature + domSimilarity).
 * Score = mean structural similarity across comparable states, 0..100.
 */

import { domSimilarity } from '../dom-signature';
import type { CapturedState } from './drive';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

export type DomAvenueInput = {
  reference: CapturedState[];
  candidate: CapturedState[];
  weight: number;
};

function pairKey(s: CapturedState): string {
  return `${s.stateId}::${s.state}`;
}

export function scoreDomAvenue(input: DomAvenueInput): AvenueScore {
  const { reference, candidate, weight } = input;
  const candByKey = new Map(candidate.map((s) => [pairKey(s), s]));
  const gaps: Gap[] = [];
  const notes: string[] = [];
  let total = 0;
  let sum = 0;

  for (const ref of reference) {
    const key = pairKey(ref);
    const cand = candByKey.get(key);
    if (!cand) {
      notes.push(`no candidate capture for ${key}`);
      continue;
    }
    const sim = domSimilarity(ref.signature, cand.signature); // 0..1
    sum += sim;
    total += 1;
    if (sim < 0.99) {
      const refSet = new Set(ref.signature);
      const candSet = new Set(cand.signature);
      const missing = ref.signature.filter((t) => !candSet.has(t)).length;
      const extra = cand.signature.filter((t) => !refSet.has(t)).length;
      gaps.push({
        avenue: 'dom',
        label: `${ref.stateId} [${ref.state}]`,
        locator: `${ref.signature.length} ref nodes vs ${cand.signature.length} cand nodes`,
        reason: `${missing} ref node(s) missing, ${extra} extra candidate node(s)`,
        severity: clampScore((1 - sim) * weight * 100),
      });
    }
  }

  gaps.sort((a, b) => b.severity - a.severity);
  const score = total > 0 ? clampScore((sum / total) * 100) : 0;
  return {
    avenue: 'dom',
    score,
    sampleSize: total,
    gaps,
    notes,
    skipped: total === 0,
  };
}
