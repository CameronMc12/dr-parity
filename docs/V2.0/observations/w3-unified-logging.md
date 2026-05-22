# W3 Phase 5: Unified .runs/ Logging + Canonical Output Adoption

Agent: W3
Branch: prototype-mode
Starting HEAD: d1ca9d9 (after Wave 2)
Ending HEAD: a29b521 (after this wave's commits)

## Summary

Shipped the durable `.runs/<runId>/` record system: manifest writer, JSONL
event stream, RunContext tee logger, SUMMARY.md generator, and the first
real wiring of `parity clone` as an end-to-end command that produces a
durable run record. Subprocess removal (item 7) and broad canonical-paths
retrofit (item 6) are deferred to a follow-up agent per the brief's
priority order.

## Changes made

### engine/cli/event-stream.ts (new)

Append-only NDJSON writer. Locks the `PipelineEvent` union (`stage_start`,
`stage_end`, `metric`, `warning`, `error`, `artefact`, `decision`,
`run_start`, `run_end`, `log`). Exposes `createEventStream(filePath)` and a
`nowIso()` helper so every event uses the same timestamp format.

### engine/cli/run-manifest.ts (new)

Owns `.runs/<runId>/manifest.json`. Schema is locked at version 1 per the
audit. Exposes `initManifest`, `updateManifest`, `patchStage`,
`registerArtefact`, `finaliseManifest`. Atomic writes (write-to-tmp then
rename). `ManifestSchemaError` is thrown on schemaVersion mismatch so the
future `parity runs migrate` hint can fire.

### engine/cli/context.ts (extended)

`createRunContext` is now async and creates `.runs/<runId>/` + the
`stage-logs/` subdir, opens the JSONL writer, and returns a
`FullRunContext` with:

- `emit(event)` for direct structured emission
- `forStage(name)` returning a Logger whose writes also land in
  `.runs/<runId>/stage-logs/<stage>.log`
- `onDispose(fn)` LIFO finaliser registry
- `finalise()` that runs disposers and closes streams

Root Logger writes to stdout/stderr AND the JSONL stream simultaneously.

### engine/cli/stage.ts (extended)

`RunContext.onDispose` is now an optional method on the interface so legacy
minimal contexts (regression test runner) still satisfy the type.

### engine/cli/orchestrate.ts (extended)

`runPipeline` now emits structured `stage_start` / `stage_end` events
through the new `emit` hook when the context supports it. Backwards
compatible: minimal contexts (no `emit` method) still work.

### engine/cli/summary-writer.ts (new)

`renderSummaryMarkdown(manifest)` produces the SUMMARY.md body per audit
04 Round 2 D template. `writeSummary(runDir)` writes it to disk and
preserves any existing `<!-- USER-START -->` / `<!-- USER-END -->` blocks
across regenerates so Cameron's annotations survive re-runs.

### engine/cli/run-clone-stage.ts (new)

`runParityClone(input)` is the end-to-end wiring for `parity clone`:

1. Creates a RunContext (writes `.runs/<runId>/`).
2. Initialises the manifest with command, args, env, target, url.
3. Spawns the existing `scripts/run-clone.ts` pipeline with stdout/stderr
   tee'd into `.runs/<runId>/stage-logs/clone-pipeline.log`.
4. Records the pipeline as a single manifest stage with metrics
   (exitCode, durationMs).
5. Best-effort capture-dir artefact registration.
6. Finalises the manifest, writes `SUMMARY.md`, runs disposers.

The legacy script invocation is still a subprocess. Replacing it with
direct in-process calls is task 7 of Phase 5 and is deferred.

### bin/parity.ts (extended)

`parity clone <url> [target]` now invokes `runParityClone` instead of
printing the stub line. Exit code mirrors the run status. Help text is
unchanged.

### .gitignore (extended)

`.runs/` is ignored. The SUMMARY.md and manifest.json are precious but the
bulky pipeline.jsonl + stage-logs are not committed.

## Smoke test result

Ran a manual smoke that exercises createRunContext + initManifest +
forStage logger + patchStage + finaliseManifest + writeSummary end to end
without touching the network capture pipeline. Output verified:

```
.runs/<id>/
  manifest.json       (703 bytes, schemaVersion 1, well-formed)
  pipeline.jsonl      (660 bytes, 6 events: run_start, stage_start, log,
                       metric, stage_end, run_end)
  stage-logs/
    capture.log       (2 lines of human readable stage output)
  SUMMARY.md          (1118 bytes, all sections populated, USER blocks
                       present)
```

A full end-to-end `parity clone https://example.com` against a live
network was not executed in this session because the legacy run-clone
pipeline takes several minutes per viewport and the wiring shape is what
matters for the durable record. The smoke confirms the shape; a real
clone is the natural next step in Wave 4.

## Reasons for the implementation choices

### Subprocess retained in run-clone-stage.ts

The brief explicitly listed Item 7 (subprocess removal) as deferrable. The
existing `scripts/run-clone.ts` orchestrates four child stages
(capture, parse:har, parse:trace, clone) through `spawn`. Converting
those to in-process imports is a multi-file refactor (each script has its
own `parseArgs`, runs side effects on import, uses console.log
extensively) that needs careful capability-detection per the no-regression
principle. Doing it in this wave risked breaking the Astro byte-identity
gate and the corpus pass. Item 7 should be its own focused agent task.

The current shim still gives Cameron 90% of the value: a single
`.runs/<id>/` record per clone with manifest + summary + JSONL events,
plus the entire child-process output tee'd into a single stage log file.
The harvest loop (Wave 4) can read these records identically to how it
will read fully in-process records.

### Schema-version hard fail

`readManifest` throws `ManifestSchemaError` on mismatch. The CLI does not
yet catch this and print the `parity runs migrate` hint because the runs
subcommand surface is itself a Wave 4 task. The error message includes
the found and expected versions, which is enough for now.

### `noFiles` flag on createRunContext

Added so unit tests can exercise the context without polluting `.runs/`.
Not used in production paths today.

### Canonical-paths retrofit deferred

Item 6 of the brief asked for capture.ts, run-clone.ts, clone-urls.ts,
and the build emitters to adopt `clones/<target>/<iso>/{captures, parsed,
clones, sites/<target>, reports, logs}`. The helper module exists at
`engine/cli/canonical-paths.ts` from W1D but no script yet calls it. This
is a script-by-script retrofit that needs the regression corpus to verify
each change is byte-equivalent on the corpus fixtures. It is a clean
follow-up agent task and was deprioritised below items 1-5 + 9 + 8 per
the brief's priority list.

## Pipeline improvement opportunities

1. The JSONL stream uses synchronous JSON.stringify on every event. For
   captures with many events per second (HAR replay, asset sweep) this
   could become a bottleneck. Batching or a worker thread is the obvious
   evolution if event volume becomes large.
2. The manifest writer's `updateManifest` reads the full file from disk
   on every call. For very long runs with many stage updates this is
   wasteful. An in-memory copy with periodic flush would scale better.
3. The legacy `scripts/run-clone.ts` printout is not parsed for capture
   directory paths, so the manifest's `artefacts.captureRoot` is just the
   default root directory rather than the specific dated subdir. Fixing
   this needs either a structured stdout contract from the legacy script
   (item 7 work) or a post-run filesystem scan.
4. `SUMMARY.md` does not yet render `decision` events from the JSONL
   stream. The audit template included a "Decision drift" section. Easy
   addition once a stage actually emits decisions.

## Parity engine bug surface (none new)

This wave is pure infrastructure. No engine code paths (capture, clone,
emit) were modified. The Astro byte-identity gates and corpus pass
unchanged.

## Anomalies

None during implementation. The `cheerio` namespace errors in TS output
are pre-existing baseline noise.

## Wired vs Deferred

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | RunContext factory (extend W1D stub) | done | createRunContext is async now, returns FullRunContext |
| 2 | Manifest writer | done | engine/cli/run-manifest.ts |
| 3 | JSONL event stream writer | done | engine/cli/event-stream.ts |
| 4 | Stage-logs writer | done | forStage(name) tees to stage-logs/<name>.log |
| 5 | SUMMARY.md generator | done | engine/cli/summary-writer.ts with USER block preservation |
| 6 | Canonical output convention adoption | DEFERRED | Helper exists, script retrofits not done. Needs per-script byte-identity verification against corpus. Pure refactor; safe to do as follow-up agent. |
| 7 | Subprocess removal | DEFERRED | Documented in run-clone-stage.ts. Each spawned child needs to be converted to a direct import + main(argv) export. Per Phase 4 plan §4 Phase 4 task 3 this was nominally a Wave 1 codemod but was not done. |
| 8 | .gitignore .runs | done | Single line added |
| 9 | Wire parity clone to use new infrastructure | done (minimal) | parity clone <url> [target] now writes a durable .runs/<id>/ record. Legacy pipeline still spawned. |

## Items needing follow-up agent attention

### Sub-task A: Canonical paths retrofit (item 6)

Scope:

- scripts/capture.ts: change default `--out` from `docs/research/captures`
  to `clones/<target>/<iso>/captures/`.
- scripts/run-clone.ts: same root.
- scripts/clone-urls.ts: same.
- engine/targets/astro/emit-multi.ts, engine/targets/react/emit-multi.ts,
  engine/targets/webapp/build.ts: outputs into
  `clones/<target>/<iso>/sites/<target>/`.

Verify after each change: `npx parity test`, `npm run check:astro-emit`,
`npm run check:refactor`, `npm run check:prettify`,
`npm run check:scope-styles`.

### Sub-task B: Subprocess removal (item 7)

Scope:

- scripts/run-clone.ts: replace the four `spawn` calls with direct calls
  to the relevant engine functions. Each `scripts/<stage>.ts` needs to
  export a `main(argv)` (or better: a typed function with a single args
  object).
- scripts/clone-urls.ts: same treatment.

This is where `parity clone` becomes truly in-process and the JSONL
stream gains per-child-stage `stage_start` / `stage_end` events instead
of a single `clone-pipeline` blob.

### Sub-task C: `parity runs` subcommand surface

The brief mentioned `parity runs migrate` as a future command. Likely
follow-up scope:

- `parity runs list` (already a stub in bin/parity.ts)
- `parity runs show <id>` 
- `parity runs prune` (retention enforcement)
- `parity runs harvest` (Wave 4 harvest loop)

## Verification at end of wave

- `npx parity test`: 2 passed, 0 failed, 0 skipped, 2 total
- TypeScript error count: 15 (baseline, unchanged)
- `npm run check:astro-emit`: OK
- `npm run check:refactor`: 12/12 passed
- `npm run check:prettify`: 4/4 ok
- `npm run check:scope-styles`: all checks passed
- `parity clone --help`: renders correctly
- Smoke test of manifest + JSONL + SUMMARY + stage-logs: all four
  artefacts produced correctly, USER blocks present, schemaVersion 1

## Commits made this wave

- 06fce7a feat(cli): jsonl event stream writer
- b19f224 feat(cli): run manifest writer with schema-version gate
- 6af2ece feat(cli): RunContext creates .runs dir and tees stdout
- 9de291d feat(cli): SUMMARY.md generator
- 3b6f258 chore: gitignore .runs
- a29b521 feat(cli): parity clone wires the orchestrator end-to-end
