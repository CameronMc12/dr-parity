import type { Viewport } from './types';

export type RouteInteraction = {
  /** Human label for the state, e.g. "open-menu". */
  label: string;
  /** Interaction kind. Only click/hover are auto-performed; others are noted. */
  kind: 'click' | 'hover';
  /** Selector to trigger on both sides to reach the state. */
  selector: string;
};

export type RouteSpec = {
  /** Stable id used in output paths. Slugified from path/label. */
  id: string;
  /** Path or full URL fragment appended to the base. e.g. "/" or "/inbox". */
  path: string;
  /** Optional human label. Defaults to path. */
  label?: string;
  /** Optional captured interactions to exercise within this route. */
  interactions?: RouteInteraction[];
};

export type RoutesFile = {
  routes: RouteSpec[];
};

export type ScoreWeights = {
  visual: number;
  dom: number;
  functional: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  visual: 0.6,
  dom: 0.3,
  functional: 0.1,
};

export type StateScore = {
  /** Route id this state belongs to. */
  routeId: string;
  /** State label: "base" for the loaded route, or the interaction label. */
  state: string;
  /** 0..1 visual similarity after non-determinism masking. */
  visualScore: number;
  /** 0..1 normalized-DOM structural similarity. */
  domScore: number;
  /** 0..1 functional score. null when no interaction applies to this state. */
  functionalScore: number | null;
  /** Blended 0..1 score using the active weights (re-normalized when functional is null). */
  blended: number;
  /** Mismatched pixels after masking. */
  mismatchedPixels: number;
  /** Total compared pixels. */
  totalPixels: number;
  /** Pixels ignored via the non-determinism mask. */
  maskedPixels: number;
  /** Path to the candidate screenshot. */
  candidateShot: string;
  /** Path to the reference screenshot. */
  referenceShot: string;
  /** Path to the diff image. */
  diffShot: string;
  /** Notes: load failures, missing interactions, timeouts. */
  notes: string[];
};

export type RouteScore = {
  routeId: string;
  path: string;
  label: string;
  states: StateScore[];
  /** Mean blended score across this route's states. */
  routeScore: number;
};

export type ParityScoreReport = {
  reference: string;
  candidate: string;
  viewport: Viewport;
  weights: ScoreWeights;
  routes: RouteScore[];
  /** Overall weighted parity, 0..1, weighted by state count. */
  overallScore: number;
  generatedAt: string;
  durationMs: number;
};
