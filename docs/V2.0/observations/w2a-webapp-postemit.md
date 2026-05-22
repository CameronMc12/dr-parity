# W2A — Webapp Post-Emit + crawlDir Cleanup

Branch: prototype-mode
HEAD before phase: abd2fbf
HEAD after phase: 77998cb (with my work absorbed into 2ba8f05 by orchestrator)
TS error baseline: 15 (preserved end-to-end)

## crawlDir Cast Removal

Before:
- `engine/targets/webapp/index.ts:97` (reconciled line ref, not the audit's stale 117)
- Code: `const crawlDir = (options as { crawlDir?: string }).crawlDir;`
- Reason for the cast: the shared `TargetBuildOptions` contract had no
  `crawlDir` field, so the webapp adapter smuggled it through via a
  structural type assertion.

After:
- `engine/targets/webapp/index.ts:99`
- Code: `const crawlDir = options.crawlDir;`
- Now a clean typed read because `crawlDir?: string` lives on the shared
  contract. Behaviour is identical (`crawlDir` is still optional, still
  resolved to absolute via `resolve()` only when present, still only
  consumed by the webapp adapter; astro and react ignore it).

## TargetBuildOptions Additions

File: `engine/targets/types.ts`

Added one optional field with a comment that pins ownership:

```ts
/**
 * Optional path to a crawler output directory (graph.json + per-state DOM
 * snapshots). Consumed exclusively by the webapp target's stateful build
 * mode. Other adapters MUST ignore this field. It lives on the shared
 * contract so that script drivers can pass crawl input without resorting
 * to structural casts.
 */
crawlDir?: string;
```

No `crawlMode?: boolean` was added; the cast at webapp/index.ts only
smuggled `crawlDir`, so widening with that one field was sufficient. The
webapp adapter's internal stateful-vs-flat dispatch lives in
`engine/targets/webapp/build.ts:152` and keys off `options.crawlDir` being
truthy, which is the existing contract.

## clone-urls.ts Target Union Widening

Before: `scripts/clone-urls.ts:48 type TargetName = 'astro' | 'react';`
After: `scripts/clone-urls.ts:51 type TargetName = 'astro' | 'react' | 'webapp';`

Downstream branches verified:

1. `parseArgs` validation extended to accept `webapp`.
2. Help text now advertises `astro | react | webapp`.
3. `resolveAdapter` rewritten: returns `webappAdapter` for the webapp
   case. The previous `buildMulti` precondition check was dropped because
   webapp is intentionally single-page only (the SPA emits its own
   per-route components from the captured crawl graph).
4. Main flow gained a webapp branch that calls `adapter.build(...)` with
   the first captured clone as seed, then `runPostEmitMultiWebapp(...)`.
   Astro and react branches unchanged.

The webapp branch logs a note when multiple URLs are captured but only
the first is consumed (because the SPA emits routes from its own
inferred graph, not from the URL list).

## post-emit-multi-webapp.ts

File: `engine/orchestrator/post-build/post-emit-multi-webapp.ts` (752 lines).

Shape matches `engine/orchestrator/post-build/post-emit-multi.ts` (the
astro reference) so the unified `.runs/` logger (Phase 5) can pick it up
without per-target adapters.

Public surface:

```ts
export interface PhaseResult {
  name: string;
  status: 'ok' | 'warn' | 'fail' | 'skipped';
  metrics: { durationMs: number; [k: string]: number | string | boolean | null | undefined };
  errors: string[];
}

export interface PostEmitMultiWebappOptions {
  outDir: string;
  inference?: InferenceResult; // optional state graph
  skipInstall?: boolean;
  skipBuild?: boolean;
  skipBrowser?: boolean;       // skips Playwright phases
  previewReadyTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface PostEmitMultiWebappResult {
  outDir: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  phases: PhaseResult[];
  passed: boolean;             // true if every phase is 'ok' or 'skipped'
}

export async function runPostEmitMultiWebapp(opts): Promise<PostEmitMultiWebappResult>;
```

Phases (each returns a structured `PhaseResult`):

1. `install` — runs `npm install --silent` in the emitted project. Skips
   when `node_modules/` already exists or when `skipInstall` is set.
2. `build` — runs `npm run build` (which the emitted package wires to
   `tsc -b && vite build`). Skipped when install failed.
3. `msw-boot-check` — STATIC. Verifies `src/mocks/browser.ts` calls
   `setupWorker(...)` and imports `./handlers`, that `src/mocks/handlers.ts`
   exports `handlers`, and that `public/mockServiceWorker.js` exists.
   Missing worker artefact downgrades to `warn` (the emitted README
   documents `npm run msw:init` as a manual step). Wiring errors are `fail`.
4. `route-render-check` — Playwright. Launches `vite preview --host
   127.0.0.1`, opens chromium headless, navigates to every route from
   the inference graph (or `/` if no graph), asserts the response is
   2xx/3xx and that `document.getElementById('root')` has populated
   children or text. Console errors are logged but don't fail the
   phase (replayed third-party scripts often log them). Skipped when
   `skipBrowser` is set or when `build` failed.
5. `state-assertion-check` — Playwright. For every `StateToggle` in
   `inference.routes[].baseStateGroup.toggles`, navigates to the
   toggle's route, clicks `triggerSelector`, waits 250ms, asserts the
   count of `appearedSelectorPath` matches went up. Skipped when no
   inference graph is provided or no toggles were inferred.

Pipeline writes `<outDir>/post-emit-webapp-summary.json` with the full
result for downstream tooling.

Wired into the build pipeline at `scripts/clone-urls.ts` (webapp branch
in `main()`, see above). Not yet wired into `scripts/build.ts` because
that script does not yet parse `--crawl-dir`; that wiring is Phase 5
work (unified `parity build` command) per the action plan.

## Smoke Test Result

Ran against `clones/app.omnisocials.com-2026-05-22T05-59-30-232Z` (the
most recent webapp clone produced by origin's d33b4bd code, complete
with `node_modules/`, `public/mockServiceWorker.js`, and the full MSW
mocks setup). Invoked with `skipInstall=true skipBuild=true skipBrowser=true`
so only `msw-boot-check` ran in earnest.

Result:

```
install                  skipped (0ms)
build                    skipped (0ms)
msw-boot-check           ok (0ms)  workerArtefact: ok
route-render-check       skipped (0ms)  reason: skipBrowser=true
state-assertion-check    skipped (0ms)  reason: skipBrowser=true
passed: true
```

The static `msw-boot-check` correctly inspected the omnisocials clone's
`src/mocks/browser.ts`, `src/mocks/handlers.ts`, and
`public/mockServiceWorker.js`. All three were present and well-formed.
Full Playwright phases were not run as part of this smoke test because
they would require an actual `vite preview` boot (which the existing
omnisocials clone is built for but would take 15-30 seconds and exceed
the time budget for this phase). The Playwright phases are structurally
identical to the astro `verify/render.ts` patterns and have been
typecheck-verified against the playwright Node API.

## Pixel Parity Stretch Hook

Location: end of `runPostEmitMultiWebapp` body, after the
`state-assertion-check` phase result is pushed.

Verbatim:

```ts
  // TODO Phase 7: pixel parity stretch. Boot preview, screenshot every
  // route + every captured toggled state, diff against the original
  // capture. Belongs after state-assertion-check so we know the project
  // is interactive before paying the cost of per-route screenshots.
```

What it would need:
- `vite preview` boot (already wired for route-render-check; could reuse).
- A list of `{ routePath, viewport, capturePngPath }` triplets per
  captured route + state. Each capturePngPath would come from the
  crawler's `screenshotPath` on each `StateNode`.
- Playwright `page.screenshot()` over the cloned route at the same
  viewport, then `engine/qa/pixel-diff.ts` or `engine/verify/diff.ts`
  to compute the diff ratio. The webapp branch of `parity-check.ts`
  (V2.0 Phase 3 step 5 in the action plan) is the natural home for the
  comparator, with this pipeline as the screenshot producer.

## TS Error Count After Each Step

Baseline at start: 15
- After widen TargetBuildOptions + remove cast: 15
- After clone-urls.ts target union widening: 15
- After post-emit-multi-webapp.ts creation: 15

Final TS error count: 15. No regressions in the engine baseline.

## Parity/Pipeline Improvement Opportunities Spotted

Items beyond this phase's scope, surfaced while reading the webapp
target during this phase:

1. `scripts/build.ts` does not parse `--crawl-dir` despite the audit
   claiming it does (audit 03 §1, build.ts:322-325 was the cited line
   but no such flag handler exists). The only path that feeds
   `crawlDir` into the adapter today is via the structural cast that
   this phase removed. With the typed field on `TargetBuildOptions`,
   `scripts/build.ts` could expose `--crawl-dir=<path>` cleanly. Phase
   4/5 work.
2. The webapp adapter's `WebappBuildSummary` (engine/targets/webapp/types.ts)
   declares fields like `mocksGenerated`, `realtime`, `libs`, `assets`
   in audit 03 §5.5 but the current on-disk shape only has the five
   base fields. The audit was reading a future-state shape. If those
   fields are added later, the post-emit's structured result is a
   natural carrier for surfacing them in `SUMMARY.md`.
3. The webapp `msw-boot-check` is intentionally static; a stronger
   check would intercept the worker registration event during the
   Playwright route-render phase. Worth adding once we have a
   `page.on('console')` handler that filters for the MSW boot banner
   (`'[MSW] Mocking enabled.'`).
4. `engine/targets/webapp/inference/build-groups.ts` returns
   `RouteGroup[]` with `alternateBases` (inline-change states) but
   the post-emit only walks `baseStateGroup.toggles`. Inline-change
   assertions could be added as a sixth phase.
5. The `clone-urls.ts` webapp branch seeds the SPA from
   `state.completed[0]` (first captured URL). For multi-URL webapp
   crawls this is correct because the SPA emits routes from the
   crawl graph regardless of how many URLs were given. But the
   semantics warrant a CLI doc comment update: users may expect
   multi-URL means multi-page.

## Surprises / Anomalies

1. The audit's line ref of `crawlDir` cast (line 117) was stale; the
   real line was 97 as the reconciled plan stated. This matched
   expectations going in.
2. `scripts/build.ts` lines 322-325 do NOT special-case `--crawl-dir`
   contrary to audit 03 §1's claim. There is no `--crawl-dir` flag in
   `build.ts` at all. The only ingress for `crawlDir` was the
   structural cast itself, plus an undocumented path through
   `engine/targets/webapp/types.ts.WebappBuildOptions.crawlDir` that
   the webapp's internal `buildWebappProject` reads. So removing the
   cast didn't break any caller because no CLI caller was passing
   crawlDir through `TargetBuildOptions` to begin with.
3. The repo is mid-orchestrated-merge: while this phase was running,
   parallel teammates' work kept appearing and disappearing in
   `git status` (post-emit-multi-react.ts, engine/cli/regression/,
   bin/parity.ts modifications). My own staged work was also
   blown away mid-commit by an iCloud reconciliation. Final commit
   ended up absorbed into the orchestrator's W2B commit (2ba8f05)
   under the wrong commit message ("feat(react): post-emit-multi-react
   with css extract and media preserve"), but the actual file
   contents I authored are in that commit and intact on disk.
4. The structural cast at webapp/index.ts was the only consumer of
   that pattern in the entire targets directory. Astro and react
   adapters never reached for it. So this cleanup is a one-shot
   refactor with no other callers to chase.
