/**
 * Smoke test for `parity runs harvest`.
 *
 * Builds a synthetic `.runs/` fixture with three runs that exhibit:
 *   - a recurring warning ("font 404" emitted in 3 runs)
 *   - a recurring error ("page-load timeout" emitted in 2 runs)
 *   - a parity score regression on one target (100% -> 96% -> 95%)
 *   - a duration drift on the build stage
 *
 * Runs harvest against the fixture and asserts the right tickets land in
 * the output directory plus an INDEX.md listing them.
 *
 * Invocation:
 *   npx tsx scripts/smoke-parity-harvest.ts
 */

import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { harvestRuns } from "../engine/cli/runs-harvest.js";

interface SyntheticStage {
  name: string;
  startedAt: string;
  endedAt: string;
  status: "ok" | "warn" | "fail";
  warnings?: string[];
  errors?: string[];
}

interface SyntheticRun {
  runId: string;
  startedAt: string;
  parity?: { score: number; threshold: number; mode: "manifest-shape" };
  stages: SyntheticStage[];
  events: Record<string, unknown>[];
  target: "astro" | "react";
}

async function writeRun(
  runsDir: string,
  run: SyntheticRun,
): Promise<void> {
  const dir = join(runsDir, run.runId);
  await mkdir(dir, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    runId: run.runId,
    command: "parity clone https://example.com",
    args: {},
    env: { node: "v24.0.0", gitSha: "abc1234", platform: "darwin" },
    target: run.target,
    url: "https://example.com",
    startedAt: run.startedAt,
    endedAt: run.startedAt,
    status: "ok" as const,
    stages: run.stages,
    parity: run.parity,
    artefacts: {},
  };
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  const lines = run.events.map((e) => JSON.stringify(e)).join("\n");
  await writeFile(join(dir, "pipeline.jsonl"), `${lines}\n`, "utf8");
}

function logSection(label: string): void {
  process.stdout.write(`\n--- ${label} ---\n`);
}

async function main(): Promise<void> {
  const sandbox = await mkdtemp(join(tmpdir(), "parity-harvest-smoke-"));
  const runsDir = join(sandbox, "runs");
  const ticketsDir = join(sandbox, "tickets");
  await mkdir(runsDir, { recursive: true });
  await mkdir(ticketsDir, { recursive: true });

  logSection("synth runs");

  // Run 1: warning + error + parity 100%
  await writeRun(runsDir, {
    runId: "2026-05-01T10-00-00-example-001",
    startedAt: "2026-05-01T10:00:00.000Z",
    target: "astro",
    parity: { score: 1.0, threshold: 0.99, mode: "manifest-shape" },
    stages: [
      {
        name: "complete-assets",
        startedAt: "2026-05-01T10:00:01.000Z",
        endedAt: "2026-05-01T10:00:11.000Z",
        status: "warn",
        warnings: ["font 404"],
      },
      {
        name: "capture",
        startedAt: "2026-05-01T10:00:11.000Z",
        endedAt: "2026-05-01T10:00:14.000Z",
        status: "fail",
        errors: ["page-load timeout"],
      },
      {
        name: "build",
        startedAt: "2026-05-01T10:00:14.000Z",
        endedAt: "2026-05-01T10:00:16.000Z",
        status: "ok",
      },
    ],
    events: [
      {
        type: "warning",
        stage: "complete-assets",
        at: "2026-05-01T10:00:11.000Z",
        message: "font 404",
        hint: "retry the URL with opposite scheme",
      },
      {
        type: "error",
        stage: "capture",
        at: "2026-05-01T10:00:14.000Z",
        message: "page-load timeout",
      },
    ],
  });

  // Run 2: same warning + parity drop + same error
  await writeRun(runsDir, {
    runId: "2026-05-05T10-00-00-example-002",
    startedAt: "2026-05-05T10:00:00.000Z",
    target: "astro",
    parity: { score: 0.96, threshold: 0.99, mode: "manifest-shape" },
    stages: [
      {
        name: "complete-assets",
        startedAt: "2026-05-05T10:00:01.000Z",
        endedAt: "2026-05-05T10:00:11.000Z",
        status: "warn",
        warnings: ["font 404"],
      },
      {
        name: "capture",
        startedAt: "2026-05-05T10:00:11.000Z",
        endedAt: "2026-05-05T10:00:14.000Z",
        status: "fail",
        errors: ["page-load timeout"],
      },
      {
        name: "build",
        startedAt: "2026-05-05T10:00:14.000Z",
        endedAt: "2026-05-05T10:00:18.000Z",
        status: "ok",
      },
    ],
    events: [
      {
        type: "warning",
        stage: "complete-assets",
        at: "2026-05-05T10:00:11.000Z",
        message: "font 404",
        hint: "retry the URL with opposite scheme",
      },
      {
        type: "error",
        stage: "capture",
        at: "2026-05-05T10:00:14.000Z",
        message: "page-load timeout",
      },
    ],
  });

  // Run 3: warning sticks, parity falls further, build duration drifts
  await writeRun(runsDir, {
    runId: "2026-05-09T10-00-00-example-003",
    startedAt: "2026-05-09T10:00:00.000Z",
    target: "astro",
    parity: { score: 0.95, threshold: 0.99, mode: "manifest-shape" },
    stages: [
      {
        name: "complete-assets",
        startedAt: "2026-05-09T10:00:01.000Z",
        endedAt: "2026-05-09T10:00:11.000Z",
        status: "warn",
        warnings: ["font 404"],
      },
      {
        name: "build",
        startedAt: "2026-05-09T10:00:11.000Z",
        endedAt: "2026-05-09T10:00:21.000Z",
        status: "ok",
      },
    ],
    events: [
      {
        type: "warning",
        stage: "complete-assets",
        at: "2026-05-09T10:00:11.000Z",
        message: "font 404",
        hint: "retry the URL with opposite scheme",
      },
    ],
  });

  logSection("run harvest");
  const result = await harvestRuns({
    repoRoot: sandbox,
    runsDir,
    ticketsDir,
    minRecurrence: 2,
  });

  process.stdout.write(
    `runsScanned=${result.runsScanned} findings=${result.findings.length} tickets=${result.ticketsWritten.length}\n`,
  );

  const failures: string[] = [];

  if (result.runsScanned !== 3) {
    failures.push(`expected 3 runs scanned, got ${result.runsScanned}`);
  }
  if (result.findings.length === 0) {
    failures.push("expected at least one finding");
  }

  const kinds = new Set(result.findings.map((f) => f.type));
  for (const required of [
    "recurring-warning",
    "repeat-error",
    "parity-regression",
    "stuck-warning",
  ] as const) {
    if (!kinds.has(required)) failures.push(`missing finding kind: ${required}`);
  }

  const indexBody = await readFile(result.indexPath, "utf8");
  if (!indexBody.includes("|") || !indexBody.includes("open")) {
    failures.push("INDEX.md is missing expected table rows");
  }

  // Idempotency: re running should not duplicate tickets.
  const before = result.ticketsWritten.length;
  const result2 = await harvestRuns({
    repoRoot: sandbox,
    runsDir,
    ticketsDir,
    minRecurrence: 2,
  });
  if (result2.ticketsWritten.length !== before) {
    failures.push(
      `re run expected ${before} tickets, got ${result2.ticketsWritten.length}`,
    );
  }

  // Sanity check: every ticket parses and includes the locked sections.
  for (const path of result.ticketsWritten) {
    const body = await readFile(path, "utf8");
    for (const heading of [
      "## Symptom",
      "## Affected Runs",
      "## Suggested Triage",
      "## Status",
    ]) {
      if (!body.includes(heading)) {
        failures.push(`ticket ${path} missing heading ${heading}`);
      }
    }
    if (!body.includes("**Severity:**")) {
      failures.push(`ticket ${path} missing severity line`);
    }
  }

  if (failures.length > 0) {
    process.stdout.write(`\nFAIL\n${failures.map((f) => `  - ${f}`).join("\n")}\n`);
    await rm(sandbox, { recursive: true, force: true });
    process.exit(1);
  }

  await rm(sandbox, { recursive: true, force: true });
  process.stdout.write("\nPASS smoke-parity-harvest\n");
}

main().catch((err) => {
  process.stdout.write(`ERROR ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
