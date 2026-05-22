/**
 * `parity runs harvest` implementation.
 *
 * Phase 6 task 1 per docs/V2.0/05-action-plan.md.
 *
 * Walks every `.runs/<runId>/` directory, reads each `manifest.json` and
 * `pipeline.jsonl`, aggregates findings across runs, and emits per finding
 * markdown tickets under `docs/parity-issues/`. The INDEX.md triage queue
 * lists every open ticket sorted by severity then surface count.
 *
 * Finding kinds emitted today:
 *   recurring-warning   stage warnings repeated across multiple runs
 *   repeat-error        stage errors repeated across multiple runs
 *   parity-regression   parity score dropping across consecutive runs for a target
 *   duration-drift      a stage that is materially slower than its rolling median
 *   stuck-warning       a recurring warning that is still showing in the latest run
 *
 * Idempotent: re running harvest updates existing tickets in place
 * (bumps surface count, last seen) keyed by a stable finding slug.
 */

import { promises as fs } from "node:fs";
import { join, relative } from "node:path";
import {
  type PipelineEvent,
  readEventStream,
} from "./event-stream-read.js";
import {
  type RunManifest,
  type RunManifestStage,
  readManifestAt,
} from "./run-manifest-read.js";

export type FindingType =
  | "recurring-warning"
  | "repeat-error"
  | "parity-regression"
  | "duration-drift"
  | "stuck-warning";

export type FindingSeverity = "P1" | "P2" | "P3";

export interface AffectedRunRow {
  runId: string;
  parityScore?: number;
  excerpt: string;
}

export interface Finding {
  slug: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  symptom: string;
  triageSuggestion: string;
  affectedTargets: string[];
  affectedRuns: AffectedRunRow[];
  firstSeen: string;
  lastSeen: string;
  surfaceCount: number;
}

export interface HarvestOptions {
  repoRoot: string;
  runsDir?: string;
  ticketsDir?: string;
  since?: string;
  target?: string;
  minRecurrence?: number;
  /**
   * When true, the harvester walks runs and computes findings but does
   * NOT write ticket markdown files or update INDEX.md. The returned
   * HarvestResult still lists the would be ticket paths so callers can
   * preview the plan. Replaces the previous --tickets-dir=<tmp> hack.
   */
  dryRun?: boolean;
}

export interface HarvestResult {
  runsScanned: number;
  findings: Finding[];
  ticketsWritten: string[];
  indexPath: string;
}

interface LoadedRun {
  runId: string;
  runDir: string;
  manifest: RunManifest;
  events: PipelineEvent[];
}

const TICKETS_DIRNAME = "docs/parity-issues";
const RUNS_DIRNAME = ".runs";
const DEFAULT_MIN_RECURRENCE = 2;
const DURATION_DRIFT_RATIO = 1.5;

const TARGET_LABEL_ANY = "all";

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
};

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

export async function harvestRuns(
  opts: HarvestOptions,
): Promise<HarvestResult> {
  const runsDir = opts.runsDir ?? join(opts.repoRoot, RUNS_DIRNAME);
  const ticketsDir = opts.ticketsDir ?? join(opts.repoRoot, TICKETS_DIRNAME);
  const minRecurrence = opts.minRecurrence ?? DEFAULT_MIN_RECURRENCE;
  const dryRun = opts.dryRun === true;

  const runs = await loadRuns(runsDir, opts);

  const findings = aggregateFindings(runs, { minRecurrence });

  if (!dryRun) {
    await fs.mkdir(ticketsDir, { recursive: true });
  }

  const ticketsWritten: string[] = [];
  for (const finding of findings) {
    const ticketPath = join(ticketsDir, `${finding.slug}.md`);
    if (!dryRun) {
      await upsertTicket(ticketPath, finding);
    }
    ticketsWritten.push(ticketPath);
  }

  const indexPath = join(ticketsDir, "INDEX.md");
  if (!dryRun) {
    await writeIndex(indexPath, findings, opts.repoRoot);
  }

  return {
    runsScanned: runs.length,
    findings,
    ticketsWritten,
    indexPath,
  };
}

/* -------------------------------------------------------------------------- */
/* Run loading                                                                */
/* -------------------------------------------------------------------------- */

async function loadRuns(
  runsDir: string,
  opts: HarvestOptions,
): Promise<LoadedRun[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    return [];
  }

  const sinceMs = opts.since ? Date.parse(opts.since) : Number.NaN;
  const out: LoadedRun[] = [];

  for (const name of entries) {
    const runDir = join(runsDir, name);
    let stat;
    try {
      stat = await fs.stat(runDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let manifest: RunManifest | undefined;
    try {
      manifest = await readManifestAt(join(runDir, "manifest.json"));
    } catch {
      continue;
    }
    if (!manifest) continue;

    if (Number.isFinite(sinceMs)) {
      const startedMs = Date.parse(manifest.startedAt);
      if (Number.isFinite(startedMs) && startedMs < sinceMs) continue;
    }

    if (opts.target) {
      const targetKey = inferTargetKey(manifest);
      if (targetKey !== opts.target) continue;
    }

    const events = await readEventStream(join(runDir, "pipeline.jsonl"));

    out.push({ runId: manifest.runId, runDir, manifest, events });
  }

  out.sort((a, b) => a.manifest.startedAt.localeCompare(b.manifest.startedAt));
  return out;
}

function inferTargetKey(manifest: RunManifest): string {
  if (manifest.target) return manifest.target;
  if (manifest.url) {
    try {
      return new URL(manifest.url).host;
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

interface AggregateOptions {
  minRecurrence: number;
}

export function aggregateFindings(
  runs: LoadedRun[],
  opts: AggregateOptions,
): Finding[] {
  const findings: Finding[] = [];

  findings.push(
    ...aggregateRecurringMessages(runs, "warning", opts.minRecurrence),
  );
  findings.push(
    ...aggregateRecurringMessages(runs, "error", opts.minRecurrence),
  );
  findings.push(...aggregateParityRegressions(runs));
  findings.push(...aggregateDurationDrift(runs));
  findings.push(...aggregateStuckWarnings(runs));

  // Dedupe by slug. Later entries overwrite earlier ones because the later
  // run is the more recent surface and carries the same aggregated stats.
  const bySlug = new Map<string, Finding>();
  for (const finding of findings) {
    bySlug.set(finding.slug, finding);
  }

  const ordered = Array.from(bySlug.values());
  ordered.sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.surfaceCount - a.surfaceCount;
  });
  return ordered;
}

/* ---- recurring warnings / errors ---------------------------------------- */

function aggregateRecurringMessages(
  runs: LoadedRun[],
  kind: "warning" | "error",
  minRecurrence: number,
): Finding[] {
  const buckets = new Map<
    string,
    {
      stage: string;
      message: string;
      runIds: Set<string>;
      runs: AffectedRunRow[];
      targets: Set<string>;
      firstSeen: string;
      lastSeen: string;
    }
  >();

  for (const run of runs) {
    // pipeline.jsonl surfaces
    for (const event of run.events) {
      if (event.type !== kind) continue;
      const stage = event.stage ?? "unknown";
      const message = normaliseMessage(event.message ?? "");
      if (!message) continue;
      const key = `${stage}::${message}`;
      addBucket(
        buckets,
        key,
        stage,
        message,
        run,
        excerptForEvent(event),
      );
    }
    // manifest.stages[].warnings / errors surfaces
    for (const stage of run.manifest.stages) {
      const list = kind === "warning" ? stage.warnings : stage.errors;
      if (!list) continue;
      for (const raw of list) {
        const message = normaliseMessage(raw);
        if (!message) continue;
        const key = `${stage.name}::${message}`;
        addBucket(
          buckets,
          key,
          stage.name,
          message,
          run,
          truncate(raw, 200),
        );
      }
    }
  }

  const findings: Finding[] = [];
  for (const [, bucket] of buckets) {
    if (bucket.runIds.size < minRecurrence) continue;
    const targets = Array.from(bucket.targets);
    const slug = buildSlug(
      kind === "warning" ? "recurring-warning" : "repeat-error",
      bucket.stage,
      bucket.message,
    );
    findings.push({
      slug,
      type: kind === "warning" ? "recurring-warning" : "repeat-error",
      severity: classifySeverity(
        kind === "warning" ? "recurring-warning" : "repeat-error",
        bucket.runIds.size,
      ),
      title: `${bucket.stage} ${kind}: ${truncate(bucket.message, 80)}`,
      symptom: `Stage \`${bucket.stage}\` emitted the same ${kind} across ${bucket.runIds.size} runs. Message: "${truncate(bucket.message, 240)}".`,
      triageSuggestion: triageSuggestion(
        kind === "warning" ? "recurring-warning" : "repeat-error",
        bucket.stage,
      ),
      affectedTargets:
        targets.length === 0 ? [TARGET_LABEL_ANY] : targets.sort(),
      affectedRuns: bucket.runs,
      firstSeen: bucket.firstSeen,
      lastSeen: bucket.lastSeen,
      surfaceCount: bucket.runIds.size,
    });
  }
  return findings;
}

function addBucket(
  buckets: Map<
    string,
    {
      stage: string;
      message: string;
      runIds: Set<string>;
      runs: AffectedRunRow[];
      targets: Set<string>;
      firstSeen: string;
      lastSeen: string;
    }
  >,
  key: string,
  stage: string,
  message: string,
  run: LoadedRun,
  excerpt: string,
): void {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      stage,
      message,
      runIds: new Set(),
      runs: [],
      targets: new Set(),
      firstSeen: run.manifest.startedAt,
      lastSeen: run.manifest.startedAt,
    };
    buckets.set(key, bucket);
  }
  if (bucket.runIds.has(run.runId)) return;
  bucket.runIds.add(run.runId);
  bucket.runs.push({
    runId: run.runId,
    parityScore: run.manifest.parity?.score,
    excerpt,
  });
  bucket.targets.add(inferTargetKey(run.manifest));
  if (run.manifest.startedAt < bucket.firstSeen)
    bucket.firstSeen = run.manifest.startedAt;
  if (run.manifest.startedAt > bucket.lastSeen)
    bucket.lastSeen = run.manifest.startedAt;
}

/* ---- parity regressions ------------------------------------------------- */

function aggregateParityRegressions(runs: LoadedRun[]): Finding[] {
  const byTarget = new Map<string, LoadedRun[]>();
  for (const run of runs) {
    if (!run.manifest.parity) continue;
    const key = inferTargetKey(run.manifest);
    const list = byTarget.get(key) ?? [];
    list.push(run);
    byTarget.set(key, list);
  }

  const findings: Finding[] = [];
  for (const [target, list] of byTarget) {
    if (list.length < 2) continue;
    list.sort((a, b) =>
      a.manifest.startedAt.localeCompare(b.manifest.startedAt),
    );
    let regressionRuns: LoadedRun[] = [];
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const curr = list[i];
      const prevScore = prev.manifest.parity?.score ?? 0;
      const currScore = curr.manifest.parity?.score ?? 0;
      if (currScore + 1e-6 < prevScore) {
        regressionRuns.push(prev, curr);
      }
    }
    regressionRuns = dedupeRuns(regressionRuns);
    if (regressionRuns.length === 0) continue;

    const sortedScores = regressionRuns.map(
      (r) => r.manifest.parity?.score ?? 0,
    );
    const slug = buildSlug("parity-regression", target);
    findings.push({
      slug,
      type: "parity-regression",
      severity: classifySeverity("parity-regression", regressionRuns.length),
      title: `Parity score regression on ${target}`,
      symptom: `Target \`${target}\` parity score dropped across consecutive runs. Scores in order: ${sortedScores
        .map((s) => `${(s * 100).toFixed(1)}%`)
        .join(" -> ")}.`,
      triageSuggestion: triageSuggestion("parity-regression", target),
      affectedTargets: [target],
      affectedRuns: regressionRuns.map((r) => ({
        runId: r.runId,
        parityScore: r.manifest.parity?.score,
        excerpt: `parity ${(r.manifest.parity?.score ?? 0 * 100).toFixed(2)}, threshold ${(r.manifest.parity?.threshold ?? 0 * 100).toFixed(2)}`,
      })),
      firstSeen: regressionRuns[0].manifest.startedAt,
      lastSeen: regressionRuns[regressionRuns.length - 1].manifest.startedAt,
      surfaceCount: regressionRuns.length,
    });
  }
  return findings;
}

function dedupeRuns(runs: LoadedRun[]): LoadedRun[] {
  const seen = new Set<string>();
  const out: LoadedRun[] = [];
  for (const r of runs) {
    if (seen.has(r.runId)) continue;
    seen.add(r.runId);
    out.push(r);
  }
  return out;
}

/* ---- duration drift ----------------------------------------------------- */

function aggregateDurationDrift(runs: LoadedRun[]): Finding[] {
  const byStage = new Map<
    string,
    { run: LoadedRun; duration: number }[]
  >();

  for (const run of runs) {
    for (const stage of run.manifest.stages) {
      const duration = stageDurationMs(stage);
      if (duration === undefined) continue;
      const list = byStage.get(stage.name) ?? [];
      list.push({ run, duration });
      byStage.set(stage.name, list);
    }
  }

  const findings: Finding[] = [];
  for (const [stageName, list] of byStage) {
    if (list.length < 3) continue;
    list.sort((a, b) =>
      a.run.manifest.startedAt.localeCompare(b.run.manifest.startedAt),
    );
    const durations = list.map((x) => x.duration);
    const median = computeMedian(durations.slice(0, Math.max(1, list.length - 1)));
    if (median <= 0) continue;

    const drifted = list.filter((x) => x.duration > median * DURATION_DRIFT_RATIO);
    if (drifted.length < 2) continue;

    const slug = buildSlug("duration-drift", stageName);
    findings.push({
      slug,
      type: "duration-drift",
      severity: classifySeverity("duration-drift", drifted.length),
      title: `Stage ${stageName} duration drifted ${Math.round((drifted[drifted.length - 1].duration / median - 1) * 100)}% above median`,
      symptom: `Stage \`${stageName}\` duration drifted to ${drifted[drifted.length - 1].duration} ms across ${drifted.length} runs versus a rolling median of ${median} ms.`,
      triageSuggestion: triageSuggestion("duration-drift", stageName),
      affectedTargets: Array.from(
        new Set(drifted.map((x) => inferTargetKey(x.run.manifest))),
      ).sort(),
      affectedRuns: drifted.map((x) => ({
        runId: x.run.runId,
        parityScore: x.run.manifest.parity?.score,
        excerpt: `${stageName} took ${x.duration} ms`,
      })),
      firstSeen: drifted[0].run.manifest.startedAt,
      lastSeen: drifted[drifted.length - 1].run.manifest.startedAt,
      surfaceCount: drifted.length,
    });
  }
  return findings;
}

function stageDurationMs(stage: RunManifestStage): number | undefined {
  if (!stage.startedAt || !stage.endedAt) return undefined;
  const a = Date.parse(stage.startedAt);
  const b = Date.parse(stage.endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return Math.max(0, b - a);
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/* ---- stuck warnings ----------------------------------------------------- */

function aggregateStuckWarnings(runs: LoadedRun[]): Finding[] {
  if (runs.length === 0) return [];

  const latest = runs[runs.length - 1];
  const latestKeys = new Set<string>();
  for (const event of latest.events) {
    if (event.type !== "warning") continue;
    if (typeof event.hint !== "string" || event.hint.length === 0) continue;
    const message = normaliseMessage(event.message ?? "");
    if (!message) continue;
    latestKeys.add(`${event.stage ?? "unknown"}::${message}`);
  }

  if (latestKeys.size === 0) return [];

  const buckets = new Map<
    string,
    {
      stage: string;
      message: string;
      hint: string;
      runIds: Set<string>;
      runs: AffectedRunRow[];
      targets: Set<string>;
      firstSeen: string;
      lastSeen: string;
    }
  >();

  for (const run of runs) {
    for (const event of run.events) {
      if (event.type !== "warning") continue;
      const message = normaliseMessage(event.message ?? "");
      const stage = event.stage ?? "unknown";
      if (!message) continue;
      const key = `${stage}::${message}`;
      if (!latestKeys.has(key)) continue;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          stage,
          message,
          hint: typeof event.hint === "string" ? event.hint : "",
          runIds: new Set(),
          runs: [],
          targets: new Set(),
          firstSeen: run.manifest.startedAt,
          lastSeen: run.manifest.startedAt,
        };
        buckets.set(key, bucket);
      }
      if (bucket.runIds.has(run.runId)) continue;
      bucket.runIds.add(run.runId);
      bucket.runs.push({
        runId: run.runId,
        parityScore: run.manifest.parity?.score,
        excerpt: excerptForEvent(event),
      });
      bucket.targets.add(inferTargetKey(run.manifest));
      if (run.manifest.startedAt < bucket.firstSeen)
        bucket.firstSeen = run.manifest.startedAt;
      if (run.manifest.startedAt > bucket.lastSeen)
        bucket.lastSeen = run.manifest.startedAt;
    }
  }

  const findings: Finding[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.runIds.size < 2) continue;
    const slug = buildSlug("stuck-warning", bucket.stage, bucket.message);
    findings.push({
      slug,
      type: "stuck-warning",
      severity: classifySeverity("stuck-warning", bucket.runIds.size),
      title: `${bucket.stage} stuck warning: ${truncate(bucket.message, 80)}`,
      symptom: `Stage \`${bucket.stage}\` keeps emitting the warning "${truncate(bucket.message, 240)}" with hint \`${bucket.hint}\` across ${bucket.runIds.size} runs including the latest. The hint suggests a Dr Parity gap that has not been closed.`,
      triageSuggestion: triageSuggestion("stuck-warning", bucket.stage),
      affectedTargets:
        bucket.targets.size === 0
          ? [TARGET_LABEL_ANY]
          : Array.from(bucket.targets).sort(),
      affectedRuns: bucket.runs,
      firstSeen: bucket.firstSeen,
      lastSeen: bucket.lastSeen,
      surfaceCount: bucket.runIds.size,
    });
  }
  return findings;
}

/* -------------------------------------------------------------------------- */
/* Slug + severity + suggestion heuristics                                    */
/* -------------------------------------------------------------------------- */

export function buildSlug(
  type: FindingType,
  ...parts: string[]
): string {
  const body = parts.map(slugify).filter(Boolean).join("-");
  return `${type}-${body || "general"}`.slice(0, 96);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function classifySeverity(
  type: FindingType,
  surface: number,
): FindingSeverity {
  if (type === "parity-regression") return surface >= 3 ? "P1" : "P2";
  if (type === "repeat-error") return surface >= 3 ? "P1" : "P2";
  if (type === "stuck-warning") return surface >= 4 ? "P1" : "P2";
  if (type === "recurring-warning") return surface >= 5 ? "P2" : "P3";
  if (type === "duration-drift") return surface >= 4 ? "P2" : "P3";
  return "P3";
}

function triageSuggestion(type: FindingType, hint: string): string {
  switch (type) {
    case "parity-regression":
      return `Compare the most recent run's clone output against the prior passing run for target ${hint}. Look for changed fixtures, new selectors, or upstream extractor changes. Re run with the latest extractor and parity-check stage against the locked fixture.`;
    case "repeat-error":
      return `Open the latest run's stage-logs for ${hint} and read the surrounding context. Add a regression test that reproduces this error against an existing fixture so the fix is locked in.`;
    case "recurring-warning":
      return `Read the latest run's stage-logs for ${hint}. If the warning maps to a real engine gap, escalate by adding a stuck warning hint with a clear remediation path so future surfaces can be triaged automatically.`;
    case "duration-drift":
      return `Profile the ${hint} stage against the slowest recent run. Compare HAR size, asset count, and DOM snapshot count between fast and slow runs. Common culprits include unbounded network waits, missing concurrency limits, and DOM walkers that visit every node.`;
    case "stuck-warning":
      return `The warning hint already names a remediation. Open the run's pipeline.jsonl for ${hint} and confirm the stage emits the hint exactly. If the hint is wrong, update the stage to emit a sharper one. If the hint is right, implement the fix.`;
    default:
      return "Investigate the affected runs and confirm whether this finding maps to a Dr Parity gap.";
  }
}

/* -------------------------------------------------------------------------- */
/* Ticket and INDEX writers                                                   */
/* -------------------------------------------------------------------------- */

const FRONT_MATTER_START = "<!-- harvest:start -->";
const FRONT_MATTER_END = "<!-- harvest:end -->";

async function upsertTicket(
  ticketPath: string,
  finding: Finding,
): Promise<void> {
  const existing = await safeReadFile(ticketPath);
  const body = renderTicket(finding);

  if (!existing) {
    await fs.writeFile(ticketPath, body, "utf8");
    return;
  }

  const replaced = replaceManagedBlock(existing, body);
  if (replaced === existing) return;
  await fs.writeFile(ticketPath, replaced, "utf8");
}

function replaceManagedBlock(existing: string, replacement: string): string {
  const start = existing.indexOf(FRONT_MATTER_START);
  const end = existing.indexOf(FRONT_MATTER_END);
  if (start < 0 || end < 0 || end < start) {
    return replacement;
  }
  return replacement;
}

function renderTicket(finding: Finding): string {
  const lines: string[] = [];
  lines.push(FRONT_MATTER_START);
  lines.push(`# ${finding.slug}`);
  lines.push("");
  lines.push(`**Severity:** ${finding.severity}`);
  lines.push(`**Type:** ${finding.type}`);
  lines.push(`**First seen:** ${finding.firstSeen}`);
  lines.push(`**Last seen:** ${finding.lastSeen}`);
  lines.push(`**Surface count:** ${finding.surfaceCount}`);
  lines.push(
    `**Affected targets:** ${finding.affectedTargets.join(", ") || TARGET_LABEL_ANY}`,
  );
  lines.push("");
  lines.push("## Symptom");
  lines.push(finding.symptom);
  lines.push("");
  lines.push("## Affected Runs");
  for (const row of finding.affectedRuns) {
    const score =
      row.parityScore !== undefined
        ? `parity ${(row.parityScore * 100).toFixed(1)}%`
        : "parity n/a";
    lines.push(`- \`${row.runId}\` (${score}, ${row.excerpt})`);
  }
  lines.push("");
  lines.push("## Suggested Triage");
  lines.push(finding.triageSuggestion);
  lines.push("");
  lines.push("## Status");
  lines.push("- [ ] Triaged by Cameron");
  lines.push("- [ ] Linked to fix PR");
  lines.push("- [ ] Resolved (which run confirmed)");
  lines.push(FRONT_MATTER_END);
  lines.push("");
  return lines.join("\n");
}

async function writeIndex(
  indexPath: string,
  findings: Finding[],
  repoRoot: string,
): Promise<void> {
  const lines: string[] = [];
  lines.push("# Dr Parity Self Improvement Queue");
  lines.push("");
  lines.push(
    "Updated by `parity runs harvest`. Sorted by severity then surface count.",
  );
  lines.push("");
  lines.push(
    "| Severity | Type | Title | Surface | First seen | Last seen | Status |",
  );
  lines.push(
    "|----------|------|-------|---------|------------|-----------|--------|",
  );
  for (const finding of findings) {
    const ticketRel = relative(
      repoRoot,
      join(indexPath, "..", `${finding.slug}.md`),
    );
    lines.push(
      `| ${finding.severity} | ${finding.type} | [${finding.title}](${relative(
        repoRoot,
        join(repoRoot, ticketRel),
      ).replace(/^docs\/parity-issues\//, "")}) | ${finding.surfaceCount} | ${finding.firstSeen.slice(0, 10)} | ${finding.lastSeen.slice(0, 10)} | open |`,
    );
  }
  if (findings.length === 0) {
    lines.push(
      "| n/a | n/a | No findings yet. Run more clones to populate the queue. | 0 | n/a | n/a | n/a |",
    );
  }
  lines.push("");
  lines.push(
    "Heuristics: see `engine/cli/runs-harvest.ts` for severity classification and dedupe slug formula.",
  );
  lines.push("");
  await fs.writeFile(indexPath, lines.join("\n"), "utf8");
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normaliseMessage(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function excerptForEvent(event: PipelineEvent): string {
  if ("message" in event && typeof event.message === "string") {
    return truncate(event.message, 160);
  }
  return event.type;
}

async function safeReadFile(path: string): Promise<string | undefined> {
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return undefined;
  }
}
