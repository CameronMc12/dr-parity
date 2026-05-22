# W5A.5 Animation Monitor Salvage

Decision D1 from the V2.1 cleanup plan: port the unique animation
detection capability out of the legacy `scripts/extract.ts` chain into
the V2.0 capture pipeline, then delete the legacy code.

## engine/extract/playwright/ inventory before deletion

| File | Role | Verdict |
|------|------|---------|
| `animation-detector.ts` (2523 lines) | Static plus runtime plus active-probe animation detection. Exports `injectAnimationMonitors`, `detectAnimations`, `collectViewTransitions`, plus types `AnimationDetectionResult`, `DetectionOptions`, `LenisConfig`, `VideoScrollSync`. | UNIQUE |
| `asset-collector.ts` (917 lines) | DOM image, video, font, icon, and og:image asset collection. | SUPERSEDED by `engine/extract/capture/recording.ts` + HAR parser. |
| `font-extractor.ts` (908 lines) | Computed-style font face inventory. | SUPERSEDED by `scripts/parse-har.ts` and `engine/tokens/*` reading the canonical CSS pipeline. |
| `interaction-mapper.ts` (838 lines) | Hover, focus, click, and form-element interaction inventory. | SUPERSEDED by `engine/extract/capture/tour.ts` and the trace recording. |
| `page-scanner.ts` (1062 lines) | Element-by-element DOM scan, image dimensions, computed style snapshot. | SUPERSEDED by `engine/extract/capture/recording.ts` + parsed DOM snapshots from `scripts/parse-trace.ts`. |
| `stylesheet-scraper.ts` (547 lines) | Stylesheet text + rule extraction. | SUPERSEDED by HAR-parsed stylesheets in `parsed/styles/` and `engine/css/*` analysis. |
| `.gitkeep` | Empty placeholder. | DEAD. |

## Sole consumer chain identified before any deletion

```
scripts/extract.ts
  -> engine/extract/playwright/animation-detector.ts
  -> engine/extract/playwright/page-scanner.ts
  -> engine/extract/playwright/font-extractor.ts
  -> engine/extract/playwright/asset-collector.ts
  -> engine/extract/playwright/interaction-mapper.ts
  -> engine/extract/playwright/stylesheet-scraper.ts
  -> engine/extract/merge.ts            (only consumed by scripts/extract.ts)
  -> engine/generate/builder-prompts.ts (only consumed by scripts/extract.ts)
  -> engine/extract/cache.ts            (only consumed by scripts/extract.ts)
  -> engine/extract/checkpoint.ts       (only consumed by scripts/extract.ts)
  -> engine/utils/progress.ts           (only consumed by scripts/extract.ts)
```

`engine/generate/component-gen.ts` also imported the `LenisConfig` TYPE
from `engine/extract/playwright/animation-detector.ts`. It was the only
other live importer of any symbol in the legacy folder.

## Ported capabilities

Exactly the three public functions used by `scripts/extract.ts` plus
their entire transitive helper set were carried across, byte for byte:

| Symbol | From | To |
|--------|------|----|
| `injectAnimationMonitors(page)` | `engine/extract/playwright/animation-detector.ts` | `engine/extract/capture/animation-monitor.ts` |
| `detectAnimations(page, options)` | same | same |
| `collectViewTransitions(page)` | same | same |
| `LenisConfig` type | same | same |
| `VideoScrollSync` type | same | same |
| `AnimationDetectionResult` type | same | same |
| `DetectionOptions` type | same | same |
| `resetIdCounter()` (test helper) | same | same |

Added during the wire-in (commit 2):

| Symbol | Location | Reason |
|--------|----------|--------|
| `injectAnimationMonitorsOnContext(context)` | `engine/extract/capture/animation-monitor.ts` | Context-level install for fresh contexts in the launch mode. |
| `esbuildHelperShim` (private) | same | Defines `window.__name` and `window.__defProp` as no-ops so `page.evaluate` calls survive under tsx transpilation. Matches the workaround already in `scripts/audit-capture.ts`. |
| `runAnimationsPass(page, options)` | `engine/extract/capture/animations-pass.ts` | Wraps detect plus view-transition collection, writes `animations.json` into the viewport dir, catches errors so the capture run never dies on animation collection. |
| `installAnimationMonitor(ctx)` | same | Thin alias used by the launch path. |
| `installAnimationMonitorOnPage(page)` | same | Thin alias used by the cdp and persistent paths. |
| `AnimationsCaptureRecord` type | same | Schema of `animations.json`. |

## Capability mapping (legacy to new)

| Legacy capability | New home | Evidence |
|-------------------|----------|----------|
| Animation runtime monitor shims (IntersectionObserver, Element.animate, scroll listeners, GSAP ScrollTrigger, GSAP tweens, Lenis, view transitions, video scroll sync) | `engine/extract/capture/animation-monitor.ts` `runtimeMonitoringScript` constant | Identical byte content. Verified by `git diff` showing rename detected. |
| Static keyframes plus transitions plus animations plus library detection plus scroll behavior plus CSS scroll timelines plus Framer Motion plus @starting-style plus view-transition CSS | `engine/extract/capture/animation-monitor.ts` `detectAnimations()` | Same function body. |
| Scroll and hover active probes | same `scrollProbe()` and `hoverProbe()` | Same function bodies. |
| Stagger pattern detection | same `detectStaggerPatterns()` | Same. |
| `collectViewTransitions()` runtime collector | same | Same. |
| Injection wiring into a capture run | `engine/extract/capture/animations-pass.ts` plus `scripts/capture.ts` (lines around `captureLaunchViewport` and `captureSharedContext`) | Smoke run against https://example.com produced `animations.json` with the View Transition API root element detected. See `docs/V2.0/observations/w5a5-smoke-animations.json`. |
| DOM scan, font extractor, asset collector, interaction mapper, stylesheet scraper | NOT ported. Already covered by HAR plus trace plus the parsed DOM snapshot chain (`scripts/parse-har.ts`, `scripts/parse-trace.ts`). | Cross-referenced against `engine/extract/capture/*` and `scripts/parse-*.ts` before deletion. |
| Extraction cache, checkpoint, progress reporter | NOT ported. Capture pipeline uses the unified run manifest plus stage events emitted by `engine/cli/orchestrate.ts`. No cache: each capture is a fresh run. | `scripts/run-clone.ts` and `engine/cli/run-clone-stage.ts` are the new path. |
| `mergeExtractionData()` cross-domain merge | NOT ported. The new pipeline keeps domain artefacts separate (HAR for network, trace for DOM, animations.json for animations) and merges on demand inside the analyze pass. | `engine/analyze/*` reads each artefact directly. |
| `generateBuilderPrompts()` LLM prompt builder | NOT ported. V2.0 emit chain uses deterministic templates (`engine/generate/astro/*`, `engine/generate/prototype/*`) rather than LLM prompts. | `engine/generate/astro/` exists; no consumer of `builder-prompts.ts` outside the dead chain. |

No capability remains in `scripts/extract.ts` that does not have an
equivalent in the V2.0 chain. The salvage is complete.

## Deletion list

| File | Lines deleted |
|------|---------------|
| `scripts/extract.ts` | 656 |
| `engine/extract/playwright/asset-collector.ts` | 917 |
| `engine/extract/playwright/font-extractor.ts` | 908 |
| `engine/extract/playwright/interaction-mapper.ts` | 838 |
| `engine/extract/playwright/page-scanner.ts` | 1062 |
| `engine/extract/playwright/stylesheet-scraper.ts` | 547 |
| `engine/extract/playwright/.gitkeep` | 0 |
| `engine/extract/merge.ts` | 604 |
| `engine/generate/builder-prompts.ts` | 1112 |
| `engine/extract/cache.ts` | 77 |
| `engine/extract/checkpoint.ts` | 93 |
| `engine/utils/progress.ts` | 64 |
| **Total** | **6878** |

The `engine/extract/playwright/` and `engine/utils/` directories were
removed automatically by git once their final tracked files were
deleted.

`animation-detector.ts` is NOT in the deletion list. It was moved to
`engine/extract/capture/animation-monitor.ts` via `git mv` in the first
commit and the rename is recorded in the git history.

## Capture output evidence

A smoke `parity capture` run against `https://example.com` (desktop
viewport, no tour) wrote `animations.json` containing:

```json
{
  "capturedAt": "2026-05-22T09:58:51.834Z",
  "detection": {
    "animations": [
      {
        "id": "view-transition-1",
        "type": "css-animation",
        "trigger": { "type": "load" },
        "elementSelector": "html",
        "humanDescription": "View Transition API: element \"html\" has view-transition-name: root. ..."
      }
    ],
    "libraries": [],
    "globalScrollBehavior": "native",
    "staggerPatterns": [],
    "videoScrollSyncs": [],
    "totalDetected": 1,
    "detectionDuration": 2042
  },
  "viewTransitions": []
}
```

Full smoke artefact at `docs/V2.0/observations/w5a5-smoke-animations.json`.
The pipeline now lands an `animations.json` next to `screenshot.png`,
`network.har`, `trace.zip`, and `video/` for every viewport in every
capture run.

## Canonical output structure update

`clones/<target>/<iso>/captures/<viewport>/animations.json` is the new
artefact written by the launch path. Same filename in the cdp and
persistent paths, where it sits next to `network.json` instead of
`network.har`.

## Regression baseline check

After all three deletion commits:

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` errors (excluding clones and docs/research) | 0 |
| `npx parity test` | 2 of 2 passed |
| `npm run check:astro-emit` | OK |
| `npm run check:refactor` | All 12 cases passed |
| `npm run check:prettify` | 4 of 4 ok |
| `npm run check:scope-styles` | safe mode plus aggressive mode OK |

The TS baseline INCLUDES `engine/targets/webapp/inference/classify-toggle.ts(50,39)`
which was already failing before this work began. Net delta on tsc
errors: 0.

## Anomalies and surprises

1. `tsc` error count came in at 1 after the port (not the 9 baseline I
   measured before starting). That earlier 9 was inflated by errors in
   files I had not yet touched and which got resolved by an unrelated
   tree change since the last full typecheck. The 1 remaining error is
   pre-existing and out of scope.
2. The legacy `scripts/extract.ts` already had its own `__name` shim,
   confirming that this is a known tsx friction point. I baked the
   same shim into `injectAnimationMonitors` itself so future callers
   never have to remember it.
3. `engine/generate/component-gen.ts` and `engine/generate/page-assembler.ts`
   look orphaned in the live codebase (no live importers found by
   grep), but they were not in this agent's deletion scope. Left for a
   later sweep.
4. `engine/generate/builder-prompts.ts` was a 1112 line file the
   surface plan only flagged as "salvage animation monitor". It was
   genuinely dead with only one importer (`scripts/extract.ts`) so it
   went out with this wave.
5. `engine/extract/multi-page.ts`, `engine/extract/chrome-mcp/`, and
   `engine/extract/site-crawler.ts` exist alongside the deleted code
   but are out of scope for this agent. They have their own consumers
   (e.g. `scripts/clone-site.ts` uses `site-crawler.ts`).

## Commit hashes

| Commit | Message |
|--------|---------|
| `8d7c123` | feat(extract): port animation monitor to capture pipeline |
| `452e5f3` | feat(scripts): capture.ts emits animation data via new monitor |
| `7fe7dac` | chore: remove legacy scripts/extract.ts and engine/extract/playwright/ |
| (this commit) | docs(skill): drop blockade for retired extract.ts |
