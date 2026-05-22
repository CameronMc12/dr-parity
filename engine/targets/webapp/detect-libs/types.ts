/**
 * Phase 6 types: third-party UI library detection + swap planning.
 *
 * Detection scans captured DOM (`states/state-NNNN/dom.html`) for
 * library-specific signatures (unique data-attrs, predictable class
 * prefixes, ARIA combos). Anything that matches is bucketed by swap
 * strategy: wrapper-component (auto-installable), attribute-rewrite
 * (mostly no-op, data attrs stay), or manual-only (flagged for the
 * user to wire by hand).
 */

export type SwapStrategy =
  | 'wrapper-component'
  | 'attribute-rewrite'
  | 'manual-only';

export interface LibDetection {
  domAttrs?: string[];
  classPrefixes?: string[];
  ariaPatterns?: string[];
  minOccurrences?: number;
}

export interface LibReactEquivalent {
  npmPackage: string;
  version: string;
  wrapperPath: string;
}

export interface LibSignature {
  id: string;
  displayName: string;
  detection: LibDetection;
  reactEquivalent: LibReactEquivalent;
  swapStrategy: SwapStrategy;
  swapInstructions?: string;
}

export interface DetectedLib {
  signature: LibSignature;
  occurrences: number;
  evidence: string[];
}

export interface UnknownPattern {
  evidence: string;
  whyFlagged: string;
}

export interface LibDetectionResult {
  detected: DetectedLib[];
  unknown: UnknownPattern[];
  manualOnly: DetectedLib[];
}
