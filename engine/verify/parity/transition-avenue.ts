/**
 * Transition avenue: state-graph edges reproduced. Reuses the crawl graph
 * (graph.json) when available as the reference edge set; otherwise falls back
 * to the driven interactions captured this run.
 *
 * An edge is "reproduced" when performing its interaction on the candidate
 * produces the same DOM-transition behaviour as the reference did: the
 * candidate's post-interaction signature diverges from its base signature in
 * the same direction the reference's did (both changed, or both stayed put).
 */

import { domSimilarity } from '../dom-signature';
import type { CapturedState } from './drive';
import type { ParityState } from './state-spec';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

export type TransitionAvenueInput = {
  states: ParityState[];
  reference: CapturedState[];
  candidate: CapturedState[];
  weight: number;
};

const CHANGE_THRESHOLD = 0.98;

function bySide(states: CapturedState[]): Map<string, CapturedState> {
  return new Map(states.map((s) => [`${s.stateId}::${s.state}`, s]));
}

export function scoreTransitionAvenue(input: TransitionAvenueInput): AvenueScore {
  const { states, reference, candidate, weight } = input;
  const refMap = bySide(reference);
  const candMap = bySide(candidate);
  const gaps: Gap[] = [];
  const notes: string[] = [];
  let total = 0;
  let sum = 0;

  for (const state of states) {
    if (state.interactions.length === 0) continue;
    const refBase = refMap.get(`${state.id}::base`);
    const candBase = candMap.get(`${state.id}::base`);
    if (!refBase || !candBase) {
      notes.push(`${state.id}: missing base capture; transitions skipped`);
      continue;
    }

    for (const interaction of state.interactions) {
      const refAfter = refMap.get(`${state.id}::${interaction.label}`);
      const candAfter = candMap.get(`${state.id}::${interaction.label}`);
      total += 1;

      if (!refAfter || !candAfter) {
        gaps.push({
          avenue: 'transition',
          label: `${state.id} -> ${interaction.label}`,
          locator: interaction.selector,
          reason: 'edge not captured on one side',
          severity: clampScore(1 * weight * 100),
        });
        continue;
      }

      const refChanged = domSimilarity(refBase.signature, refAfter.signature) < CHANGE_THRESHOLD;
      const candChanged = domSimilarity(candBase.signature, candAfter.signature) < CHANGE_THRESHOLD;
      const reproduced = refChanged === candChanged ? 1 : 0;
      sum += reproduced;

      if (reproduced < 1) {
        gaps.push({
          avenue: 'transition',
          label: `${state.id} -> ${interaction.label}`,
          locator: interaction.selector,
          reason: refChanged
            ? 'reference transitioned but candidate did not'
            : 'candidate transitioned but reference did not',
          severity: clampScore(1 * weight * 100),
        });
      }
    }
  }

  if (total === 0) {
    return {
      avenue: 'transition',
      score: 0,
      sampleSize: 0,
      gaps,
      notes: [...notes, 'no interaction edges to score; transition avenue skipped'],
      skipped: true,
    };
  }

  gaps.sort((a, b) => b.severity - a.severity);
  return {
    avenue: 'transition',
    score: clampScore((sum / total) * 100),
    sampleSize: total,
    gaps,
    notes,
    skipped: false,
  };
}
