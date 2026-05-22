/**
 * `parity clone` end-to-end pipeline (in-process).
 *
 * Phase 5 task 7 per docs/V2.0/05-action-plan.md §4.
 *
 * Calls `runCloneEntry(argv)` from `scripts/run-clone.ts` directly inside this
 * process. Each phase the legacy script runs (capture, parse:har, parse:trace,
 * complete:assets, clone) is attributed individually in the JSONL stream and
 * manifest, and the actual dated capture directory the run produced is
 * registered as the `captureRoot` artefact.
 *
 * Stdout that the legacy phases still produce is tee'd into the stage-log
 * file via a hooked `process.stdout.write` / `process.stderr.write` for the
 * duration of the call so the unified log surface still sees every line.
 */

import { execSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import {
  finaliseManifest,
  initManifest,
  patchStage,
  registerArtefact,
  type RunManifest,
} from "./run-manifest.js";
import { createRunContext } from "./context.js";
import { writeSummary } from "./summary-writer.js";
import { nowIso } from "./event-stream.js";
import { runCloneEntry, type RunCloneResult } from "../../scripts/run-clone.js";
import {
  DEFAULT_PARITY_THRESHOLDS,
  projectNameFromUrl,
  runEmitTargetStage,
  runParityCheckStage,
  type EmitTarget,
} from "./emit-and-verify.js";

export interface ParityCloneInput {
  url: string;
  target?: "astro" | "react" | "webapp" | "html-mirror";
  viewports?: string;
  tour: boolean;
  outDir?: string;
  runId?: string;
  quiet?: boolean;
  verbose?: boolean;
  json?: boolean;
  /** Run the parity verification stage after framework emit. Default: true. */
  parity?: boolean;
  /** Pixel diff threshold (0..1). When omitted the per-target default applies. */
  parityThreshold?: number;
}

export interface ParityCloneResult {
  runId: string;
  runDir: string;
  status: "ok" | "warn" | "partial" | "fail";
  summaryPath: string;
}

function captureGitSha(): string {
  try {
    const out = execSync("git rev-parse HEAD", {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return out.trim();
  } catch {
    return "unknown";
  }
}

function buildRunCloneArgs(input: ParityCloneInput): string[] {
  const args: string[] = [input.url];
  if (input.viewports) args.push(`--viewport=${input.viewports}`);
  if (input.outDir) args.push(`--out=${input.outDir}`);
  if (!input.tour) args.push("--no-tour");
  args.push("--no-preview");
  return args;
}

/**
 * Run `runCloneEntry(argv)` in-process while tee-ing every byte written to
 * stdout/stderr into `logPath`. Restores the original write methods on exit
 * so the rest of the process is unaffected.
 */
async function runCloneInProcess(
  argv: string[],
  logPath: string,
): Promise<RunCloneResult> {
  await fs.mkdir(resolve(logPath, ".."), { recursive: true });
  const logStream = createWriteStream(logPath, { flags: "a" });

  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teeWrite = (orig: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function teeWriteImpl(chunk: any, ...rest: any[]): boolean {
      try {
        if (typeof chunk === "string") {
          logStream.write(chunk);
        } else if (Buffer.isBuffer(chunk)) {
          logStream.write(chunk);
        }
      } catch {
        // Never let the tee crash the pipeline.
      }
      return orig(chunk, ...rest);
    };

  process.stdout.write = teeWrite(origStdout) as typeof process.stdout.write;
  process.stderr.write = teeWrite(origStderr) as typeof process.stderr.write;

  try {
    return await runCloneEntry(argv);
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
    await new Promise<void>((resolveFn) => logStream.end(() => resolveFn()));
  }
}

/**
 * End-to-end clone command. Creates a RunContext, initialises the manifest,
 * runs the pipeline in-process with per-phase event attribution, finalises
 * the manifest, and writes SUMMARY.md.
 */
export async function runParityClone(
  input: ParityCloneInput,
): Promise<ParityCloneResult> {
  const ctx = await createRunContext({
    runId: input.runId,
    quiet: input.quiet,
    verbose: input.verbose,
    json: input.json,
  });
  const startedAt = new Date().toISOString();

  const command = `parity clone ${input.url}${input.target ? ` ${input.target}` : ""}`;
  ctx.emit({
    type: "run_start",
    at: startedAt,
    command,
    argv: ["clone", input.url, ...(input.target ? [input.target] : [])],
  });

  const manifest = await initManifest(
    { runDir: ctx.outDir },
    {
      runId: ctx.runId,
      command,
      args: {
        url: input.url,
        target: input.target,
        viewports: input.viewports,
        tour: input.tour,
        out: input.outDir,
      },
      env: {
        node: process.version,
        gitSha: captureGitSha(),
        platform: `${process.platform} ${process.arch}`,
      },
      target: input.target,
      url: input.url,
      startedAt,
    },
  );
  void manifest;

  ctx.logger.info("parity clone starting", { url: input.url, runId: ctx.runId });

  const stageName = "clone-pipeline";
  const stageStart = nowIso();
  await patchStage(
    { runDir: ctx.outDir },
    { name: stageName, startedAt: stageStart, status: undefined },
  );
  ctx.emit({ type: "stage_start", stage: stageName, at: stageStart });

  const stageLogPath = join(ctx.outDir, "stage-logs", `${stageName}.log`);
  const argv = buildRunCloneArgs(input);
  const t0 = Date.now();

  let result: RunCloneResult;
  try {
    result = await runCloneInProcess(argv, stageLogPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error("clone pipeline threw", { error: message });
    result = { exitCode: 1, phases: [], viewports: [] };
  }

  const durationMs = Date.now() - t0;
  const endedAt = nowIso();
  // partial trumps warn: any phase reporting partial promotes the rollup
  // unless something failed outright. Cast to widen so this code keeps
  // working when scripts/run-clone.ts adopts partial in its own phase
  // status type (W5B.2 territory).
  const phaseStatuses = result.phases.map(
    (p) => p.status as "ok" | "warn" | "partial" | "fail",
  );
  const status: "ok" | "warn" | "partial" | "fail" =
    result.exitCode === 0
      ? phaseStatuses.some((s) => s === "partial")
        ? "partial"
        : phaseStatuses.some((s) => s === "warn")
          ? "warn"
          : "ok"
      : "fail";

  // Attribute every phase the in-process pipeline ran as its own manifest
  // stage entry and JSONL event so the durable record reflects real per
  // stage timing and status instead of a single opaque clone-pipeline blob.
  for (const phase of result.phases) {
    const phaseEnd = nowIso();
    await patchStage(
      { runDir: ctx.outDir },
      {
        name: phase.label,
        startedAt: stageStart,
        endedAt: phaseEnd,
        status: phase.status,
        metrics: { durationMs: phase.ms, exitCode: phase.exitCode },
      },
    );
    ctx.emit({
      type: "metric",
      stage: phase.label,
      at: phaseEnd,
      name: "durationMs",
      value: phase.ms,
    });
    ctx.emit({
      type: "stage_end",
      stage: phase.label,
      at: phaseEnd,
      status: phase.status,
      durationMs: phase.ms,
      metrics: { exitCode: phase.exitCode, durationMs: phase.ms },
    });
  }

  // Roll-up clone-pipeline stage entry so the manifest still has a top-level
  // record matching the JSONL stage_start emitted earlier.
  await patchStage(
    { runDir: ctx.outDir },
    {
      name: stageName,
      startedAt: stageStart,
      endedAt,
      status,
      metrics: { exitCode: result.exitCode, durationMs },
    },
  );
  ctx.emit({
    type: "stage_end",
    stage: stageName,
    at: endedAt,
    status,
    durationMs,
    metrics: { exitCode: result.exitCode, durationMs },
  });

  // Register the actual dated capture directory (not the parent root) as
  // the captureRoot artefact when the pipeline produced one.
  if (result.captureRoot) {
    const captureRootAbs = resolve(result.captureRoot);
    const exists = await fs
      .stat(captureRootAbs)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      await registerArtefact(
        { runDir: ctx.outDir },
        "captureRoot",
        captureRootAbs,
      );
      ctx.emit({
        type: "artefact",
        stage: stageName,
        at: nowIso(),
        name: "captureRoot",
        path: captureRootAbs,
      });
    }
  }
  if (result.runRoot) {
    const runRootAbs = resolve(result.runRoot);
    const exists = await fs
      .stat(runRootAbs)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      await registerArtefact({ runDir: ctx.outDir }, "runRoot", runRootAbs);
    }
  }

  // Stages 7 + 8: framework emit and parity verification. Only kick in when
  // the user supplied a real target and the static-clone pipeline produced
  // a usable capture root. Skipped silently when target is undefined or
  // `html-mirror` (no adapter wired). Failure of these stages does not
  // wipe the clone artefacts; it just downgrades the rollup status.
  let rolledStatus: RunManifest["status"] = status;
  let parityForManifest: RunManifest["parity"] | undefined;

  const canEmit =
    result.exitCode === 0 &&
    result.captureRoot &&
    result.runRoot &&
    (input.target === "astro" ||
      input.target === "react" ||
      input.target === "webapp");

  if (canEmit) {
    const target = input.target as EmitTarget;
    const captureRoot = resolve(result.captureRoot as string);
    const runRoot = resolve(result.runRoot as string);
    const projectName = projectNameFromUrl(input.url);

    const emitStart = nowIso();
    await patchStage(
      { runDir: ctx.outDir },
      { name: "emit-target", startedAt: emitStart, status: undefined },
    );
    ctx.emit({ type: "stage_start", stage: "emit-target", at: emitStart });

    const emit = await runEmitTargetStage({
      target,
      captureRoot,
      runRoot,
      projectName,
    });
    const emitEnd = nowIso();
    const emitMetrics: Record<string, number | string> = {
      durationMs: emit.durationMs,
    };
    if (emit.summary) {
      emitMetrics.componentsEmitted = emit.summary.componentsEmitted;
      emitMetrics.pagesEmitted = emit.summary.pagesEmitted;
      emitMetrics.assetCount = emit.summary.assetCount;
      emitMetrics.assetBytes = emit.summary.assetBytes;
    }
    if (emit.skipReason) emitMetrics.skipReason = emit.skipReason;

    const emitStatus: RunManifest["status"] =
      emit.status === "ok"
        ? "ok"
        : emit.status === "skipped"
          ? "warn"
          : "fail";
    await patchStage(
      { runDir: ctx.outDir },
      {
        name: "emit-target",
        startedAt: emitStart,
        endedAt: emitEnd,
        status: emitStatus,
        metrics: emitMetrics,
        ...(emit.error ? { errors: [emit.error] } : {}),
        ...(emit.skipReason ? { warnings: [emit.skipReason] } : {}),
      },
    );
    ctx.emit({
      type: "stage_end",
      stage: "emit-target",
      at: emitEnd,
      status: emitStatus,
      durationMs: emit.durationMs,
      metrics: emitMetrics,
    });

    if (emit.status === "ok" && emit.outDir) {
      await registerArtefact(
        { runDir: ctx.outDir },
        "sitesDir",
        emit.outDir,
      );
      ctx.emit({
        type: "artefact",
        stage: "emit-target",
        at: nowIso(),
        name: "sitesDir",
        path: emit.outDir,
      });

      if (input.parity !== false) {
        const diffThreshold =
          typeof input.parityThreshold === "number"
            ? input.parityThreshold
            : DEFAULT_PARITY_THRESHOLDS[target];

        const parityStart = nowIso();
        await patchStage(
          { runDir: ctx.outDir },
          {
            name: "parity-check",
            startedAt: parityStart,
            status: undefined,
          },
        );
        ctx.emit({
          type: "stage_start",
          stage: "parity-check",
          at: parityStart,
        });

        const parityLogPath = join(
          ctx.outDir,
          "stage-logs",
          "parity-check.log",
        );
        await fs.mkdir(resolve(parityLogPath, ".."), { recursive: true });
        const parityLog = createWriteStream(parityLogPath, { flags: "a" });
        const parity = await runParityCheckStage({
          target,
          projectDir: emit.outDir,
          captureRoot,
          runRoot,
          diffThreshold,
          log: (line) => parityLog.write(`${line}\n`),
        });
        await new Promise<void>((r) => parityLog.end(() => r()));

        const parityEnd = nowIso();
        const parityMetrics: Record<string, number | string> = {
          durationMs: parity.durationMs,
          diffThreshold,
        };
        if (typeof parity.score === "number") parityMetrics.score = parity.score;
        if (parity.skipReason) parityMetrics.skipReason = parity.skipReason;

        const parityStatus: RunManifest["status"] =
          parity.status === "ok"
            ? "ok"
            : parity.status === "skipped"
              ? "warn"
              : parity.status === "partial"
                ? "partial"
                : "fail";
        await patchStage(
          { runDir: ctx.outDir },
          {
            name: "parity-check",
            startedAt: parityStart,
            endedAt: parityEnd,
            status: parityStatus,
            metrics: parityMetrics,
            ...(parity.diagnostics.length > 0
              ? { warnings: [...parity.diagnostics] }
              : {}),
            ...(parity.skipReason ? { warnings: [parity.skipReason] } : {}),
          },
        );
        ctx.emit({
          type: "stage_end",
          stage: "parity-check",
          at: parityEnd,
          status: parityStatus,
          durationMs: parity.durationMs,
          metrics: parityMetrics,
        });

        if (parity.reportPath) {
          await registerArtefact(
            { runDir: ctx.outDir },
            "parityReport",
            parity.reportPath,
          );
        }

        if (typeof parity.score === "number") {
          parityForManifest = {
            score: parity.score,
            threshold: 1 - diffThreshold,
            mode: "pixel-diff",
          };
        }

        // Roll up: emit failure -> fail; parity partial -> partial; parity
        // fail -> fail; parity skipped -> keep prior status.
        if (parityStatus === "fail") rolledStatus = "fail";
        else if (parityStatus === "partial" && rolledStatus !== "fail") {
          rolledStatus = "partial";
        }
      }
    } else if (emit.status === "fail") {
      rolledStatus = "fail";
    }
  }

  const finalStatus: RunManifest["status"] = rolledStatus;
  await finaliseManifest(
    { runDir: ctx.outDir },
    {
      status: finalStatus,
      endedAt,
      ...(parityForManifest ? { parity: parityForManifest } : {}),
    },
  );
  ctx.emit({
    type: "run_end",
    at: endedAt,
    status: finalStatus,
    durationMs: Date.now() - ctx.startedAt,
  });

  const summaryPath = await writeSummary(ctx.outDir);
  await ctx.finalise();

  ctx.logger.info("parity clone finished", {
    runId: ctx.runId,
    status: finalStatus,
    summaryPath,
  });

  return {
    runId: ctx.runId,
    runDir: ctx.outDir,
    status: finalStatus,
    summaryPath,
  };
}
