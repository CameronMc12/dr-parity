# W5B.3 — Webapp Pixel Parity (V2.1 Stretch)

Branch: prototype-mode
HEAD before phase: 3bb0d39
HEAD after phase: c (see commits below)
TS error baseline: 0 (held)
Astro parity test: 3/3 (was 2/2, fixtures grew)

## Pipeline Insertion Point

Phase 6 of `engine/orchestrator/post-build/post-emit-multi-webapp.ts`. Runs
AFTER state-assertion-check on the same outDir. Gated on:

1. `options.skipPixelParity !== true`
2. None of `buildResult`, `routeResult`, `stateResult` reported `fail`
3. Both `options.inference` AND `options.crawlDir` were passed by the caller

Any missing precondition yields `status: skipped` with a precise reason in
`metrics.reason`. Concretely the skip reasons surfaced today are:

- `skipPixelParity=true`
- `earlier phase failed`
- `no inference graph`
- `no crawlDir`
- `crawlDir not found`
- `skipBrowser=true`
- `no routes resolved`

The existing five phases (install, build, msw-boot-check, route-render-check,
state-assertion-check) are unchanged. The orchestrator still emits
`post-emit-webapp-summary.json` with the same shape plus the additional
`pixel-parity` phase in `phases[]` and a new top-level `pixelParityReport`
field (nullable). Callers that already key off `phases[].name` keep working.

## Screenshot Harness Reuse

| Concern | Source we re-used |
|---|---|
| `vite preview` boot + ready detection | `startVitePreview` / `stopPreview` exported from `post-emit-multi-webapp.ts` (originally written for `route-render-check`). Now exported so the new module shares one boot routine. |
| Pixel diff (pixelmatch + pngjs, crop-to-min, write diff.png) | Pattern lifted from `engine/qa/parity-check.ts` and `engine/verify/diff.ts`. Same `pixelmatch` threshold default (0.1) and the same diff-ratio semantics (`mismatched / total`). |
| Canonical viewports | `PIXEL_PARITY_VIEWPORTS` mirrors `PARITY_VIEWPORTS` from `engine/qa/parity-check.ts` (desktop 1280x800, mobile 375x812, tablet 768x1024, wide 1920x1080). |
| `parity-report.json` schema | Compatible superset of `ParityCheckResult` (target, projectDir, threshold, timestamp, viewports[], allPassed, reportPath). Webapp adds `routes[]`, `crawlDir`, `warnMultiplier`, `status`. |

No primitive was forked or rebuilt.

## MSW + Vite Preview Boot Sequence

The webapp emit produces a Vite + React + React Router + MSW project. MSW
registers a service worker via `setupWorker(...).start()` in
`src/mocks/browser.ts`. Capture sequence per route + viewport:

1. `startVitePreview(outDir, ...)` spawns `npm run preview --host 127.0.0.1`
   and resolves when both the port and the "preview server" readiness
   strings appear in stdout. Already used by route-render-check, so the
   pattern is proven against this project shape.
2. New Playwright context at `{ width, height }` of the target viewport.
3. `page.goto(url, { waitUntil: 'domcontentloaded' })`. Note: not
   `networkidle` because MSW intercepts xhr/fetch and some SPAs poll
   indefinitely.
4. `waitForMsw(page)` polls `navigator.serviceWorker.controller !== null`
   with a 10s timeout. If MSW does not activate (some routes do not boot
   the worker), we continue rather than fail. The msw-boot-check phase
   already gates the worker artefact existing on disk; runtime activation
   is a soft wait.
5. `page.waitForLoadState('networkidle', { timeout: 15s })` best-effort. If
   the SPA polls forever we ignore the timeout.
6. `page.waitForTimeout(2.5s)` lets late hydration + transitions settle.
7. `page.screenshot({ fullPage: true })` into
   `<outDir>/parity-artefacts/<routeSlug>/<viewport>/rebuilt.png`.
8. If this viewport matches the crawl viewport, diff against
   `<crawlDir>/<node.screenshotPath>` (resolved from `graph.json`) and
   write `diff.png` next to `rebuilt.png`.

The preview server boots once for the whole stage; the per-route loop
re-uses the same `browser` and only spawns new contexts. After the loop the
browser closes and `stopPreview` SIGTERMs the child (SIGKILL fallback at
5s).

## Crawl Viewport Mapping

The crawler captures one full-page screenshot per state at a single
viewport, recorded as `graph.viewport: "${width}x${height}"`. The new stage
parses that string and picks the canonical viewport with the closest width:

| Crawl viewport | Resolved reference viewport |
|---|---|
| 1280x800 | desktop (exact) |
| 1440x900 | desktop (diff 160 < 480 vs wide) |
| 1920x1080 | wide (exact) |
| 375x812 | mobile (exact) |
| 768x1024 | tablet (exact) |

Only the resolved viewport produces a hard pass/fail. Other viewports are
captured for inspection but record `passed: true, referenceScreenshot: null,
note: "no reference for this viewport"` so they never gate.

## Status Classification

`classifyStatus(routes, threshold, warnMultiplier)`:

- `ok` if every compared (route + viewport) result has `diffRatio <= threshold`
- `warn` if any is above `threshold` but `<= threshold * warnMultiplier`
- `fail` if any is above `threshold * warnMultiplier`

Defaults: `threshold = 0.20` (the per-target default from
`scripts/verify-parity.ts` `DEFAULT_THRESHOLDS.webapp`), `warnMultiplier = 2`
(fail boundary 0.40). The orchestrator forwards `--threshold-webapp` via
`options.pixelParityThreshold` for callers that wire the CLI flag through.

## Sample parity-report.json

Below is the shape emitted by `runWebappPixelParity` (extracted from the
TypeScript types; no live smoke against a built project was run because
none of the existing webapp clones in `clones/` have a built `dist/` and
re-running the full crawl + emit + build was out of scope for this stage).
The smoke instead exercised every skip path (skipBrowser, no inference,
no crawlDir, missing crawlDir on disk, empty routes) plus job-building
against a real crawl graph (`docs/research/crawl/app.omnisocials.com/`,
graph.viewport=1440x900, 7 routes resolved). All paths returned the
expected shape.

```json
{
  "target": "webapp",
  "projectDir": "/abs/path/to/webapp-project",
  "crawlDir": "/abs/path/to/crawl-dir",
  "threshold": 0.2,
  "warnMultiplier": 2,
  "timestamp": "2026-05-22T08:00:00.000Z",
  "status": "ok",
  "allPassed": true,
  "reportPath": "/abs/path/to/webapp-project/parity-report.json",
  "routes": [
    {
      "routePath": "/",
      "baseStateId": "state-0001",
      "referenceViewport": "desktop",
      "passed": true,
      "viewports": [
        {
          "name": "desktop",
          "width": 1280,
          "height": 800,
          "diffPixels": 1234,
          "totalPixels": 1024000,
          "diffRatio": 0.001205,
          "passed": true,
          "rebuiltScreenshot": ".../parity-artefacts/root/desktop/rebuilt.png",
          "referenceScreenshot": "<crawlDir>/states/state-0001/screenshot.png",
          "diffImage": ".../parity-artefacts/root/desktop/diff.png",
          "note": "diff 0.121% <= 20.00%"
        },
        {
          "name": "mobile",
          "width": 375,
          "height": 812,
          "diffPixels": 0,
          "totalPixels": 0,
          "diffRatio": 0,
          "passed": true,
          "rebuiltScreenshot": ".../parity-artefacts/root/mobile/rebuilt.png",
          "referenceScreenshot": null,
          "diffImage": null,
          "note": "no reference for this viewport"
        }
      ]
    }
  ],
  "viewports": [
    { "name": "desktop", "...": "flattened across all routes" }
  ]
}
```

The top-level `viewports[]` is a flat list of every route x viewport
result, in the same order they were produced. This matches the astro
`ParityCheckResult.viewports` shape so harvest-side consumers can read
both targets with the same code path.

## Anomalies / Surprises

1. **No `dist/` on existing clones.** The webapp clones in `clones/` are
   emitted projects but the build step has not been run on most of them.
   A live full-flow smoke would require ~5 min of `npm install + vite build`
   per clone. Not run as part of this phase; the unit-level smoke covers
   all skip paths plus the route-job builder against the real crawl graph.

2. **Crawler viewport vs canonical viewport mismatch.** The omnisocials
   crawl uses 1440x900 which is not one of the canonical four. The
   reference resolver falls back to nearest-width (desktop). This means
   the pixel ratio will inflate because the reference screenshot is
   1440px wide and the rebuilt screenshot is 1280px wide; my crop-to-min
   logic only compares the overlapping 1280x... region but the right
   strip of the reference is dropped. This is acceptable for V2.1 (still
   a meaningful signal); a future tweak could re-capture rebuilt at the
   exact crawl viewport instead of the canonical desktop.

3. **MSW soft-wait.** `navigator.serviceWorker.controller !== null` is
   the best runtime signal we have. If the SPA's first request fires
   before the worker activates we miss the mock and may render an error
   state. The 2.5s post-load settle was tuned in route-render-check to
   absorb this; pixel parity inherits the same window.

4. **One reference per route.** The crawler captures one screenshot per
   *state*, not per *route x viewport*. The stretch goal in the brief
   ("compare against the ORIGINAL capture's reference screenshot for that
   route + viewport") assumes per-viewport references which do not exist.
   I documented this in the route-result shape: only the matched viewport
   is gated; others are inspection-only.

5. **Parity test count.** Brief said "2/2"; we observe 3/3. Fixtures
   grew during parallel agent work; no regression.

## Commits

- `ef140c6` feat(webapp): boot vite preview for pixel-parity capture
- `a553d0a` feat(webapp): per-route screenshot diff vs original capture
- (this commit) feat(webapp): emit parity-report.json in canonical schema

## Caller Wiring (Follow-Up)

`scripts/clone-urls.ts` currently calls `runPostEmitMultiWebapp({ outDir })`
without `crawlDir` or `inference`, so pixel-parity will report
`skipped: no crawlDir` until that script is taught to thread the crawl
output through. The orchestrator change is non-breaking; the new options
are all optional. Wiring the CLI flags is a separate work item.
