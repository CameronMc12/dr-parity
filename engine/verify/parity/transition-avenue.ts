/**
 * Transition avenue: score whether the candidate reproduces the reference's
 * state-graph EDGES.
 *
 * Primary mode (graph-driven): given the crawl graph's edges driven against the
 * candidate (see transition-driver.ts), an edge is "reproduced" when the
 * reference really moved (its from/to canonical keys differ) and the candidate
 * moved the same way after performing the interaction — ideally landing on the
 * reference's toState canonical key, else at minimum transitioning in the same
 * direction. Score = % of reference-transitioning edges the candidate reproduced.
 *
 * Fallback mode (signature-direction): when no crawl graph is available, the
 * orchestrator drives both sides through the ParityState interactions and we
 * compare DOM-signature change direction (both changed / both stayed put).
 */

import { domSimilarity } from '../dom-signature';
import type { CapturedState } from './drive';
import type { ParityState } from './state-spec';
import type { EdgeOutcome } from './transition-driver';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

const CHANGE_THRESHOLD = 0.98;

// ---------------------------------------------------------------------------
// Primary: graph-edge scoring from driven outcomes.
// ---------------------------------------------------------------------------

export type GraphTransitionInput = {
  outcomes: EdgeOutcome[];
  weight: number;
  notes?: string[];
};

const DRIVABLE_KINDS = new Set(['click', 'hover']);

export function scoreTransitionEdges(input: GraphTransitionInput): AvenueScore {
  const { outcomes, weight, notes = [] } = input;
  // Reference-transitioning edges carry a transition to reproduce. Of those,
  // only click/hover edges are assessable from a static selector — keyboard and
  // navigate edges cannot be replayed by this driver, so they are reported as
  // not-assessable (a gap + note) but excluded from the reproduction denominator
  // rather than counted as outright failures.
  const refMoving = outcomes.filter((o) => o.refTransitioned);
  const assessable = refMoving.filter((o) => DRIVABLE_KINDS.has(o.kind));
  const notAssessable = refMoving.filter((o) => !DRIVABLE_KINDS.has(o.kind));

  const gaps: Gap[] = [];

  // Not-assessable edges: surface as half-weight gaps so they show in the ledger
  // (the replay should eventually support them) without tanking the score.
  for (const o of notAssessable) {
    gaps.push({
      avenue: 'transition',
      label: `${o.fromStateId} -> ${o.toStateId} (${o.label})`,
      locator: o.selector,
      reason: `interaction kind "${o.kind}" not replayable by the transition driver (not scored)`,
      severity: clampScore(0.5 * weight * 100),
    });
  }

  if (assessable.length === 0) {
    return {
      avenue: 'transition',
      score: 0,
      sampleSize: 0,
      gaps: gaps.sort((a, b) => b.severity - a.severity),
      notes: [
        ...notes,
        `crawl graph had ${refMoving.length} reference-transitioning edge(s) but none were click/hover (driver cannot replay keyboard/navigate)`,
      ],
      skipped: true,
    };
  }

  let sum = 0;
  for (const o of assessable) {
    const reproduced = o.candReachedTarget ? 1 : 0;
    sum += reproduced;
    if (reproduced < 1) {
      gaps.push({
        avenue: 'transition',
        label: `${o.fromStateId} -> ${o.toStateId} (${o.label})`,
        locator: o.selector,
        reason: !o.performed
          ? `candidate could not perform interaction: ${o.note ?? 'selector missing'}`
          : o.candTransitioned
            ? 'candidate transitioned but did not reach the reference target state'
            : 'candidate did not transition where the reference did',
        severity: clampScore(1 * weight * 100),
      });
    }
  }

  gaps.sort((a, b) => b.severity - a.severity);
  const extraNotes = [...notes];
  if (notAssessable.length > 0) {
    extraNotes.push(
      `${notAssessable.length} reference edge(s) skipped (keyboard/navigate, not replayable); scored over ${assessable.length} click/hover edge(s)`,
    );
  }
  return {
    avenue: 'transition',
    score: clampScore((sum / assessable.length) * 100),
    sampleSize: assessable.length,
    gaps,
    notes: extraNotes,
    skipped: false,
  };
}

// ---------------------------------------------------------------------------
// Fallback: signature-direction scoring from driven ParityStates.
// ---------------------------------------------------------------------------

export type TransitionAvenueInput = {
  states: ParityState[];
  reference: CapturedState[];
  candidate: CapturedState[];
  weight: number;
};

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
