/**
 * Shared types for the parity tracking loop.
 *
 * Every avenue scorer is independent and returns a 0..100 score plus a list of
 * gaps. The aggregator blends them with weights and emits a ranked gap ledger.
 */

/** The five independent parity avenues. */
export type AvenueName = 'visual' | 'dom' | 'api' | 'state' | 'transition';

export const AVENUE_NAMES: readonly AvenueName[] = [
  'visual',
  'dom',
  'api',
  'state',
  'transition',
] as const;

/** A single shortfall an avenue found, ranked by severity to drive refinement. */
export type Gap = {
  /** Which avenue surfaced this gap. */
  avenue: AvenueName;
  /** Human label, e.g. a route+state or a request key. */
  label: string;
  /** Best-effort locator: selector, url, request key, state id. */
  locator: string;
  /** Why this is a gap. */
  reason: string;
  /**
   * 0..100. Higher = bigger drag on the score, refine first. Typically
   * `(1 - itemScore) * weightOfThisItem * 100`.
   */
  severity: number;
};

/** Result of one avenue scorer. */
export type AvenueScore = {
  avenue: AvenueName;
  /** 0..100. NaN-safe: scorers must clamp. */
  score: number;
  /** How many comparable items the score was computed over. */
  sampleSize: number;
  /** Ranked gaps (most severe first). */
  gaps: Gap[];
  /** Free-form notes: skipped items, missing inputs, partial coverage. */
  notes: string[];
  /**
   * true when the avenue had no inputs to score (e.g. no recorded API
   * responses, no crawl graph). Such avenues are excluded from the weighted
   * overall so a missing input does not silently tank parity.
   */
  skipped: boolean;
};

/** Per-avenue weights for the blended overall. */
export type AvenueWeights = Record<AvenueName, number>;

export const DEFAULT_AVENUE_WEIGHTS: AvenueWeights = {
  visual: 0.35,
  dom: 0.25,
  api: 0.2,
  state: 0.1,
  transition: 0.1,
};

/** The aggregated report written to disk. */
export type ParityTrackReport = {
  reference: string;
  candidate: string;
  viewport: { name: string; width: number; height: number; dsf: number };
  weights: AvenueWeights;
  /** One entry per avenue (skipped avenues included for transparency). */
  avenues: AvenueScore[];
  /** Weighted overall 0..100 over non-skipped avenues, weights re-normalized. */
  overall: number;
  /** Whether every non-skipped avenue cleared the target. */
  target: number;
  passed: boolean;
  /** Flattened, globally ranked gaps (most severe first). */
  gapLedger: Gap[];
  generatedAt: string;
  durationMs: number;
};

/** One line appended to parity-history.jsonl per run. */
export type ParityHistoryEntry = {
  timestamp: string;
  reference: string;
  candidate: string;
  viewport: string;
  overall: number;
  scores: Record<AvenueName, number | null>;
  passed: boolean;
  topGap: string | null;
};

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
