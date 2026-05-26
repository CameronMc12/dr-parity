/**
 * Visual avenue: masked pixel diff per state. Reuses engine/verify/masked-diff.
 * Score = mean masked visual similarity across all comparable states, 0..100.
 */

import { join } from 'node:path';
import { maskedDiff } from '../masked-diff';
import type { CapturedState } from './drive';
import type { AvenueScore, Gap } from './avenue-types';
import { clampScore } from './avenue-types';

export type VisualAvenueInput = {
  reference: CapturedState[];
  candidate: CapturedState[];
  /** Where diff images are written. */
  diffDir: string;
  /** Per-avenue weight, used to scale gap severity. */
  weight: number;
};

function pairKey(s: CapturedState): string {
  return `${s.stateId}::${s.state}`;
}

export async function scoreVisualAvenue(input: VisualAvenueInput): Promise<AvenueScore> {
  const { reference, candidate, diffDir, weight } = input;
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
    if (!ref.shotB) {
      notes.push(`${key}: missing reference mask shot; skipped`);
      continue;
    }
    const diffPath = join(diffDir, `${ref.stateId}__${ref.state}.png`);
    try {
      const result = await maskedDiff({
        candidatePath: cand.shot,
        referencePath: ref.shot,
        referencePathB: ref.shotB,
        diffPath,
      });
      const itemScore = result.visualScore; // 0..1
      sum += itemScore;
      total += 1;
      if (itemScore < 0.995) {
        gaps.push({
          avenue: 'visual',
          label: `${ref.stateId} [${ref.state}]`,
          locator: diffPath,
          reason: `${result.mismatchedPixels} px differ of ${
            result.totalPixels - result.maskedPixels
          } scored (${result.maskedPixels} masked)`,
          severity: clampScore((1 - itemScore) * weight * 100),
        });
      }
    } catch (err) {
      notes.push(`${key}: visual diff failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  gaps.sort((a, b) => b.severity - a.severity);
  const score = total > 0 ? clampScore((sum / total) * 100) : 0;
  return {
    avenue: 'visual',
    score,
    sampleSize: total,
    gaps,
    notes,
    skipped: total === 0,
  };
}
