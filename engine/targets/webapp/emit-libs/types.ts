/**
 * Phase 6 emission types. Result shape consumed by build.ts to populate
 * WebappBuildSummary.libs.
 */

import type { DetectedLib, LibDetectionResult, UnknownPattern } from '../detect-libs/types';

export interface EmittedWrapper {
  libId: string;
  outPath: string;
  skipped: boolean;
}

export interface DepMergeResult {
  added: string[];
  skipped: string[];
}

export interface EmitLibsResult {
  detection: LibDetectionResult;
  wrappers: EmittedWrapper[];
  deps: DepMergeResult;
  reportPath: string;
  unknown: UnknownPattern[];
  manualOnly: DetectedLib[];
}
