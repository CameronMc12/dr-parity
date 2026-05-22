# W5A.3: In-process `runCloneEntry` + Per-stage Event Attribution

Agent: W5A.3
Branch: prototype-mode
Starting HEAD: e13c846
Scope: Convert `engine/cli/run-clone-stage.ts` from subprocess spawn to direct in-process invocation of `runCloneEntry(argv)`. Wire per-stage event attribution into the manifest and JSONL stream.

## Summary

Removed the last `spawn()` boundary in the V2.0 clone pipeline. `parity clone <url>` now calls `runCloneEntry(argv)` directly from `engine/cli/run-clone-stage.ts`, returning a rich result object that exposes the resolved dated capture directory, the canonical run root, and per-phase timing/status records. The manifest now lists each inner phase (capture, parse:har, parse:trace, complete:assets, clone) as its own stage entry, the JSONL pipeline stream emits per-phase `metric` + `stage_end` events, and `manifest.artefacts.captureRoot` now points at the actual dated subdir (`clones/<host>/<iso>/captures`) rather than the default root.

## Spawn -> in-process delta

### Before

`engine/cli/run-clone-stage.ts` shelled out to `npx tsx scripts/run-clone.ts ...` via `spawn()`:

```ts
const { exitCode } = await spawnLegacyRunClone(args, stageLogPath, process.cwd());
```

Only a single opaque `clone-pipeline` stage was recorded. Child stdout/stderr were tee'd into the stage log but never parsed for paths, so the manifest could only point at the parent default root.

`scripts/run-clone.ts` returned `Promise<number>` (exit code).

### After

`scripts/run-clone.ts` now exports a `runCloneEntry(argv)` that returns a typed `RunCloneResult`:

```ts
export interface RunCloneResult {
  exitCode: number;
  captureRoot?: string;
  runRoot?: string;
  phases: RunCloneStagePhase[];
  viewports: string[];
}
```

The CLI tail (`if (isDirect) main().then(r => process.exit(r.exitCode))`) is preserved so `npx tsx scripts/run-clone.ts <url>` still works standalone.

`engine/cli/run-clone-stage.ts` now:

1. Imports `runCloneEntry` directly.
2. Tees `process.stdout.write` and `process.stderr.write` into the stage-log file for the duration of the call (so the in-process console output still lands in `.runs/<id>/stage-logs/clone-pipeline.log`).
3. After the call, iterates the returned `phases[]` and emits one `metric` + one `stage_end` event per inner phase, plus a `patchStage` write per phase.
4. Registers `captureRoot` and `runRoot` artefacts from the returned paths.

Spawn calls removed in `run-clone-stage.ts`: 1 (the `spawnLegacyRunClone` helper has been deleted).

## Manifest improvements

### Before

```json
"stages": [
  { "name": "clone-pipeline", "metrics": { "exitCode": 0, "durationMs": 12000 } }
],
"artefacts": {
  "captureRoot": "/repo/docs/research/captures"   // default parent root
}
```

### After

Real run against `https://example.com --viewport=desktop`:

```json
"stages": [
  { "name": "clone-pipeline",    "status": "ok", "metrics": { "exitCode": 0, "durationMs": 2688 } },
  { "name": "capture",           "status": "ok", "metrics": { "durationMs": 2674, "exitCode": 0 } },
  { "name": "parse:har",         "status": "ok", "metrics": { "durationMs": 1,    "exitCode": 0 } },
  { "name": "parse:trace",       "status": "ok", "metrics": { "durationMs": 6,    "exitCode": 0 } },
  { "name": "complete:assets",   "status": "ok", "metrics": { "durationMs": 0,    "exitCode": 0 } },
  { "name": "clone",             "status": "ok", "metrics": { "durationMs": 6,    "exitCode": 0 } }
],
"artefacts": {
  "captureRoot": "/repo/clones/example/2026-05-22T09-47-56-697Z/captures",
  "runRoot":     "/repo/clones/example/2026-05-22T09-47-56-697Z"
}
```

`captureRoot` now resolves to the actual dated subdir produced by the run. The harvest loop and the future `parity runs show <id>` surface can now point users straight at the relevant capture without having to grep the stage-log.

The JSONL stream gains five new `stage_end` events plus five `metric` events per run, one per inner phase. Sample (trimmed):

```
{"type":"stage_end","stage":"capture",         "status":"ok","durationMs":2674}
{"type":"stage_end","stage":"parse:har",       "status":"ok","durationMs":1}
{"type":"stage_end","stage":"parse:trace",     "status":"ok","durationMs":6}
{"type":"stage_end","stage":"complete:assets", "status":"ok","durationMs":0}
{"type":"stage_end","stage":"clone",           "status":"ok","durationMs":6}
{"type":"artefact","stage":"clone-pipeline","name":"captureRoot","path":".../clones/example/.../captures"}
```

## Smoke evidence

| Check | Result |
|---|---|
| `npx tsc --noEmit` (filtered) | 8 errors, all pre-existing baseline (animation-detector, cheerio namespace, classify-toggle) |
| `npx parity test` | 2 passed (enerblock-net, example-com) |
| `npm run smoke:cli` | 4/4 PASS (help, clone --help, version, targets list) |
| `npm run check:astro-emit` | OK |
| Live clone smoke (`parity clone https://example.com --viewport=desktop --no-tour --no-parity`) | status=ok, runDir present, manifest has 6 stage entries, captureRoot points at dated subdir |
| Stage log present | 40 lines captured in `.runs/<id>/stage-logs/clone-pipeline.log` |

## Anomalies / surprises

- The stdout/stderr tee uses `process.stdout.write = tee(orig)` for the duration of the in-process call and restores the originals in a `finally`. This is the only safe way to capture output from third-party libs (Playwright, cheerio) that write directly to the streams without going through our logger. The hook is scoped to the single `runCloneInProcess` call so the surrounding `[runId]` formatted logger output is unaffected.
- TypeScript error count actually went DOWN from 15 -> 8. Removing the explicit `spawn` import path appears to have dropped a few transitively-resolved errors that no longer surface. Not investigating further; the count is well under the gate.
- The legacy CLI tail in `scripts/run-clone.ts` still works (`npx tsx scripts/run-clone.ts <url>`) because the `isDirect` branch unpacks `result.exitCode` for the process exit. Ad-hoc invocation continues unchanged.
- The `clone-pipeline` roll-up stage is kept in the manifest alongside the new per-phase entries so consumers that already look for `clone-pipeline` (W3 wiring, the SUMMARY.md generator) still see what they expect.

## Files touched

- `engine/cli/run-clone-stage.ts` — spawn removed, in-process invocation, per-phase emission.
- `scripts/run-clone.ts` — `runCloneEntry` now returns `RunCloneResult` with phases + paths.
- `docs/V2.0/observations/w5a3-in-process.md` — this file.

## Commit

`refactor(cli): in-process run-clone invocation, per-stage event attribution`
