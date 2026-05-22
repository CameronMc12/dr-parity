# W5C Finalisation Observation Log

V2.1 closing wave. Six items: SUMMARY decisions section, git sha pin,
check-astro-emit wiring follow up, crawl-dir threading through clone-urls,
V1 rebuild-pixel-diff mode for the regression corpus, and untracked
working tree triage.

## Per-item Delivery

| # | Item | Status | Commit |
|---|------|--------|--------|
| 1 | SUMMARY.md renders decision events | done | `2159453` feat(cli): SUMMARY decisions section |
| 2 | Pin reference captures to git sha | done | `043c383` test(corpus): pin reference captures to git sha |
| 3 | Wire unwired fixtures in `scripts/check-astro-emit.ts` | already done | n/a (the three runners were already invoked at lines 465 to 468; the W1C note in the brief was stale) |
| 4 | Thread crawlDir + inference through clone-urls into webapp post-emit | done | `c42fa5e` feat(scripts): thread crawl dir and inference into webapp post emit |
| 5 | V1 rebuild-pixel-diff mode for the regression corpus | done with proof | `9b5d717` feat(corpus): rebuild-pixel-diff comparison mode |
| 6 | Untracked working tree triage | done | `58996d6` chore: remove residual iCloud ghosts and commit blocklists |

## Untracked triage decisions

| Path | Decision | Reason |
|------|----------|--------|
| `engine/targets/webapp/emit-realtime/` | Leave untracked | Documented as ACTIVE in `docs/V2.0/02-architecture-audit.md` line 131 (websocket fixture emission). No tracked imports yet. Real in flight module. |
| `engine/targets/webapp/extract-body-root.ts` | Leave untracked | Documented in `03-targets-audit.md` line 293. Real in flight. |
| `engine/targets/webapp/form-capture/` | Leave untracked | Imported by `scripts/capture-form-states.ts` (itself untracked but listed as ACTIVE in the audit). Pair stays together until Cameron commits both. |
| `engine/targets/webapp/scaffold/templates/` | Leave untracked | Single template `mockServiceWorker.js.tpl`. Pairs with `scaffold/msw-setup.ts` and `static-files.ts` which reference public/mockServiceWorker.js but do not consume the .tpl. Leave alone until template loader lands. |
| `features.md` | Leave untracked | Real content spec (brand design system extraction). Cameron's working note. |
| `full-diag.mjs` | Deleted | Confirmed iCloud ghost. Same pattern as `auto-probe.mjs` that W5B.4 deleted. Listed in `01-pipeline-audit.md` line 112 as experimental scratch for omnisocials. Never committed in any branch. No tracked callers. |
| `test-login.mjs` | Deleted | Same as `full-diag.mjs`. Listed in `01-pipeline-audit.md` line 113. Never committed. No tracked callers. |
| `clones/` | Leave untracked | Gitignored. Working scratch per CLAUDE.md. |
| `docs/blocklists/` | Committed | Referenced in CLAUDE.md as canonical location for per app crawler blocklists. Two real per-app files for omnisocials. |
| `docs/research/audit/` | Leave untracked | Per clone research output. Same status as `clones/`. |
| `docs/research/crawl/` | Leave untracked | Same as audit. |

Net result: 2 deleted, 2 committed (the two blocklist files), 10 left
alone. The W5B.4 conservative deletion rule held for everything other
than the two confirmed iCloud ghosts.

## rebuild-pixel-diff design

The runner in `engine/cli/regression/rebuild-pixel-diff.ts` follows the
V1 spec sequence:

```
parity test (run-test.ts evaluateFixture)
  -> if comparison_mode === "rebuild-pixel-diff"
    -> compareRebuildPixelDiff({ fixture, repoRoot })
       1. Resolve cloneDir from fixture.captureRef
       2. mkdtemp tmp project dir
       3. astroAdapter.build({ cloneDir, outDir: projectDir, name, force })
          (or reactAdapter.build for react fixtures)
       4. npm install (skippable via input.skipInstall)
       5. npm run build (skippable via input.skipBuild)
       6. assert dist/index.html exists
       7. bootServer(cloneDir, free-port-near-5070)
       8. bootServer(distDir, free-port-near-5071)
       9. captureAll(browser, cloneUrl, rebuiltUrl, [viewport], outDir)
       10. diffShot({ viewport, clonePath, rebuiltPath }, 1 - parityThreshold)
       11. cleanup browsers, servers, tmp project dir
       12. return ComparisonResult { passed, score = 1 - diffRatio, ... }
```

Tooling reused (zero new dependencies):
- `engine/verify/ports.bootServer` for static serving
- `engine/verify/screenshots.captureAll` for Playwright screenshots
- `engine/verify/diff.diffShot` for the pixelmatch diff and PNG output
- `astroAdapter.build` and `reactAdapter.build` for the rebuild

Webapp fixtures will need a separate adapter path because
`webappAdapter.build` is a single page contract; vite preview semantics
live in `engine/orchestrator/post-build/webapp-pixel-parity.ts` already.
This is deferred. The current runner returns an explicit
unsupported message for webapp fixtures, no silent skip.

## Smoke result

Ran the new runner against the existing `example-com` capture:

```
rebuild-pixel-diff[example-com]: rebuilding into /tmp/dr-parity-rebuild-example-com-...
rebuild-pixel-diff[example-com]: npm install
rebuild-pixel-diff[example-com]: npm run build
... astro build ...
12:43:45 [build] 1 page(s) built in 230ms
rebuild-pixel-diff[example-com]: booting servers
rebuild-pixel-diff[example-com]: screenshotting desktop
rebuild-pixel-diff smoke: PASS in 85365ms
summary: rebuild-pixel-diff match (viewport=desktop score=100.00%)
```

End to end cost: 85 seconds, dominated by npm install. Build itself is
under a second.

Corpus result after adding the 4th fixture:

```
PASS enerblock-net            target=astro   viewport=desktop score=100.0% manifest-shape match (5/5)
PASS example-com              target=astro   viewport=desktop score=100.0% manifest-shape match (5/5)
PASS example-com-mobile       target=astro   viewport=mobile  score=100.0% manifest-shape match (5/5)
PASS example-com-rebuild-pixel target=astro  viewport=desktop score=100.0% rebuild-pixel-diff match (viewport=desktop score=100.00%)
parity test summary: 4 passed, 0 failed, 0 skipped, 4 total
```

## Schema additions to fixture.json

Two additive fields landed:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `captured_at_sha` | `string` | optional | Git commit hash that produced the reference capture. Empty string when not set. Loader tolerates absence; existing fixtures continue to load. |
| `comparison_mode` | extended | extended union | The `ComparisonMode` union now includes `rebuild-pixel-diff`. Existing values (`bytes`, `pixel-diff`, `manifest-shape`, `both`) still valid. |

Both changes are strictly additive: no existing fixture breaks. The
parity test runner picks up the new mode via a discriminated branch in
`evaluateFixture` (engine/cli/regression/run-test.ts).

## Decision events in SUMMARY.md

Wired `readEventStream` from pipeline.jsonl into `summary-writer.ts`.
The renderer filters to `decision` events and emits a "Decisions"
section listing each as `- [stage] decision. Reason: reason`. Empty
state shows `_No decisions recorded for this run._`.

Function signature is backward compatible: `renderSummaryMarkdown` now
takes an optional second `decisions` param defaulting to `[]`. The only
external caller (`run-clone-stage.ts`) does not need changes because
`writeSummary` internally reads the event stream and forwards.

## crawlDir threading

Before: `scripts/clone-urls.ts` called `runPostEmitMultiWebapp({ outDir })`
with no crawl context. The webapp pixel parity stretch phase therefore
always reported `skipped: { reason: 'no crawlDir' }`.

After: added `--crawl-dir=<dir>` flag. When set with
`--target=webapp` the script:

1. Resolves the absolute path and logs it.
2. Forwards `crawlDir` into `webappAdapter.build` so the build switches
   to the stateful pipeline (per-route components from inferred state
   groups).
3. Calls `loadCrawlGraph(absCrawlDir)` and `inferStateGroups(graph, getStateDom)`
   to produce an `InferenceResult`.
4. Threads both `crawlDir` and `inference` into `runPostEmitMultiWebapp`,
   unblocking the pixel-parity stage.

Without the flag, behaviour is unchanged: single-page flat emit, pixel
parity skipped by design.

CLI smoke (no real webapp clone available without paying the full
install + crawl cost):

```
$ npx tsx scripts/clone-urls.ts --help | grep crawl-dir
  --crawl-dir=<dir>    Webapp crawl directory (graph.json + states + screenshots).

$ npx tsx scripts/clone-urls.ts --crawl-dir= --url=https://example.com
Empty --crawl-dir value
```

Parser rejects empty values, accepts populated values, and the
downstream flow type-checks (tsc 0 errors).

## Item 3 follow up

The W1C note in the brief said `runFixturePostMain`, `runFixtureInterstitial`,
and `runFixtureTwoSections` were defined but never invoked. Inspecting
the file showed they were already wired:

```
465:  failures = failures.concat(runFixtureTwoSections());
466:  failures = failures.concat(runFixtureBodyScripts());
467:  failures = failures.concat(runFixturePostMain());
468:  failures = failures.concat(runFixtureInterstitial());
```

The check passes at HEAD:

```
$ npm run check:astro-emit
OK  787 bytes of fixture HTML emitted with is:inline, absolute paths, and clean Main.astro
```

No commit needed. W1C note was stale by the time W5C ran.

## Anomalies and surprises

1. **W1C note stale**. Item 3 was already in tree. Possible that the
   note was written before an intermediate commit landed the wiring.
2. **rebuild-pixel-diff cost dominated by npm install**. The build and
   diff together take under 2 seconds; npm install is ~80 seconds. A
   future optimisation would be to cache `node_modules/` per target in
   a shared location and symlink, but that is out of scope for V2.1.
3. **Webapp rebuild path deferred**. The `webappAdapter` shape (single
   page, internal scaffolding, vite preview semantics) does not match
   the astro/react `build` + `npm run build` + static serve pattern.
   Webapp already has a dedicated pixel parity pipeline in
   `engine/orchestrator/post-build/webapp-pixel-parity.ts`. Bridging
   that into the corpus runner is a follow up.
4. **W5B.4 conservative deletion rule held**. Of the 16+ untracked
   files, only `full-diag.mjs` and `test-login.mjs` were confirmed
   ghosts. The rest are either real in flight work, legitimate
   research outputs, or paired with other untracked artefacts.

## Final state

- TS baseline: 0 errors
- parity test: 4 passed, 0 failed, 0 skipped
- check:astro-emit: OK
- check:refactor: 4 ok, 0 failed
- check:prettify: 12 cases passed
- check:scope-styles: safe and aggressive both OK
- Astro byte identity: preserved (smoke test green)

V2.1 is shippable.
