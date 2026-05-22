# W6 — Parity-Clone Framework Emit + Parity Check Wiring

> Status: in progress. Design committed before code. Results appended after
> the apple.com runs land.

## 1. Root cause analysis

### What is broken

`parity clone <url> <target>` did NOT actually invoke the framework emit.
The CLI accepted the `<target>` positional, recorded it on
`manifest.json.args.target`, then handed control to `runCloneEntry` in
`scripts/run-clone.ts`. That entry only ran the static-clone pipeline
(`capture -> parse:har -> parse:trace -> complete:assets -> clone`). It
never called `astroAdapter.build` / `reactAdapter.build` / `webappAdapter.build`,
and it never ran a parity check.

Result: `parity clone https://apple.com astro` and
`parity clone https://apple.com react` produced byte-identical static
HTML clones. No `sites/astro/`, no `sites/react/`, no parity score in
`SUMMARY.md`.

### Where the gap lives

| File | Function | Behaviour |
|------|----------|-----------|
| `bin/parity.ts` (clone subcommand) | passes `targetArg` to `runParityClone` | OK, target is plumbed |
| `engine/cli/run-clone-stage.ts` | `runParityClone` | Calls `runCloneInProcess(argv, ...)` then finalises. NO emit. NO parity. |
| `scripts/run-clone.ts` | `main` / `runCloneEntry` | Runs only the static-clone phases. Target unaware. |

### Reference implementation that DOES emit

`scripts/clone-urls.ts` (multi-page driver) imports `astroAdapter` /
`reactAdapter` / `webappAdapter` directly and calls `adapter.build({...})`
or `adapter.buildMulti({...})` after the per-URL clone phase. The
post-emit pipeline then runs.

`engine/cli/regression/rebuild-pixel-diff.ts` is the cleaner template
for single-page emit + verify: it builds via the adapter into a tmp
project, runs `npm install + npm run build`, boots two `serve` instances
on the clone dir and the rebuilt `dist/`, screenshots via Playwright,
and pixel-diffs via `engine/verify/diff.diffShot`.

The single-URL `parity clone` path needs the same shape, but emits into
the canonical `<runRoot>/sites/<target>/` rather than a throwaway tmp.

## 2. Stage design

Two new stages slot into `runParityClone`, after the existing
`clone-pipeline` rollup and before `finaliseManifest`:

### Stage: `emit-target`

| | |
|---|---|
| Trigger | Only when `input.target` is one of `astro`, `react`, `webapp` |
| Skip case | `target` undefined or `html-mirror` (placeholder; no adapter) |
| Input | `clonePath = <captureRoot>/<viewport>/clone` (prefers `desktop`, falls back to first viewport with a clone) |
| Output | `<runRoot>/sites/<target>/` via canonical `siteDir(...)` |
| Adapter | Loaded via dynamic import to mirror `scripts/build.ts:loadAdapter` (keeps webapp import optional even though it's now always present in the repo) |
| Build call | `adapter.build({ cloneDir, outDir, name: host, force: true })` |
| Manifest record | New stage `emit-target` with `startedAt`, `endedAt`, `status`, `metrics: { durationMs, componentsEmitted, pagesEmitted, assetCount, assetBytes }` |
| Artefact | Registered as `sitesDir` -> absolute path to `<runRoot>/sites/<target>` |
| Failure mode | Status = `fail`, run rolls up to `fail`. Parity stage skipped. |

The single-URL path uses `adapter.build` (single-page contract), not
`buildMulti`. `clone-urls.ts` already uses single-page `build` for the
webapp branch and `buildMulti` for astro/react across multiple pages —
parity clone only ever has one URL, so single-page is correct.

### Stage: `parity-check`

| | |
|---|---|
| Trigger | Only after `emit-target` succeeded and `input.parity !== false` |
| Input | `<runRoot>/sites/<target>` (project dir) and the original `<captureRoot>/<viewport>/clone` (clone dir) |
| Builder | Run `npm install --silent` and `npm run build` in the emitted project to produce `dist/index.html` (mirrors `rebuild-pixel-diff`) |
| Comparison | `engine/verify/diff.diffShot` at the canonical `desktop` viewport, with the threshold resolved from `--parity-threshold` flag or per-target default (`astro=0.02`, `react=0.20`, `webapp=0.20`) |
| Score | `score = 1 - diffRatio` (match ratio, matching `rebuild-pixel-diff`'s convention) |
| Manifest record | New stage `parity-check` with metrics, plus a `manifest.parity` field `{ score, threshold: 1 - diffThresholdRatio, mode: "pixel-diff" }` |
| Verdict | `pass` if `score >= 1 - thresholdRatio`. Otherwise `partial` (the emit worked; the visual just regressed). Run status promoted to `partial`. |
| Artefact | `parityReport` -> absolute path to a JSON report under `<runRoot>/reports/parity/<target>.json` |

### Order of stages in the new manifest

```
1. capture          (existing)
2. parse:har        (existing)
3. parse:trace      (existing)
4. complete:assets  (existing)
5. clone            (existing)
6. clone-pipeline   (rollup, existing)
7. emit-target      (NEW)
8. parity-check     (NEW)
```

### File touch list (intent)

- `engine/cli/run-clone-stage.ts`  add two new helper functions
  `runEmitTargetStage` and `runParityCheckStage`. Wire them after the
  existing rollup. Pass through the `parityThreshold` flag.
- `bin/parity.ts`  pass `parityThreshold` and `parity` flags through to
  `runParityClone`.
- (No edits to `scripts/run-clone.ts`, `scripts/build.ts`, or
  `scripts/clone-urls.ts`.)

### Why this is safe for the multi-page path

`scripts/clone-urls.ts` does not call `runParityClone`. It runs its
own pipeline directly. The new stages live inside `runParityClone` only,
so the multi-page driver is untouched. `parity test` exercises
`compareRebuildPixelDiff` directly via `rebuild-pixel-diff.ts`, also
untouched. Both remain regression-stable.

## 3. Threshold resolution

Convention adopted (matches `scripts/verify-parity.ts` and the rebuild
fixture):

- The CLI's `--parity-threshold` is a **diff ratio** (e.g. `0.02` =
  max 2 percent pixel diff allowed). It is stored on the manifest as
  the score's lower bound via `threshold = 1 - diffThresholdRatio`.
- The score is `1 - diffRatio`, so a 99.5 percent visual match against
  the astro default (`0.02`) reads as `score=0.995`, `threshold=0.98`,
  verdict `pass`.

When `--parity-threshold` is not supplied, the per-target default
applies: astro `0.02`, react `0.20`, webapp `0.20`.

## 4. Multi-page regression check

Proof that `scripts/clone-urls.ts` continues to invoke
`adapter.build` / `adapter.buildMulti` directly and is not affected by
our changes:

```
$ grep -n "adapter.build\|buildMulti" scripts/clone-urls.ts
509:    const buildSummary = await adapter.build({
571:  const summary = (await adapter.buildMulti!({
```

Both call sites live in `main` inside `clone-urls.ts` and consume
imported adapters at the module top. They do not import anything from
`engine/cli/run-clone-stage.ts`, so changes there cannot reach them.

`npx parity test` runs `compareRebuildPixelDiff`, which imports
`astroAdapter` / `reactAdapter` directly. Also untouched.

## 5. Apple.com test results

Both runs invoked the new `emit-target` stage, produced a real framework
project under `<runRoot>/sites/<target>/`, and ran the new `parity-check`
stage. The static-clone pipeline phases (`capture`, `parse:har`,
`parse:trace`, `complete:assets`, `clone`) remain identical to the
pre-W6 behaviour.

| Target | Run ID | emit-target | parity-check | Score | Threshold | Project path |
|--------|--------|-------------|--------------|-------|-----------|--------------|
| astro  | `2026-05-22T11-23-38-751Z-5d8d` | OK (8 components, 1 page, 133 assets, 5.8 MB) | OK | 100.00% | 98.00% | `clones/www-apple/2026-05-22T11-23-38-769Z/sites/astro/` |
| react  | `2026-05-22T11-23-46-085Z-4c7f` | OK (6 components, 1 page, 133 assets, 5.8 MB) | FAIL (build error) | n/a | 80.00% | `clones/www-apple/2026-05-22T11-23-46-107Z/sites/react/` |

Astro: clean pass at 100% (rebuilt dist matches the captured clone
byte for byte on the desktop viewport). SUMMARY.md now reports the
parity outcome correctly.

React: the framework emit succeeded and the project shows up at
`sites/react/` with `App.tsx`, `main.tsx`, components, and styles.
The build failed during `tsc -b` because the emitted JSX includes a
non standard attribute from apple.com's HTML (`x-ms-format-detection`
on a `<div>`, which React's typed props do not allow). This is a pre
existing limitation of the react adapter on this corpus, not a W6
regression. The W6 stage wiring works as designed: parity-check
recorded `FAIL` with diagnostic `npm run build exited 1`. When the
react adapter ships its build pass for apple.com style inputs (likely
via a small JSX attribute whitelist or `// @ts-nocheck` injection in
emitted components) this run will surface a real parity score under
the 0.20 threshold.

### Stage rollup in the manifest

Astro manifest stages (in order): `clone-pipeline`, `capture`,
`parse:har`, `parse:trace`, `complete:assets`, `clone`, `emit-target`,
`parity-check`. Artefacts: `captureRoot`, `runRoot`, `sitesDir`,
`parityReport`. `parity` field: `{ score: 1, threshold: 0.98, mode:
"pixel-diff" }`.

React manifest stages identical through `clone`, then
`emit-target=ok`, `parity-check=fail`. Artefacts: `captureRoot`,
`runRoot`, `sitesDir`. No `parityReport` (the diff never ran because
the build failed first). No `parity` field (no score produced).

### Regression verification post change

- `npx tsc --noEmit | grep "error TS" | grep -v "^clones/" | grep -v "^docs/research/" | wc -l`  0
- `npx parity test`  4/4 passing (enerblock-net, example-com, example-com-mobile, example-com-rebuild-pixel)

## 6. Anomalies / Surprises

1. **React build TS error on apple.com.** Apple's HTML carries the
   IE specific `x-ms-format-detection` attribute on a `<div>`. The
   react adapter passes it through to JSX, where the strict TS lib
   rejects it. The build dies at `tsc -b`. This is real signal that
   the react adapter needs a JSX attribute pass or a less strict
   `tsconfig` for emitted projects, but it is outside W6 scope.

2. **prettify roundtrip drift on astro.** Two components
   (`Section01_Iphone.astro`, `Section03_EndlessEntertainment.astro`)
   triggered a "roundtrip drift detected, using original" warning
   during emit. Cosmetic; the components are emitted from the original
   HTML and still load correctly. Did not affect the parity score
   (still 100%).

3. **Apple.com font 404s.** apple.com's HAR points at
   `https://www.apple.com/wss/fonts/...` URLs that return 404 to a
   headless Chromium request. These accumulate as `complete:assets`
   warnings. Pre-existing, not introduced by W6.

## 7. Commits

- `feat(cli): wire framework emit and parity check into parity clone`
  (0c2ec19)
- `docs: observation log for parity-clone framework wiring fix`
  (this file)

## 8. Files touched

- `bin/parity.ts`  read `parity` and `parity-threshold` flags into
  `runParityClone` input
- `engine/cli/run-clone-stage.ts`  add emit and parity stage block
  after the existing clone-pipeline rollup; surface parity score on
  `manifest.parity`
- `engine/cli/emit-and-verify.ts` (new)  encapsulates the adapter
  build, npm install + build, server boot, screenshot, and pixel
  diff. Mirrors the rebuild-pixel-diff fixture path but writes into
  `<runRoot>/sites/<target>` and `<runRoot>/reports/parity/<target>/`.
- `docs/V2.0/observations/w6-parity-clone-framework-emit.md` (this
  file)

No edits to `scripts/run-clone.ts`, `scripts/build.ts`,
`scripts/clone-urls.ts`, or any target adapter.
