# W4B Phase 6 Invasive Half: Shims, Canonical Paths, Subprocess Removal

Agent: W4B
Branch: prototype-mode
Starting HEAD: 49231ff (after W3 unified logging)
Ending HEAD: ace4347 (after this wave)

W4A landed concurrently on the additive half (harvest command + skill
rewrite). The two waves merged cleanly because file territory was
strictly partitioned per the brief.

## Summary

Closed out Phase 5 deferred items 6 and 7 plus the Phase 6 shim
removal:

- Canonical output paths now default for capture, run-clone, and
  clone-urls. The legacy docs/research/captures layout is opt in via
  --legacy-output.
- The four spawn() calls inside run-clone and clone-urls are gone.
  Capture, parse:har, parse:trace, complete:assets, and clone all run
  as direct function calls now. Each script exports a main(argv)
  function and keeps a CLI tail guarded by process.argv[1] detection.
- Eight npm script aliases that were replaced by parity subcommands or
  reference dead pipelines have been deleted. The conservative cut
  leaves dev/build/start/check in place since those scripts are
  referenced from CI templates and the PR template and the brief said
  be conservative.
- v2.0.0 tag created locally per the brief checklist.

No regression: parity test holds at 2 pass / 0 fail / 0 skip
throughout. TypeScript baseline holds at 15 errors on tracked code
across every commit.

## Canonical Paths Adoption Matrix

| Script | Before path | After path | Fallback flag |
|---|---|---|---|
| scripts/capture.ts | docs/research/captures/<host>/<iso> | clones/<target>/<iso>/captures | --legacy-output |
| scripts/run-clone.ts | docs/research/captures/<host>/<iso> | clones/<target>/<iso>/{captures,...} | --legacy-output |
| scripts/clone-urls.ts | docs/research/captures/<host>/ + <host>/<target>-site-urls | clones/<target>/<iso>/{captures,sites/<target>} | --legacy-output |

Defaults are canonical. The fallback flag exists for any historical
workflow that still needs the legacy layout (e.g. comparing against
existing captures on disk). Existing captures under
docs/research/captures/ are NOT migrated. Both the regression corpus
fixtures and the W2A/W2B observation captures reference paths under
docs/research/captures/ so they continue working as-is.

Per-URL captures inside clone-urls keep the host/iso subdir nesting by
forcing --legacy-output on the inner capture call. The captures parent
is canonical (clones/<target>/<iso>/captures) so multiple URLs in one
clone-urls run share a single canonical run root.

## Subprocess Removal Map

| Script | Spawned process | Replacement in-process call | Output capture |
|---|---|---|---|
| scripts/run-clone.ts | npx tsx scripts/capture.ts | runCapture(argv) | parent stdout/stderr |
| scripts/run-clone.ts | npx tsx scripts/parse-har.ts | parseHarMain(argv) | parent stdout/stderr |
| scripts/run-clone.ts | npx tsx scripts/parse-trace.ts | parseTraceMain(argv) | parent stdout/stderr |
| scripts/run-clone.ts | npx tsx scripts/complete-assets.ts | completeAssetsMain(argv) | parent stdout/stderr |
| scripts/run-clone.ts | npx tsx scripts/clone.ts | cloneMain(argv) | parent stdout/stderr |
| scripts/clone-urls.ts | (same five as above, per URL) | (same five calls, per URL) | parent stdout/stderr |

All ten spawn calls removed. The W3 unified logger (when it wraps
these pipelines via run-clone-stage.ts in a future wave) will see one
continuous event stream rather than five subprocess output blobs.

The legacy CLI tail in each script is preserved using
`process.argv[1].endsWith('<name>.ts')` detection. This keeps
`npx tsx scripts/capture.ts` and friends working as standalone tools
for ad hoc invocation, but the in-process path skips them.

`engine/cli/run-clone-stage.ts` was deliberately not touched in this
wave. It still spawns `npx tsx scripts/run-clone.ts` as one
subprocess. That outer shim was W3's design and tests it
end-to-end; converting it to call `runCloneEntry(argv)` directly is a
straightforward follow-up but would have broken parity with the W3
smoke-test wiring and was out of scope for this wave's no-regression
guarantee.

## Shim Removal Audit

| Deleted script | Replaced by | Caller search result |
|---|---|---|
| generate:prototype | parity build / dead pipeline | no callers outside docs |
| generate:prototype:fixture | parity build / dead pipeline | no callers outside docs |
| generate:astro | parity build / dead pipeline | no callers outside docs |
| generate:astro:fixture | parity build / dead pipeline | no callers outside docs |
| parse:all | parity parse (or two direct invocations) | no callers outside docs |
| build:react:multi | npx tsx scripts/clone-urls.ts --target=react | bugs.md updated |
| build:astro:multi | npx tsx scripts/clone-urls.ts --target=astro | no callers outside docs |
| clone-end-to-end | parity clone | no callers outside docs |

Kept (load bearing infrastructure):

- typecheck, check (still referenced from PR template and CHANGELOG)
- build-astro, build:astro, build:react, build:webapp
  (engine emit drivers still used directly)
- test:parity:astro, test:parity:react (parity test gates)
- capture, crawl:webapp, parse:har, parse:trace, complete:assets,
  extract:css, extract:primitives, extract:tokens (ad hoc tools)
- clone, clone-site, clone-urls (still referenced by docs)
- check:html-rewriter, check:astro-emit, check:refactor,
  check:scope-styles, check:prettify (smoke checks; load bearing
  for no-regression discipline)
- iconify:svgs, verify:parity, extract:animations, scope:styles,
  centralize:content, refactor:sections, rebuild-pro,
  generate:edit-playbook, extract:library, preview, smoke:cli
  (per task referenced in docs)
- dev, build, start (referenced from PR template and CHANGELOG even
  though the underlying Next.js stack is vestigial; left intact to
  avoid breaking documented workflows)

The brief said be very conservative. The kept list errs in that
direction. A future cleanup wave can audit the kept list once doc
references to those scripts are confirmed stale.

## v2.0.0 Tag Checklist

Tag created locally at HEAD ace4347 with the multi-line annotation
from the brief. NOT pushed. Cameron pushes when ready.

Criterion confirmation before tagging:

- [x] Unified parity CLI with citty subcommands (clone, capture, parse,
      clone-static, targets, runs, test, version) -- W1D + W3 + W4A
- [x] Durable .runs/ logging with manifest.json, pipeline.jsonl,
      stage-logs/, SUMMARY.md -- W3
- [x] Regression corpus at tests/fixtures/sites/ with parity test gate
      -- W2C
- [x] Webapp post-emit pipeline (install/build/msw-boot/route-render/
      state-assertions) -- W2A
- [x] React media-preserve port (apple.com pixel diff 30.56 to 18.62,
      39% improvement) -- W2B
- [x] slice-body refactored target agnostic; astro byte-identical
      -- W2A + earlier waves
- [x] Chrome MCP retired; Playwright CLI only -- enforced across docs
      and SKILL.md by W4A
- [x] Action plan closed at docs/V2.0/05-action-plan.md (W4A updated
      Phases 6 and 7 to reflect shipped harvest and skill rewrite)

Verification at tag time:

- npx parity test: 2 passed, 0 failed
- npm run check:astro-emit: OK
- npm run check:refactor: 12/12 passed
- npm run check:prettify: 4/4 ok
- npm run check:scope-styles: all checks passed
- npx tsx scripts/smoke-parity-cli.ts: 4/4 passed
- TypeScript baseline: 15 errors on tracked code (unchanged)

## Reasons for implementation choices

### run-clone-stage.ts shim retained

W3's run-clone-stage.ts spawns the legacy `npx tsx scripts/run-clone.ts`
as one subprocess. With this wave's in-process refactor, the inside of
that subprocess no longer spawns anything. Converting run-clone-stage
to call `runCloneEntry(argv)` directly is mechanical but would have
required re-running the full W3 smoke test under the new wiring. The
brief prioritised the script-level subprocess removal (the costly
spawn fan-out) and the canonical paths retrofit; the outer shim is
left as a Wave 5 follow-up.

The unified .runs/ logger does not yet attribute events to the inner
stages because the inner pipeline runs as one opaque
clone-pipeline blob in the manifest. Once run-clone-stage calls
runCloneEntry directly, individual stage_start/stage_end events will
attach to the JSONL stream automatically.

### Conservative shim audit

The brief warned against blanket deletes. The eight scripts dropped
in this wave all met two criteria: replaced by a parity subcommand or
known-dead pipeline, AND zero callers outside V2.0 audit docs (which
intentionally reference them as historical context). Every other npm
script either has a doc reference, a CI hook, or a still-active
caller.

### Per-URL host/iso nesting under canonical layout

The naive approach would have been to write per-URL captures as
clones/<target>/<iso>/captures/<url-slug>/<viewport>/. But the capture
script uses host/iso subdirs internally and the parse/clone stages
expect that shape. To keep zero regression, clone-urls forces
--legacy-output on the inner capture call, which preserves the
host/iso semantics under the canonical run root. The outer layout
stays canonical; the inner per-URL nesting stays compatible with the
existing parse and clone code paths.

## Pipeline improvement opportunities

1. `run-clone-stage.ts` still spawns the run-clone pipeline as one
   subprocess. Wiring it to `runCloneEntry(argv)` directly would give
   the manifest per-stage timing without parsing stdout.
2. The legacy-output detection branches inside run-clone (recovering
   the resolved capture dir via newestSubdir) could be removed once
   capture's --out under canonical mode produces a deterministic
   directory. The newestSubdir scan exists only because legacy capture
   appends host/iso to --out internally.
3. The four legacy emit scripts in package.json (build-astro,
   build:astro, build:react, build:webapp) are not yet wrapped by
   parity subcommands. Future wave: surface them as `parity build`
   options.

## Parity engine bug surface (none new)

Infrastructure-only wave. No engine code paths modified. Astro
byte-identical gate and react/webapp post-emit pipelines untouched.

## Anomalies

During the subprocess removal step, several Edit operations on
parse-har.ts, parse-trace.ts, clone.ts, and complete-assets.ts
reverted between turns. Suspect a background formatter or interleaved
W4A activity rewrote the files. Re-applied each Edit cleanly with no
content lost. No regression triggered.

The git history during the wave shows W4A commits (a7d1cda, e25935c,
f655650, 8aeb8a8, f1cc9bd, 49713ba) interleaved with W4B commits. Both
agents wrote to disjoint file sets per the brief; the merge happened
implicitly through linear commit ordering on prototype-mode.

## Wired vs Deferred

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6 | Canonical paths adoption | done | capture, run-clone, clone-urls. Legacy fallback intact. |
| 7 | Subprocess removal | done (script level) | All ten spawn calls inside run-clone and clone-urls replaced with direct function calls. run-clone-stage.ts outer shim retained per W3's wiring. |
| - | Shim removal | done | 8 npm scripts deleted. bugs.md updated. |
| - | v2.0.0 tag | done | Created locally, not pushed. |

## Verification at end of wave

- npx parity test: 2 passed, 0 failed, 0 skipped, 2 total
- TypeScript error count on tracked code: 15 (unchanged baseline)
- npm run check:astro-emit: OK
- npm run check:refactor: 12/12 passed
- npm run check:prettify: 4/4 ok
- npm run check:scope-styles: all checks passed
- npx tsx scripts/smoke-parity-cli.ts: 4/4 passed
- git tag -l v2.0.0: present

## Commits made this wave

- 02b13ed refactor(scripts): capture writes into canonical clones/<target>/<iso>/captures
- c79f416 refactor(scripts): run-clone uses canonical run-root for all stages
- 8eaa007 refactor(scripts): clone-urls adopts canonical layout
- 257eb7f refactor(scripts): run-clone calls engine modules in process
- 3140df9 refactor(scripts): clone-urls calls engine modules in process
- 1c8b313 chore(package): remove npm script shims now covered by parity subcommands
- ace4347 docs: update bugs.md to use parity-equivalent invocations

Plus the observation commit that introduces this file, and the
v2.0.0 tag annotation.
