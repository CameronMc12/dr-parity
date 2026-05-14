/**
 * Shared types for the rebuild-pro orchestrator pipeline.
 */

export type PhaseStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export type RebuildMode = 'safe' | 'aggressive';

export interface PhaseDefinition {
  /** 1-based phase number used by --skip and reporting. */
  id: number;
  /** Short slug rendered in headers and the skip list. */
  slug: string;
  /** Human-readable description. */
  label: string;
  /** Resolved command + args, or null for inline phases. */
  command: SpawnCommand | null;
  /** Inline executor for non-child-process phases (Phase 0 / 8). */
  inline?: (ctx: OrchestratorContext) => Promise<InlineResult>;
  /** Phase output paths surfaced in the final report. */
  outputs: string[];
  /** When true a non-zero exit becomes a warning, not a failure. */
  nonFatal?: boolean;
  /** When set, phase only runs if ctx.mode matches. */
  requiresMode?: RebuildMode;
  /** When true, snapshot dist before phase and pixel-diff after. */
  parityCheck?: boolean;
}

export interface SpawnCommand {
  cmd: string;
  args: string[];
  cwd: string;
}

export interface PhaseResult {
  id: number;
  slug: string;
  label: string;
  status: PhaseStatus;
  durationMs: number;
  outputs: string[];
  error?: string;
  warning?: string;
}

export interface InlineResult {
  outputs?: string[];
  warning?: string;
}

export interface OrchestratorOptions {
  cloneDir: string;
  outDir: string;
  analysisDir: string;
  primitivesConfig: string | null;
  skip: Set<number>;
  keepGoing: boolean;
  force: boolean;
  repoRoot: string;
  mode: RebuildMode;
  scopeStylesMode: RebuildMode;
}

export interface OrchestratorContext extends OrchestratorOptions {
  results: PhaseResult[];
}

export interface RunReport {
  cloneDir: string;
  outDir: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  status: 'success' | 'partial' | 'failed';
  phases: PhaseResult[];
}
