/**
 * `parity clone` end-to-end pipeline shim.
 *
 * Phase 5 minimal wiring per docs/V2.0/05-action-plan.md §4 Phase 5 task 9.
 *
 * This shim composes the existing clone phases (capture, parse:har,
 * parse:trace, clone) by invoking `scripts/run-clone.ts` as a single
 * subprocess. The full subprocess removal (Phase 5 task 7) is deferred to
 * a follow-up agent; this shim still gives us a real run record because
 * the unified RunContext + manifest + SUMMARY.md surround the legacy
 * pipeline.
 *
 * Stdout and stderr of the child are tee'd into the run's stage-log file
 * so the unified log surface still sees every line. Once the legacy script
 * is converted to in-process stages, this shim collapses into direct
 * function calls and the spawn disappears.
 */

import { execSync, spawn } from "node:child_process";
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

export interface ParityCloneInput {
  url: string;
  target?: "astro" | "react" | "webapp" | "html-mirror";
  viewports?: string;
  tour: boolean;
  outDir?: string;
  runId?: string;
}

export interface ParityCloneResult {
  runId: string;
  runDir: string;
  status: "ok" | "warn" | "fail";
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
  const args = ["tsx", "scripts/run-clone.ts", input.url];
  if (input.viewports) args.push(`--viewport=${input.viewports}`);
  if (input.outDir) args.push(`--out=${input.outDir}`);
  if (!input.tour) args.push("--no-tour");
  args.push("--no-preview");
  return args;
}

/**
 * Run the existing `scripts/run-clone.ts` pipeline as a subprocess and tee
 * its stdout/stderr into the supplied log file.
 */
async function spawnLegacyRunClone(
  args: string[],
  logPath: string,
  cwd: string,
): Promise<{ exitCode: number }> {
  await fs.mkdir(resolve(logPath, ".."), { recursive: true });
  const logStream = createWriteStream(logPath, { flags: "a" });
  return new Promise((resolveFn) => {
    const child = spawn("npx", args, { cwd, env: process.env });
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });
    child.on("close", (code) => {
      logStream.end(() => resolveFn({ exitCode: code ?? 1 }));
    });
  });
}

/**
 * End-to-end clone command. Creates a RunContext, initialises the manifest,
 * runs the existing pipeline, finalises the manifest, and writes SUMMARY.md.
 */
export async function runParityClone(
  input: ParityCloneInput,
): Promise<ParityCloneResult> {
  const ctx = await createRunContext({ runId: input.runId });
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
  const args = buildRunCloneArgs(input);
  const t0 = Date.now();
  const { exitCode } = await spawnLegacyRunClone(args, stageLogPath, process.cwd());
  const durationMs = Date.now() - t0;
  const endedAt = nowIso();
  const status: "ok" | "fail" = exitCode === 0 ? "ok" : "fail";

  await patchStage(
    { runDir: ctx.outDir },
    {
      name: stageName,
      startedAt: stageStart,
      endedAt,
      status,
      metrics: { exitCode, durationMs },
    },
  );
  ctx.emit({
    type: "stage_end",
    stage: stageName,
    at: endedAt,
    status,
    durationMs,
    metrics: { exitCode, durationMs },
  });

  // Best-effort: discover the capture dir the legacy pipeline produced and
  // record it as an artefact. The legacy script prints the path but does not
  // emit a manifest; we look for the newest capture under the default root.
  const outRoot = input.outDir ?? "docs/research/captures";
  try {
    const captureRoot = resolve(process.cwd(), outRoot);
    const exists = await fs
      .stat(captureRoot)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      await registerArtefact(
        { runDir: ctx.outDir },
        "captureRoot",
        captureRoot,
      );
    }
  } catch {
    // Non-fatal: artefact discovery is best-effort.
  }

  const finalStatus: RunManifest["status"] = status;
  await finaliseManifest(
    { runDir: ctx.outDir },
    { status: finalStatus, endedAt },
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
