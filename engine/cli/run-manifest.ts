/**
 * Run manifest writer.
 *
 * Phase 5 implementation per docs/V2.0/04-cli-and-logging-design.md (Part D, D.1)
 * and docs/V2.0/05-action-plan.md §4 Phase 5 task 1.
 *
 * Owns the lifecycle of `.runs/<runId>/manifest.json`. Writes are full
 * rewrites of the JSON file; atomicity is achieved via write-to-tmp then
 * rename. The schema is versioned. Readers MUST hard fail on mismatch.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export const RUN_MANIFEST_SCHEMA_VERSION = 1;

export type RunStatus = "running" | "ok" | "warn" | "partial" | "fail";

/**
 * `partial` (W5B.1 item 2) is additive: stage finished and produced output
 * but some sub units failed. Readers that do not know about partial treat
 * it as warn for display purposes; schemaVersion stays at 1.
 */
export type StageStatus = "ok" | "warn" | "partial" | "fail";

export interface RunManifestStage {
  name: string;
  startedAt: string;
  endedAt?: string;
  status?: StageStatus;
  metrics?: Record<string, number | string>;
  warnings?: string[];
  errors?: string[];
}

export interface RunManifestParity {
  score: number;
  threshold: number;
  mode: "bytes" | "pixel-diff" | "both" | "manifest-shape";
}

export interface RunManifest {
  schemaVersion: number;
  runId: string;
  command: string;
  args: Record<string, unknown>;
  env: {
    node: string;
    gitSha: string;
    platform: string;
  };
  target?: "astro" | "react" | "webapp" | "html-mirror";
  url?: string;
  startedAt: string;
  endedAt?: string;
  status: RunStatus;
  stages: RunManifestStage[];
  parity?: RunManifestParity;
  artefacts: Record<string, string>;
}

export interface ManifestContext {
  readonly runDir: string;
}

function manifestPath(ctx: ManifestContext): string {
  return join(ctx.runDir, "manifest.json");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await ensureDir(dirname(path));
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, path);
}

/**
 * Schema mismatch error. Surface this to the user with the migrate hint.
 */
export class ManifestSchemaError extends Error {
  constructor(
    readonly runId: string,
    readonly found: number,
    readonly expected: number,
  ) {
    super(
      `manifest schemaVersion mismatch (found=${found}, expected=${expected})`,
    );
    this.name = "ManifestSchemaError";
  }
}

export async function readManifest(ctx: ManifestContext): Promise<RunManifest> {
  const path = manifestPath(ctx);
  const raw = await fs.readFile(path, "utf8");
  const parsed = JSON.parse(raw) as RunManifest;
  if (parsed.schemaVersion !== RUN_MANIFEST_SCHEMA_VERSION) {
    throw new ManifestSchemaError(
      parsed.runId ?? "unknown",
      parsed.schemaVersion,
      RUN_MANIFEST_SCHEMA_VERSION,
    );
  }
  return parsed;
}

export interface InitManifestInput {
  runId: string;
  command: string;
  args: Record<string, unknown>;
  env: { node: string; gitSha: string; platform: string };
  target?: RunManifest["target"];
  url?: string;
  startedAt: string;
}

export async function initManifest(
  ctx: ManifestContext,
  input: InitManifestInput,
): Promise<RunManifest> {
  const manifest: RunManifest = {
    schemaVersion: RUN_MANIFEST_SCHEMA_VERSION,
    runId: input.runId,
    command: input.command,
    args: input.args,
    env: input.env,
    target: input.target,
    url: input.url,
    startedAt: input.startedAt,
    status: "running",
    stages: [],
    artefacts: {},
  };
  await writeJsonAtomic(manifestPath(ctx), manifest);
  return manifest;
}

/**
 * Shallow-merge a patch into the manifest on disk. Stage entries are merged
 * by `name` rather than appended blindly so repeated `patchStage` calls
 * update the existing record.
 */
export async function updateManifest(
  ctx: ManifestContext,
  patch: Partial<RunManifest>,
): Promise<RunManifest> {
  const current = await readManifest(ctx);
  const merged: RunManifest = {
    ...current,
    ...patch,
    env: { ...current.env, ...(patch.env ?? {}) },
    artefacts: { ...current.artefacts, ...(patch.artefacts ?? {}) },
    stages: mergeStages(current.stages, patch.stages),
  };
  await writeJsonAtomic(manifestPath(ctx), merged);
  return merged;
}

function mergeStages(
  existing: RunManifestStage[],
  incoming?: RunManifestStage[],
): RunManifestStage[] {
  if (!incoming || incoming.length === 0) return existing;
  const byName = new Map<string, RunManifestStage>();
  for (const stage of existing) byName.set(stage.name, stage);
  for (const stage of incoming) {
    const prev = byName.get(stage.name);
    byName.set(stage.name, prev ? { ...prev, ...stage } : stage);
  }
  return Array.from(byName.values());
}

export async function patchStage(
  ctx: ManifestContext,
  stage: RunManifestStage,
): Promise<RunManifest> {
  return updateManifest(ctx, { stages: [stage] });
}

export async function registerArtefact(
  ctx: ManifestContext,
  name: string,
  path: string,
): Promise<RunManifest> {
  return updateManifest(ctx, { artefacts: { [name]: path } });
}

export interface FinaliseManifestInput {
  status: RunStatus;
  endedAt: string;
  parity?: RunManifestParity;
}

export async function finaliseManifest(
  ctx: ManifestContext,
  input: FinaliseManifestInput,
): Promise<RunManifest> {
  return updateManifest(ctx, {
    status: input.status,
    endedAt: input.endedAt,
    parity: input.parity,
  });
}
