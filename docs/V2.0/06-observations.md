# Dr Parity V2.0 Consolidated Observations Review

## How to read this file

Each section condenses one or more sub-agent observation files. The "Changes shipped" tables follow the four-field format (Change, Reason, Files, Impact). The "Parity improvement opportunities" section is the most useful for planning V2.1. Commit hashes are inline so `git show <hash>` reveals the actual diff.

## At a glance

| Wave / Agent | Key deliverable | Commits | Status |
|---|---|---|---|
| W1A | Cleanup, dead Docker, .bak prune, scaffold removal | `89523d2`, `cccf16f`, `3fa2015` | done (3 commits, ~50 path deletions) |
| W1B | Chrome MCP retirement, stale stack doc fix, sync scripts pruned | 1 chore commit | done |
| W1C | `slice-body.ts` target-agnostic refactor; astro byte identical | merged into wave | done |
| W1D | citty CLI scaffold; 7 subcommands; Stage/Logger seam | merged into wave | done |
| W2A | Webapp post-emit pipeline; `crawlDir` typed; 5 phases | absorbed into `2ba8f05` | done |
| W2B | React media-preserve port; apple.com 30.56 to 18.62 pct | merged into wave | done |
| W2C | Regression corpus; `parity test` gate; 2/2 fixtures green | `c175b27`, `d5e0666`, `eab5ad8`, `fc41b9d` | done |
| W3 | `.runs/` manifest, JSONL, stage-logs, SUMMARY.md | `06fce7a`, `b19f224`, `6af2ece`, `9de291d`, `3b6f258`, `a29b521` | done (items 6 and 7 deferred) |
| W4A | Harvest loop; SKILL.md rewrite; tickets system | `a7d1cda`, `fdaf73a`, `e25935c`, `f655650`, `8aeb8a8`, `f1cc9bd` | done |
| W4B | Canonical paths; subprocess removal; shim cleanup; v2.0.0 tag | `02b13ed`, `c79f416`, `8eaa007`, `257eb7f`, `3140df9`, `1c8b313`, `ace4347` | done |

## Changes shipped, organised by phase

### Phase 1 Cleanup (W1A, W1B)

- **Change.** Removed dead Docker layer (4 files) plus 8 `.bak` files plus the entire Next.js `src/` and `public/` scaffold plus 4 dead scripts plus a nested `docs/docs/research/prompts/` directory.
- **Reason.** "Targets dead Next.js layer; no live script invokes it." Dead scaffolding blocks the cleanup of dependencies and clutters `scripts/`.
- **Files.** ~50 path deletions across `89523d2`, `cccf16f`, `3fa2015`.
- **Impact.** Repo no longer pretends to be a Next.js app. Sets up dependency pruning in Phase 2.

- **Change.** All Chrome MCP references removed from `AGENTS.md`, `README.md`, `docs/research/INSPECTION_GUIDE.md`, both `SKILL.md` files, `.github/copilot-instructions.md`, and `.github/workflows/ci.yml`.
- **Reason.** "Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run for anomalies. No browser MCP is used anywhere."
- **Files.** `AGENTS.md`, `README.md`, `docs/research/INSPECTION_GUIDE.md`, `.claude/skills/clone-website/SKILL.md`, `.github/skills/clone-website/SKILL.md`, `.github/copilot-instructions.md`, `.github/workflows/ci.yml`, `scripts/sync-skills.mjs`, `scripts/sync-agent-rules.sh`.
- **Impact.** No conflicting guidance for future contributors. Sync scripts also stopped resurrecting 8 AI-tool directories that origin commit `3b4efd2` had pruned.

- **Change.** CI step reduced from `lint + build + typecheck` to `typecheck` only (`npx tsc --noEmit`).
- **Reason.** `npm run lint` and `npm run build` reference non-existent `next` and `eslint` configs.
- **Files.** `.github/workflows/ci.yml`.
- **Impact.** CI no longer broken by default. Type-baseline becomes the live gate.

### Phase 3 Target reliability (W1C, W2A, W2B)

- **Change.** `slice-body.ts` `sliceMain` no longer emits astro-specific `---\nimport...\n---\n<main>...</main>` strings. It now returns a structured `ComponentDef` with `wrapper` and `childComponentNames`. Astro and react emitters render frontmatter themselves; webapp inlines.
- **Reason.** "The shared IR is now framework-neutral per its own docblock at `shared/types.ts:5-8`." Old approach baked astro syntax into a shared module.
- **Files.** `engine/targets/shared/types.ts`, `engine/targets/shared/slice-body.ts`, `engine/targets/astro/emit.ts`, `engine/targets/astro/emit-multi.ts`, `engine/targets/react/emit.ts`, `engine/targets/react/emit-multi.ts`, `engine/targets/webapp/build.ts`.
- **Impact.** Astro output is byte-identical (verified by sha256 across 13 fixtures). React semantically equivalent. Webapp fixes the literal-frontmatter-text bug (audit flagged as "real bug"). `parseAstroFrontmatter`, `preservePascalTags`, `restorePascalTags`, `ParsedBody`, `stripTrailingFrontmatter` all retired.

- **Change.** Webapp `crawlDir` structural cast removed; field added to shared `TargetBuildOptions`.
- **Reason.** "Smuggled it through via a structural type assertion." The cast was the only consumer of that pattern in the entire targets directory.
- **Files.** `engine/targets/types.ts`, `engine/targets/webapp/index.ts`.
- **Impact.** Typed contract. Unblocks `scripts/build.ts --crawl-dir` exposure.

- **Change.** New `engine/orchestrator/post-build/post-emit-multi-webapp.ts` (~752 lines) with five phases: install, build, msw-boot-check, route-render-check, state-assertion-check.
- **Reason.** Mirror the astro post-emit shape so the unified `.runs/` logger can pick it up without per-target adapters.
- **Files.** new file plus `scripts/clone-urls.ts` webapp branch.
- **Impact.** Webapp now has structured post-emit checks. Pixel parity stretch hook documented as Phase 7 TODO.

- **Change.** React media-preserve port. New `engine/orchestrator/post-build/post-emit-multi-react.ts` (~270 lines). Aggregates CSS rules across all clone dirs, filters @media rules, writes `responsive.css`, injects `<link>` into every emitted page.
- **Reason.** apple.com was losing every @media rule on react emit. 35 pct of apple's rules are @media scoped.
- **Files.** new file plus `scripts/clone-urls.ts` import.
- **Impact.** apple.com desktop pixel diff dropped from 30.56 pct to 18.62 pct. 11.94 pp absolute, 39 pct relative. Aggregated 5831 unique rules, 2227 @media rules across 44 media queries on one rebuild.

### Phase 4 CLI scaffolding (W1D)

- **Change.** Citty CLI scaffold at `bin/parity.ts` with subcommands `clone`, `capture`, `parse`, `clone-static`, `targets`, `runs`, `version`. Stage/Logger contracts in `engine/cli/stage.ts`. Orchestrator in `engine/cli/orchestrate.ts`. Canonical path helpers in `engine/cli/canonical-paths.ts`.
- **Reason.** Replace ad-hoc `npx tsx scripts/*.ts` invocation with one unified surface. Citty wraps Node's `util.parseArgs` so zero runtime deps beyond Node 24.
- **Files.** `bin/parity.ts`, `engine/cli/{stage,orchestrate,context,canonical-paths}.ts`, `scripts/smoke-parity-cli.ts`, `package.json`.
- **Impact.** All stubs work; smoke test 4/4 pass. Subsequent waves wire actual stages behind these subcommands.

### Phase 5 Unified logging (W3)

- **Change.** Append-only NDJSON event stream with locked `PipelineEvent` union (`stage_start`, `stage_end`, `metric`, `warning`, `error`, `artefact`, `decision`, `run_start`, `run_end`, `log`).
- **Reason.** Durable triage record. Harvest loop (Phase 6) consumes this directly.
- **Files.** `engine/cli/event-stream.ts`.
- **Impact.** Every run produces a parseable event log.

- **Change.** Run manifest schema v1 with atomic writes (write-to-tmp then rename). `ManifestSchemaError` thrown on version mismatch so future `parity runs migrate` hint fires.
- **Reason.** Locked schema prevents silent drift across versions.
- **Files.** `engine/cli/run-manifest.ts`.
- **Impact.** Manifest is the durable per-run truth.

- **Change.** `createRunContext` extended to create `.runs/<runId>/stage-logs/`, tee stdout to JSONL, return `FullRunContext` with `emit`, `forStage`, `onDispose`, `finalise`.
- **Reason.** One context handles everything: stdout, jsonl, per-stage logs, lifecycle.
- **Files.** `engine/cli/context.ts`, `engine/cli/stage.ts`, `engine/cli/orchestrate.ts`.
- **Impact.** Logger tee makes durable records free.

- **Change.** `SUMMARY.md` generator with USER block preservation (`<!-- USER-START -->` / `<!-- USER-END -->` survive regenerates).
- **Reason.** Cameron's annotations survive re-runs.
- **Files.** `engine/cli/summary-writer.ts`.
- **Impact.** Per-run human-readable surface.

- **Change.** `parity clone <url> [target]` wired end-to-end via `runParityClone` in `engine/cli/run-clone-stage.ts`.
- **Reason.** First real CLI subcommand to produce a durable record.
- **Files.** `engine/cli/run-clone-stage.ts`, `bin/parity.ts`, `.gitignore`.
- **Impact.** Every `parity clone` run writes manifest + jsonl + stage-logs + SUMMARY.md.

- **Deferred.** Items 6 (canonical-paths retrofit across scripts) and 7 (subprocess removal) deferred from W3 and picked up by W4B.

### Phase 6 Harvest, skill, shims (W4A, W4B)

- **Change.** `parity runs harvest` walks `.runs/` and emits triage tickets under `docs/parity-issues/`. Five finding kinds: `recurring-warning`, `repeat-error`, `parity-regression`, `duration-drift`, `stuck-warning`. Idempotent via deterministic slugs.
- **Reason.** Convert raw run records into actionable tickets for a single-developer cadence.
- **Files.** `engine/cli/runs-harvest.ts`, `engine/cli/runs-harvest-cli.ts`, `engine/cli/run-manifest-read.ts`, `engine/cli/event-stream-read.ts`, `bin/parity.ts`, `scripts/smoke-parity-harvest.ts`, `docs/parity-issues/INDEX.md`.
- **Impact.** Cameron can see recurring patterns without manual log diving. Severity classified P1 to P3 by surface count.

- **Change.** `/clone-website` SKILL.md rewritten from 522 lines to 96 line wrapper over `parity clone`. Both `.claude/skills/` and `.github/skills/` updated.
- **Reason.** "Drops every Chrome MCP reference and every legacy `scripts/*.ts` invocation in favour of a single canonical `parity clone` command."
- **Files.** `.claude/skills/clone-website/SKILL.md`, `.github/skills/clone-website/SKILL.md`.
- **Impact.** Future skill invocations stop referencing deleted scripts.

- **Change.** Canonical output paths adopted by `capture.ts`, `run-clone.ts`, `clone-urls.ts`. Default is `clones/<target>/<iso>/{captures,parsed,sites/<target>,...}`. Legacy `docs/research/captures/<host>/<iso>` available via `--legacy-output`.
- **Reason.** Single root per run. Better matches the `.runs/` model.
- **Files.** `scripts/capture.ts`, `scripts/run-clone.ts`, `scripts/clone-urls.ts`.
- **Impact.** All new captures land under `clones/`. Existing fixtures continue to resolve via the legacy fallback.

- **Change.** Ten `spawn()` calls inside `run-clone.ts` and `clone-urls.ts` replaced with direct in-process function calls (`runCapture`, `parseHarMain`, `parseTraceMain`, `completeAssetsMain`, `cloneMain`). Each script keeps a CLI tail guarded by `process.argv[1]` detection.
- **Reason.** Subprocess fan-out cost. Single event stream rather than five output blobs.
- **Files.** `scripts/run-clone.ts`, `scripts/clone-urls.ts` (plus exported main functions in each child script).
- **Impact.** Manifest will eventually attribute events to inner stages once `run-clone-stage.ts` is converted (outer shim left intact per W3's smoke-test wiring).

- **Change.** 8 npm script aliases removed: `generate:prototype`, `generate:prototype:fixture`, `generate:astro`, `generate:astro:fixture`, `parse:all`, `build:react:multi`, `build:astro:multi`, `clone-end-to-end`.
- **Reason.** Replaced by parity subcommands or reference dead pipelines. Zero callers outside docs.
- **Files.** `package.json`, `bugs.md` updated.
- **Impact.** Cleaner npm surface. `dev/build/start/check` kept since PR template references them.

- **Change.** `v2.0.0` tag created locally at `ace4347`.
- **Reason.** Mark the V2.0 line in the sand. Not pushed; Cameron pushes when ready.
- **Files.** git tag only.
- **Impact.** Stable reference point for downstream work.

### Phase 3d Regression corpus (W2C)

- **Change.** First two regression fixtures promoted: `example-com` and `enerblock-net` (both astro, `manifest-shape` mode, 99 pct threshold). `parity test` command runs the corpus.
- **Reason.** "The clone manifest is the cheapest stable signature available." Locks structural counts (htmlBytes, styles, scripts, assets, unresolvedExternal).
- **Files.** `tests/fixtures/sites/{example-com,enerblock-net}/...`, `tests/fixtures/known-bad/apple-com-react/...`, `engine/cli/regression/{fixture-schema,manifest-shape,run-test}.ts`, `bin/parity.ts`, `docs/V2.0/05-action-plan.md`.
- **Impact.** 2 pass / 0 fail / 0 skip baseline. Regression detection verified by mutating `htmlBytes`: correctly flagged FAIL with drift diagnostic. apple-com-react catalogued as known-bad for V1 rebuild work.

## Parity / pipeline improvement opportunities harvested

Grouped by theme. Severity reflects best-guess leverage if Cameron picks the item up next.

### CSS pipeline gaps

- **Opportunity.** Inject the responsive sheet via `ReactPageSlice.extraStylesheetHrefs` at emit time rather than patching HTML post-emit. A re-emit run silently loses the patched link tag.
  - **Who spotted it.** W2B.
  - **Severity.** P1 (silent regression risk on re-emit).
  - **Next step.** Move the link injection into `engine/targets/react/emit-multi.ts`.

- **Opportunity.** Aggregate all captured stylesheet hrefs across sibling pages and link every one into every page. Closes the remaining apple.com gap where the source cascade depends on per-page-loaded global styles.
  - **Who spotted it.** W2B.
  - **Severity.** P2 (closes the residual 18 pct on apple).
  - **Next step.** Extend the aggregator in `post-emit-multi-react.ts` to union all stylesheet hrefs across the run.

- **Opportunity.** Add `--threshold-react` knob to `verify-parity.ts`. Astro sits near 2 pct; react targets are realistically 15 to 20 pct even after media-preserve.
  - **Who spotted it.** W2B.
  - **Severity.** P2 (eliminates noise from the parity test gate).
  - **Next step.** Add the flag with a 20 pct default for react.

- **Opportunity.** Apple tile-subdivision fix appears to have been reverted or never landed. Audit references `slice-body.ts:166-178` but no such logic exists at HEAD.
  - **Who spotted it.** W1C.
  - **Severity.** P2 (potential apple parity gain).
  - **Next step.** Cameron to confirm whether tile fix was intentional revert or missing. If missing, port from history.

### CLI ergonomics

- **Opportunity.** Stage interface ships with `ok | warn | fail` but audit 04 lists `partial` too. Phase 5 should reintroduce once `qa-verify` needs to express "some viewports passed".
  - **Who spotted it.** W1D.
  - **Severity.** P3 (additive when needed).
  - **Next step.** Add `partial` to `StageStatus` union when first consumer arrives.

- **Opportunity.** No global `--quiet` / `--verbose` / `--json` / `--no-color` / `--run-id` / `--config` flags. Citty has no first-class globals; use a plugin.
  - **Who spotted it.** W1D.
  - **Severity.** P2 (UX cost compounds as subcommands grow).
  - **Next step.** Build `engine/cli/global-flags.ts` citty plugin.

- **Opportunity.** `Logger.event` is free-form `(name, fields)`. Tighten to `emit(event: PipelineEvent)` so the JSONL writer cannot drop required fields. Phase 5's `pipeline.jsonl` writer needs this.
  - **Who spotted it.** W1D.
  - **Severity.** P2 (type-safety for the durable record).
  - **Next step.** Define discriminated union in `engine/cli/stage.ts`.

- **Opportunity.** `parity runs harvest --dry-run` flag. Currently the only preview path is `--tickets-dir=<tmp>`.
  - **Who spotted it.** W4A.
  - **Severity.** P3.
  - **Next step.** Add `--dry-run` to `runsHarvestCommand`.

- **Opportunity.** Print top N findings as a stdout table after every harvest run.
  - **Who spotted it.** W4A.
  - **Severity.** P3.
  - **Next step.** Sketch in `runsHarvestCommand.run`.

### Subprocess and architecture

- **Opportunity.** `engine/cli/run-clone-stage.ts` still spawns `run-clone.ts` as one subprocess. Wiring directly to `runCloneEntry(argv)` would give per-stage timing in the manifest without parsing stdout.
  - **Who spotted it.** W3, W4B.
  - **Severity.** P1 (closes the last subprocess boundary; unlocks proper per-stage event attribution).
  - **Next step.** Convert `run-clone-stage.ts` to in-process invocation. Re-run W3 smoke test.

- **Opportunity.** Manifest's `artefacts.captureRoot` is the default root directory rather than the specific dated subdir, because the spawned legacy script's stdout is not parsed for paths.
  - **Who spotted it.** W3.
  - **Severity.** P2 (solved when subprocess removal completes).
  - **Next step.** Lands automatically once the run-clone-stage shim is replaced.

- **Opportunity.** `SUMMARY.md` does not yet render `decision` events from the JSONL stream.
  - **Who spotted it.** W3.
  - **Severity.** P3.
  - **Next step.** Easy addition to `summary-writer.ts` once a stage emits decisions.

- **Opportunity.** Webapp pixel parity stretch hook documented as TODO at end of `runPostEmitMultiWebapp`. Boot preview, screenshot every route and toggled state, diff against original capture.
  - **Who spotted it.** W2A.
  - **Severity.** P2 (matches the parity gate for webapp target).
  - **Next step.** Wire after `state-assertion-check`; reuse the `vite preview` boot.

- **Opportunity.** `scripts/build.ts` does not parse `--crawl-dir` despite the audit claiming it does. With the typed field on `TargetBuildOptions`, exposing it is now clean.
  - **Who spotted it.** W2A.
  - **Severity.** P3.
  - **Next step.** Add flag parsing in `scripts/build.ts`.

### Regression corpus expansions

- **Opportunity.** Expose `--manifest-only` on `npm run clone-site` so future fixture promotion can skip the heavy capture pass.
  - **Who spotted it.** W2C.
  - **Severity.** P2 (fixture maintenance cost).
  - **Next step.** Add the flag to `scripts/run-clone.ts`.

- **Opportunity.** No fixture exercises viewports beyond desktop. V1 rebuild path needs per-viewport baselines.
  - **Who spotted it.** W2C.
  - **Severity.** P2 (mobile parity is a real risk surface).
  - **Next step.** Promote enerblock at mobile viewport once V1 rebuild lands.

- **Opportunity.** Webapp build path does not emit a `parity-report.json`. Until it does, no webapp fixture can be promoted.
  - **Who spotted it.** W2C.
  - **Severity.** P2 (blocks webapp regression coverage).
  - **Next step.** Phase 3 task 5 in 05-action-plan.md.

- **Opportunity.** Pin reference captures to a specific git sha so future regenerations compare apples to apples.
  - **Who spotted it.** W2C.
  - **Severity.** P3.
  - **Next step.** Record `commit` in `fixture.json` capture-ref metadata.

### Documentation drift and discipline

- **Opportunity.** `engine/generate/builder-prompts.ts:586` still contains a `Chrome MCP` reference inside builder-prompt output. File is marked for deletion in V2.0 Phase 2 but still active until then.
  - **Who spotted it.** W1B.
  - **Severity.** P2 (any active builder run leaks the legacy reference into LLM prompts).
  - **Next step.** Complete the planned deletion.

- **Opportunity.** `package.json` still declares `next`, `react`, `react-dom`, `tailwind-merge`, `tw-animate-css`, `shadcn`, `lucide-react`, `geist`, `@base-ui/react`, `class-variance-authority`. None used by engine.
  - **Who spotted it.** W1A.
  - **Severity.** P1 (smaller install graph means faster CI, fewer false-positive security alerts).
  - **Next step.** Drop in a Phase 2 dependency prune commit.

- **Opportunity.** `package.json` still declares `dev`, `build`, `start`, `lint` npm scripts that reference non-existent tools. W4B kept them for PR-template compatibility.
  - **Who spotted it.** W1A, W1B, W4B.
  - **Severity.** P2.
  - **Next step.** Update PR template, then drop the broken scripts.

- **Opportunity.** 11 one-off probe scripts (`auth-verify`, `login-omni`, `inspect-live`, `inspect-selector-resolution`, `verify-clone`, `verify-interactions`, `verify-key-clicks`, `verify-key-clicks-v2`, `verify-posts-menu`, `verify-tabs-and-toasts`, `verify-toast`) pin to external `omnichannel-clone` or omnisocials. Cannot function in-repo.
  - **Who spotted it.** W1A.
  - **Severity.** P2 (signal-to-noise in `scripts/`).
  - **Next step.** Cameron decides: delete all 11 or move to `scripts/_omnichannel-probes/`.

- **Opportunity.** `engine/types/index.ts:5` JSDoc still references `@/../../engine/types` (stale Next.js alias).
  - **Who spotted it.** W1A.
  - **Severity.** P3.
  - **Next step.** One-line fix.

- **Opportunity.** `scripts/check-astro-emit.ts` defines `runFixturePostMain`, `runFixtureInterstitial`, `runFixtureTwoSections` but `run()` never invokes them.
  - **Who spotted it.** W1C.
  - **Severity.** P3.
  - **Next step.** Wire them into the default invocation.

### Engine type baseline

- **Opportunity.** 15 unsolved tsc errors in active engine code (CSS classifier, scope-styles, astro/react emitters, webapp toggle inference). Predate V2.0.
  - **Who spotted it.** W1A.
  - **Severity.** P1 (blocks CI gate hardening; cannot tighten `tsc --noEmit` to zero until cleared).
  - **Next step.** Dedicated tsc-fix agent task, file by file.

## Anomalies and surprises

- **iCloud ghost / half-staged files.** W1B observed 38 staged-as-added files in the index that origin commit `3b4efd2` had deleted. Working tree contained the files and the index pointed to them. W1B did not touch them per the "stop if unfamiliar" rule.
- **Mid-orchestrated-merge churn.** W2A's staged work was blown away mid-commit by an iCloud reconciliation. W2A's commit ended up absorbed into the W2B commit (`2ba8f05`) under the wrong commit message ("feat(react): post-emit-multi-react with css extract and media preserve") but contents are intact on disk.
- **Parallel agent file collision on `scripts/clone-urls.ts`.** W2B and W2A both edited the file. W2B restored to HEAD, applied isolated react diff, left W2A's untracked work alone. Final commit needed W2A to re-add webapp wiring.
- **W4B in-flight edits reverted between turns.** During subprocess removal step, several Edit operations on `parse-har.ts`, `parse-trace.ts`, `clone.ts`, `complete-assets.ts` reverted. Suspect background formatter or interleaved W4A activity. W4B re-applied cleanly with no content lost.
- **First `npm install` reported 576 packages added but `citty/` did not actually land in `node_modules/`.** Subsequent explicit `npm install citty@0.2.2 --save` succeeded. Possible phantom resolution against a hoisted copy inside `clones/*/node_modules/`. (W1D)
- **`npm install` pollution.** Stashed installs in `clones/app.omnisocials.com-*/node_modules/` and `docs/research/captures/.../node_modules/` add ~4380 spurious tsc errors. Source-only baseline is 15. (W1D)
- **Audit line refs were stale.** W2A found `crawlDir` cast at line 97, not the audit's cited line 117. W1C found audit's `L193-204` was the wrong block. W2A also found `scripts/build.ts` lines 322-325 do not handle `--crawl-dir` despite audit 03 §1 claiming it does.
- **Apple tile-subdivision fix is missing.** W1C grep across `engine/targets/shared/` returned zero matches for tile or subdivide. Audit references it but no such code at HEAD. Cameron to confirm intent.
- **No vivre.agency react rebuild exists.** Action plan called for vivre as the react fixture candidate but on-disk captures are astro (WordPress static HTML). (W2C)
- **Baseline tsc count reads as 16 not 15 on prototype-mode HEAD.** W2C reported the discrepancy. W4A and W4B both filtered `clones/` and `docs/research/` and held at 15.
- **`scripts/clone-page.ts` is a live `npm run` target but the reconciled plan flags it for deletion.** W1A left it in place. (Plan vs reality disagree.)
- **CLAUDE.md shown in W1B's task prompt was longer than the on-disk file.** Prompt assembled from multiple sources, not a literal file read. On-disk version is 129 lines.

## Decisions that need Cameron's input

- **scripts/extract.ts and animation-monitor salvage.** W1A flagged this as open question #2 from audit 02. A one-line answer ("discard, the new `engine/extract/capture/` chain covers it" or "port to `capture/animation-monitor.ts` first") unblocks ~12 more file deletions and the deletion of `engine/extract/playwright/`.
- **iCloud ghost staged-add files.** W1B did not act. Either `git reset` to unstage and let Phase 1.A delete the working-tree copies, or `git rm --cached` each one. Cameron's call.
- **11 omnichannel-clone / omnisocials probe scripts.** W1A left them on disk. Delete all 11, or move to `scripts/_omnichannel-probes/`?
- **Apple tile-subdivision fix.** W1C found no such code at HEAD. Was the fix intentionally reverted, or is it missing from the branch?
- **`scripts/clone-page.ts` resolution.** W1A flagged plan-vs-reality disagreement. Either keep it and remove the deletion flag, or delete it with the package.json entry in a single commit.
- **V1 rebuild-based comparison vs current manifest-shape mode.** W2C's V0 corpus locks structural manifests. V1 needs per-viewport baselines and the rebuild path; scope and timing is Cameron's call.
- **Two transient TS errors during the wave.** W4A noted W4B's in-flight `scripts/run-clone.ts` changes added two TS errors mid-run; both resolved before tagging. Verified by stashing each agent's diff in isolation; W4A clean, W4B clean separately. The two-error window existed only during the merge moment.
- **W3 deferred items 6 and 7.** Both picked up by W4B. Resolved.
- **`run-clone-stage.ts` outer subprocess shim.** Both W3 and W4B flagged it as the last subprocess boundary. W4B left intact to preserve W3's smoke test wiring. Cameron decides if Wave 5 picks this up.

## V2.0 final state checklist

| Item | Status | Evidence |
|---|---|---|
| v2.0.0 tag created | done | `git tag -l v2.0.0` present at `ace4347`. Not pushed. |
| parity CLI ships subcommands | done | `bin/parity.ts` exposes `clone`, `capture`, `parse`, `clone-static`, `targets`, `runs`, `test`, `version`. 8 subcommands total (brief asked for 7; `test` added by W2C). |
| `.runs/` durable record system | done | `engine/cli/{event-stream,run-manifest,context,summary-writer,run-clone-stage}.ts`. `parity clone` writes the full record. |
| Regression corpus | done | 2/2 passing. `npx parity test` returns "2 passed, 0 failed, 0 skipped, 2 total". |
| Astro byte-identity preserved | done | W1C verified sha256 across 13 fixtures; `diff -rq before after-astro-single` zero output. `npm run check:astro-emit` PASS. |
| React pixel diff improvement on apple.com | done | 30.561 pct to 18.621 pct (W2B). 11.94 pp absolute, ~39 pct relative. Still above 5 pct threshold so FAIL persists; gain is real. |
| TS baseline 15 held throughout | done (with caveats) | Every wave verified 15 on tracked code. Two transient errors during the W4A/W4B overlap (resolved before tag). W2C noted prototype-mode HEAD reads as 16 unfiltered; filtering `clones/` and `docs/research/` returns 15. |
| Chrome MCP retired everywhere | partial | All user-facing docs clean. `engine/generate/builder-prompts.ts:586` still emits "Chrome MCP" at runtime; file is marked for Phase 2 deletion. |
| No-regression discipline operationalised | done | `parity test` gate green. All five astro smoke checks (`check:astro-emit`, `check:refactor`, `check:prettify`, `check:scope-styles`) green at every wave boundary. |
| Webapp post-emit pipeline | done | `engine/orchestrator/post-build/post-emit-multi-webapp.ts` with five phases. Smoke test green on omnisocials clone. Full Playwright phases not exercised end-to-end (would require live `vite preview` boot). |
| Subprocess removal at script level | done | 10 spawn calls inside `run-clone.ts` and `clone-urls.ts` replaced. Outer `run-clone-stage.ts` shim retained. |
| Canonical output paths | done | Default `clones/<target>/<iso>/{captures,parsed,sites/<target>,...}`. `--legacy-output` fallback intact. |
| Harvest loop | done | `parity runs harvest` ships. 5 finding kinds, P1/P2/P3 severity, idempotent. Smoke test green. |
| SKILL.md rewrite | done | 522 lines to 96. Both `.claude/` and `.github/` skill copies updated. Zero Chrome MCP references in body (only blockade mentions). |
| 8 npm shims removed | done | `generate:*`, `parse:all`, `build:*:multi`, `clone-end-to-end`. Conservative cut; `dev/build/start/check` kept. |
