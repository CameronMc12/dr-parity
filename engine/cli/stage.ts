/**
 * In-process stage interface for the Dr Parity pipeline.
 *
 * Phase 4 scaffold per docs/V2.0/04-cli-and-logging-design.md (Part C, C.1)
 * and docs/V2.0/05-action-plan.md (locked decision 4 in §2).
 *
 * Every Dr Parity pipeline step (capture, parse, complete-assets, clone,
 * build, qa-verify, ...) implements `Stage<I, O>`. The orchestrator in
 * `engine/cli/orchestrate.ts` composes them sequentially.
 *
 * Phase 5 will wire concrete stage implementations behind this contract
 * and grow the Logger to write `.runs/<id>/pipeline.jsonl`. For now the
 * Logger is stdout-only.
 */

/**
 * Status of a single Stage run.
 *
 * `partial` is additive (W5B.1 item 2): the stage completed and produced an
 * output, but some sub units inside it failed (e.g. one viewport built while
 * another did not). Downstream callers should treat partial as a soft signal
 * stronger than warn and weaker than fail. The manifest writer accepts it as
 * an additive value with no schemaVersion bump because readers tolerate
 * unknown values per docs/V2.0/04-cli-and-logging-design.md (Part D).
 */
export type StageStatus = "ok" | "warn" | "partial" | "fail";

export type MetricValue = number | string;

export interface LogMeta {
  readonly [key: string]: unknown;
}

export interface Logger {
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
  metric(name: string, value: MetricValue, meta?: LogMeta): void;
  event(name: string, fields?: LogMeta): void;
}

/** Optional async finaliser registered by the Stage author for cleanup. */
export type DisposeFn = () => void | Promise<void>;

export interface RunContext {
  readonly runId: string;
  /** `.runs/<runId>/` absolute path. */
  readonly outDir: string;
  readonly logger: Logger;
  readonly startedAt: number;
  /**
   * Register a finaliser. Runs in LIFO order on `finaliseRun`, regardless of
   * success or failure. Use for browser teardown, file handles, etc.
   */
  onDispose?(fn: DisposeFn): void;
}

export interface StageResult<O> {
  readonly status: StageStatus;
  readonly output: O;
  readonly metrics?: Readonly<Record<string, MetricValue>>;
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
}

export interface Stage<I, O> {
  readonly name: string;
  validateInput?(input: I): void | Promise<void>;
  run(input: I, ctx: RunContext): Promise<StageResult<O>>;
}

/** Convenience helper for building well-typed ok results. */
export function ok<O>(
  output: O,
  metrics?: Readonly<Record<string, MetricValue>>,
): StageResult<O> {
  return { status: "ok", output, metrics };
}

/** Convenience helper for warn results that still produce an output. */
export function warn<O>(
  output: O,
  warnings: readonly string[],
  metrics?: Readonly<Record<string, MetricValue>>,
): StageResult<O> {
  return { status: "warn", output, warnings, metrics };
}

/** Convenience helper for fail results. */
export function fail<O>(
  output: O,
  errors: readonly string[],
  metrics?: Readonly<Record<string, MetricValue>>,
): StageResult<O> {
  return { status: "fail", output, errors, metrics };
}

/**
 * Convenience helper for partial results. Some sub units of the stage
 * completed; some did not. `partial_count` is recorded as a metric so the
 * SUMMARY.md table can show the slash count without callers having to
 * remember the key.
 */
export function partial<O>(
  output: O,
  partialCount: number,
  totalCount: number,
  warnings?: readonly string[],
  metrics?: Readonly<Record<string, MetricValue>>,
): StageResult<O> {
  return {
    status: "partial",
    output,
    warnings,
    metrics: {
      ...(metrics ?? {}),
      partial_count: partialCount,
      total_count: totalCount,
    },
  };
}
