/**
 * Pipeline composer for in-process stage execution.
 *
 * Phase 4 scaffold per docs/V2.0/04-cli-and-logging-design.md (Part C, C.3)
 * and docs/V2.0/05-action-plan.md §4 Phase 4 task 5.
 *
 * `runPipeline` takes an array of stages and executes them sequentially,
 * forwarding each stage's `output` as the next stage's `input`. The first
 * stage receives `initialInput`.
 *
 * The orchestrator emits structured lifecycle events through `ctx.logger`
 * (`stage_start`, `stage_end`, `pipeline_start`, `pipeline_end`). Phase 5
 * wires the Logger to write `.runs/<id>/pipeline.jsonl`; in this scaffold
 * events still flow through `Logger.event` only.
 *
 * Disk side effects deliberately omitted from this file. The Logger is the
 * one and only seam where logging output is materialised.
 */

import type { FullRunContext } from "./context.js";
import { nowIso } from "./event-stream.js";
import type { RunContext, Stage, StageResult, StageStatus } from "./stage.js";

function hasEmit(ctx: RunContext): ctx is FullRunContext {
  return (
    typeof (ctx as Partial<FullRunContext>).emit === "function" &&
    typeof (ctx as Partial<FullRunContext>).finalise === "function"
  );
}

/** A stage erased to `unknown` for storage inside a list. */
export type AnyStage = Stage<unknown, unknown>;

export interface PipelineRunResult {
  readonly status: StageStatus;
  readonly stages: readonly StageRunRecord[];
  readonly finalOutput: unknown;
  readonly durationMs: number;
}

export interface StageRunRecord {
  readonly name: string;
  readonly status: StageStatus;
  readonly durationMs: number;
  readonly metrics?: Readonly<Record<string, number | string>>;
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
}

export interface RunPipelineOptions {
  readonly pipelineName?: string;
  /**
   * If true, the pipeline halts on the first `fail` status. Default true.
   * Set to false for diagnostic runs where each stage should be attempted.
   */
  readonly stopOnFail?: boolean;
}

/**
 * Run a list of stages sequentially.
 *
 * Type relaxation note: each stage is typed `Stage<unknown, unknown>` because
 * a heterogeneous list of stages cannot be represented in plain TypeScript
 * without dependent types. Stage authors enforce safety internally via
 * `validateInput`. Phase 5 may introduce a builder helper with chained
 * generics to recover end-to-end type inference for static pipelines.
 */
export async function runPipeline(
  stages: readonly AnyStage[],
  initialInput: unknown,
  ctx: RunContext,
  options: RunPipelineOptions = {},
): Promise<PipelineRunResult> {
  const pipelineName = options.pipelineName ?? "pipeline";
  const stopOnFail = options.stopOnFail ?? true;
  const records: StageRunRecord[] = [];

  ctx.logger.event("pipeline_start", {
    pipeline: pipelineName,
    runId: ctx.runId,
    stages: stages.map((s) => s.name),
  });

  const pipelineStarted = Date.now();
  let currentInput: unknown = initialInput;
  let pipelineStatus: StageStatus = "ok";

  for (const stage of stages) {
    const stageStarted = Date.now();
    ctx.logger.event("stage_start", {
      pipeline: pipelineName,
      stage: stage.name,
      runId: ctx.runId,
    });
    if (hasEmit(ctx)) {
      ctx.emit({ type: "stage_start", stage: stage.name, at: nowIso() });
    }

    let result: StageResult<unknown>;
    try {
      if (stage.validateInput) {
        await stage.validateInput(currentInput);
      }
      result = await stage.run(currentInput, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`Stage threw: ${stage.name}`, {
        stage: stage.name,
        error: message,
      });
      const record: StageRunRecord = {
        name: stage.name,
        status: "fail",
        durationMs: Date.now() - stageStarted,
        errors: [message],
      };
      records.push(record);
      pipelineStatus = "fail";
      ctx.logger.event("stage_end", {
        pipeline: pipelineName,
        stage: stage.name,
        status: "fail",
        durationMs: record.durationMs,
      });
      if (hasEmit(ctx)) {
        ctx.emit({
          type: "stage_end",
          stage: stage.name,
          at: nowIso(),
          status: "fail",
          durationMs: record.durationMs,
        });
      }
      if (stopOnFail) {
        break;
      }
      // Without an output we cannot continue chaining; bail.
      break;
    }

    const durationMs = Date.now() - stageStarted;
    const record: StageRunRecord = {
      name: stage.name,
      status: result.status,
      durationMs,
      metrics: result.metrics,
      warnings: result.warnings,
      errors: result.errors,
    };
    records.push(record);

    ctx.logger.event("stage_end", {
      pipeline: pipelineName,
      stage: stage.name,
      status: result.status,
      durationMs,
      metrics: result.metrics,
    });
    if (hasEmit(ctx)) {
      ctx.emit({
        type: "stage_end",
        stage: stage.name,
        at: nowIso(),
        status: result.status,
        durationMs,
        metrics: result.metrics as Record<string, number | string> | undefined,
      });
    }

    if (result.status === "fail") {
      pipelineStatus = "fail";
      if (stopOnFail) {
        break;
      }
    } else if (result.status === "warn" && pipelineStatus === "ok") {
      pipelineStatus = "warn";
    }

    currentInput = result.output;
  }

  const durationMs = Date.now() - pipelineStarted;
  ctx.logger.event("pipeline_end", {
    pipeline: pipelineName,
    runId: ctx.runId,
    status: pipelineStatus,
    durationMs,
  });

  return {
    status: pipelineStatus,
    stages: records,
    finalOutput: currentInput,
    durationMs,
  };
}
