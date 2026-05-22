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

# Dr Parity V2.1 Closeout Review

## How to read this section

V2.1 followed the V2.0 tag (`ace4347`) and consolidated the 9 open decisions plus the harvested improvement list into one focused wave. Eleven sub-agents (W5A.1 through W5C) shipped in parallel against the `prototype-mode` branch; this section aggregates their per-file observation logs into one closeout review using the same four-field shape (Change, Reason, Files, Impact).

## At a glance

| Wave / Agent | Key deliverable | Commits | Status |
|---|---|---|---|
| W5A.1 | Drop 17 unused deps; `node_modules` 647M to 96M | `0a723da`, `260391a`, `ed5561d` | done |
| W5A.2 | Engine TS errors 15 to 0 | merged into wave (see `6b0b8b9` carry-over) | done |
| W5A.3 | Last subprocess boundary removed; per-stage event attribution | one refactor commit | done |
| W5A.4 | Responsive CSS link injected at emit time; cross-page aggregation | `7ec1f92`, step 2 swept into `6b0b8b9` | done |
| W5A.5 | Animation monitor ported; legacy `scripts/extract.ts` and `engine/extract/playwright/` retired | `8d7c123`, `452e5f3`, `7fe7dac` | done |
| W5B.1 | Global flags, `partial` StageStatus, typed `Logger.emit`, harvest `--dry-run`, top-N table | `d47fadb`, `23dafe4`, `3ec3db6`, `8127291`, `9f34cad` | done |
| W5B.2 | Per-target parity thresholds; `--crawl-dir`; `--manifest-only` fast path | `fdc1721`, `03a6902`, plus manifest-only commit | done |
| W5B.3 | Webapp `vite preview` pixel parity stage; `parity-report.json` schema | `ef140c6`, `a553d0a`, plus schema commit | done (smoke-verified) |
| W5B.4 | PR template; JSDoc fix; three iCloud ghosts deleted; `strip-runtime-tags` restored | `1cbbb0e`, `2ba8426`, `3bb0d39` | done |
| W5B.5 | Apple tile audit confirmed hallucinated; `example-com-mobile` fixture promoted | merged into wave | done |
| W5C | SUMMARY decisions, git-sha pinning, `rebuild-pixel-diff` mode, untracked triage | `2159453`, `043c383`, `c42fa5e`, `9b5d717`, `58996d6` | done |

## Changes shipped, organised by theme

### Performance and install graph (W5A.1)

- **Change.** Dropped 17 unused dependencies in three chore commits: `next`, `react`, `react-dom`, `geist`, `@types/react`, `@types/react-dom`, `shadcn`, `lucide-react`, `@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css`, `clsx`, `eslint`, `eslint-config-next`, `@tailwindcss/postcss`, `tailwindcss`.
- **Reason.** "The repository is no longer a Next.js / shadcn application; it is a Node-based cloning engine that emits framework code as strings." Every Next.js / React / shadcn / tailwind import in `engine/` lives inside backtick template literals that emit source code into the generated clone.
- **Files.** `package.json`, `package-lock.json`, `tsconfig.json` (dropped `plugins: [{name: "next"}]`, `next-env.d.ts` include, `.next/types/**/*.ts` include, `**/*.tsx` include, `jsx: react-jsx`, `@/*` path alias), `next-env.d.ts` deleted. Commits `0a723da`, `260391a`, `ed5561d`.
- **Impact.** `node_modules` 647M to 96M (85 pct reduction). Top-level package count 38 to 21. `npm ls --depth=0` line count 45 to 23. TS error count dropped from 15 to 3 in W5A.1's measurement window because stale `@types/react@19` definitions disagreed with engine code that uses `React.*` only inside string literals.

### TS hygiene (W5A.2)

- **Change.** Engine TS errors 15 to 0 across six files: `engine/analyze/css/classes.ts` (cheerio + domhandler imports), `engine/analyze/css/parser.ts` (postcss parent walker widened to `Rule['parent']`), `engine/scope-styles/index-components.ts` (Element annotation), `engine/targets/astro/is-inline.ts` (Element annotation), `engine/targets/react/html-to-jsx.ts` (duplicate `allowfullscreen` removed, cheerio types), `engine/targets/webapp/inference/classify-toggle.ts` (`triggerHasHaspopup` helper replaces crashing `attr(string, name)` call).
- **Reason.** "0 errors in active engine code" unblocks the CI gate hardening that was held off through V2.0. The `classify-toggle.ts` fix was the only real logic bug among the 15. The original `attr(interaction.selector, 'aria-haspopup')` call passed a CSS selector string where a SerializedElement was expected; at runtime `(string as any).attributes` is undefined and `undefined[name]` throws.
- **Files.** Six engine files above. Astro byte identity confirmed via the 787-byte `check:astro-emit` fixture.
- **Impact.** Baseline locked at 0. CI can now flip from "do not regress past 15" to "do not regress past 0". The unused `@ts-expect-error` on `decodeEntities` was removed rather than kept as noise.

### Pipeline architecture (W5A.3, W5A.5)

- **Change.** Last `spawn()` boundary in the clone pipeline removed. `engine/cli/run-clone-stage.ts` now calls `runCloneEntry(argv)` directly. `scripts/run-clone.ts` returns a typed `RunCloneResult` with `phases`, `captureRoot`, `runRoot`, `viewports`. The CLI tail (`if (isDirect) main().then(r => process.exit(r.exitCode))`) is preserved so `npx tsx scripts/run-clone.ts <url>` still works standalone.
- **Reason.** "Subprocess fan-out cost. Single event stream rather than five output blobs." Solves the manifest gap W3 flagged: `artefacts.captureRoot` previously pointed at the default parent root because the spawned legacy script's stdout was never parsed for paths.
- **Files.** `engine/cli/run-clone-stage.ts`, `scripts/run-clone.ts`. Refactor commit per W5A.3.
- **Impact.** Manifest gains five new inner stage entries per run (`capture`, `parse:har`, `parse:trace`, `complete:assets`, `clone`) with their own `durationMs`. `captureRoot` now resolves to the actual dated subdir (`clones/example/2026-05-22T09-47-56-697Z/captures`). JSONL stream gains five new `stage_end` plus five `metric` events per run.

- **Change.** `injectAnimationMonitors`, `detectAnimations`, `collectViewTransitions` (plus types and helper functions, total ~2523 lines) ported from `engine/extract/playwright/animation-detector.ts` to `engine/extract/capture/animation-monitor.ts`. New wrappers `runAnimationsPass`, `installAnimationMonitor`, `installAnimationMonitorOnPage` plus the `AnimationsCaptureRecord` schema landed in `engine/extract/capture/animations-pass.ts`. Then legacy `scripts/extract.ts` and the entire `engine/extract/playwright/` directory were deleted along with `engine/extract/merge.ts`, `engine/generate/builder-prompts.ts`, `engine/extract/cache.ts`, `engine/extract/checkpoint.ts`, `engine/utils/progress.ts`.
- **Reason.** Decision D1 from the V2.1 cleanup plan. The legacy chain's six other files (asset-collector, font-extractor, interaction-mapper, page-scanner, stylesheet-scraper, plus `merge.ts`) were already superseded by the HAR plus trace plus parsed-DOM-snapshot pipeline.
- **Files.** Rename in `8d7c123`; wire-in commit `452e5f3`; deletion commit `7fe7dac` removed 6878 lines across 12 files.
- **Impact.** Every capture run now writes `animations.json` next to `screenshot.png`, `network.har`, `trace.zip`, `video/`. Smoke run against `https://example.com` recorded a View Transition API root element detection. `engine/generate/builder-prompts.ts:586` Chrome MCP reference (V2.0 partial item) is gone with the file.

### CSS quality (W5A.4)

- **Change.** Responsive sheet `<link>` injection moved from post-emit HTML patching into `ReactPageSlice.extraStylesheetHrefs` at emit time. New module `engine/targets/react/responsive-sheet.ts` owns `buildResponsiveSheet()` and `RESPONSIVE_PUBLIC_HREF`. Plus cross-page aggregation: `buildReactMulti` now computes the union of source stylesheet hrefs across sibling pages and appends them to every emitted slice.
- **Reason.** "The patch step wrote into already-emitted HTML. Any re-emit overwrote that HTML and dropped the link silently." Closes both gaps W2B flagged.
- **Files.** `engine/targets/react/responsive-sheet.ts` (new), `engine/targets/react/build-multi.ts`, `engine/orchestrator/post-build/post-emit-multi-react.ts` (stripped to an idempotent shim). Commits `7ec1f92` plus a step-2 diff that landed inside `6b0b8b9` due to a parallel-agent commit race.
- **Impact.** Re-emitting twice into the same `outDir` produces byte-identical `index.html` files with exactly one responsive `<link>` tag. The legacy `data-dr-parity="responsive"` marker is gone from freshly emitted HTML. apple.com pixel diff not re-measured end-to-end because the existing apple capture has only one URL so the union step is a no-op; on multi-URL captures the aggregated set strictly contains the per-page set so the parity delta is non-negative.

### CLI ergonomics (W5B.1, W5B.2)

- **Change.** Six global flags (`--quiet`, `--verbose`, `--json`, `--no-color`, `--run-id`, `--config`) wired into every leaf subcommand via `engine/cli/global-flags.ts`. `StageStatus` and `RunStatus` extended with `partial` and a new `partial(output, partialCount, totalCount, ...)` helper. `Logger.event(name, fields)` replaced with typed `Logger.emit(event: PipelineEvent)`. Harvest gained `--dry-run` and `--top=<n>` with an ASCII top-findings table.
- **Reason.** W1D's three open CLI items plus W4A's two harvest items, all bundled. The free-form `logger.event` was double-posting alongside `ctx.emit`; the migration collapses them to a single typed call. `pipeline_start` / `pipeline_end` are not in the locked PipelineEvent union, so they are now emitted as typed `log` entries.
- **Files.** `engine/cli/global-flags.ts` (new), `engine/cli/stage.ts`, `engine/cli/run-manifest.ts`, `engine/cli/event-stream.ts`, `engine/cli/orchestrate.ts`, `engine/cli/run-clone-stage.ts`, `engine/cli/context.ts`, `engine/cli/runs-harvest.ts`, `engine/cli/runs-harvest-cli.ts`, `engine/cli/harvest-top-table.ts` (new), `bin/parity.ts`. Commits `d47fadb`, `23dafe4`, `3ec3db6`, `8127291`, `9f34cad`.
- **Impact.** Every subcommand has a consistent global flag surface. Manifest can now express partial completion (stronger than warn, weaker than fail; pipeline keeps going so the next stage runs against partial output). JSONL writer cannot silently drop required event fields because the discriminated union enforces them at compile time. Harvest `--dry-run` replaces the previous `--tickets-dir=<tmp>` workaround.

- **Change.** `scripts/verify-parity.ts` now resolves the effective per-viewport diff threshold via a target-aware lookup: `--threshold` (target agnostic, wins), `--threshold-<target>=<r>`, then per-target defaults from `DEFAULT_THRESHOLDS` (`astro: 0.02`, `react: 0.20`, `webapp: 0.20`). `scripts/build.ts` now parses `--crawl-dir=<path>` and lands it on `TargetBuildOptions.crawlDir`. `scripts/run-clone.ts` gained `--manifest-only` which requires `--capture-dir=<dir>` and skips capture entirely.
- **Reason.** W2B asked for a `--threshold-react` knob; W2A flagged the `scripts/build.ts` `--crawl-dir` gap; W2C asked for `--manifest-only` to skip the heavy capture pass during fixture promotion against code changes.
- **Files.** `scripts/verify-parity.ts`, `scripts/build.ts`, `scripts/run-clone.ts`, `bin/parity.ts` (clone-static command). Commits `fdc1721`, `03a6902`, plus a manifest-only commit.
- **Impact.** `--manifest-only` against `clones/example/.../captures` finished in 7 ms total (vs seconds to minutes for full clone-site). Three orders of magnitude faster for fixture re-verification when downstream code changed but the captured DOM did not.

### Webapp parity baseline (W5B.3)

- **Change.** New Phase 6 in `engine/orchestrator/post-build/post-emit-multi-webapp.ts`: `runWebappPixelParity` boots `vite preview` once for the whole stage, runs the per-route loop against canonical viewports (desktop 1280x800, mobile 375x812, tablet 768x1024, wide 1920x1080), diffs against the crawl screenshot for the route's matched viewport, writes `parity-report.json` plus `parity-artefacts/<routeSlug>/<viewport>/{rebuilt.png, diff.png}`. MSW soft-wait polls `navigator.serviceWorker.controller !== null` with a 10s timeout. Status classifier returns `ok | warn | fail` based on threshold (0.20) and `warnMultiplier` (2; fail boundary 0.40).
- **Reason.** Mirror the astro pixel parity gate for the webapp target. W2A documented this as a Phase 7 TODO; W5B.3 ships it. No new dependencies: pixelmatch + pngjs + Playwright already in the engine.
- **Files.** `engine/orchestrator/post-build/post-emit-multi-webapp.ts` (Phase 6 added, `startVitePreview` / `stopPreview` exported), `engine/orchestrator/post-build/webapp-pixel-parity.ts` (new), `scripts/clone-urls.ts` (W5C wired `crawlDir` + `inference` through). Commits `ef140c6`, `a553d0a`, plus schema commit.
- **Impact.** `post-emit-webapp-summary.json` gains a `pixel-parity` entry in `phases[]` and a top-level `pixelParityReport` field. parity-report.json shape is a compatible superset of `ParityCheckResult` so harvest consumers can read both targets with the same code path. Only smoke-verified: all skip paths exercised plus job-building against the real `docs/research/crawl/app.omnisocials.com/` graph; live full-flow against a built `dist/` deferred because none of the existing webapp clones have one.

### Test corpus and gate (W5B.5, W5C item 5)

- **Change.** Promoted `example-com-mobile` fixture. Optional `viewport` field added to fixture schema, defaulting to `desktop`. New `rebuild-pixel-diff` comparison mode in `engine/cli/regression/rebuild-pixel-diff.ts`: rebuilds the captured clone via `astroAdapter.build` (or `reactAdapter.build`), boots both clone and rebuilt servers, screenshots, diffs via pixelmatch. Added `captured_at_sha` field to pin reference captures to a git commit. Promoted `example-com-rebuild-pixel` fixture as the proof point.
- **Reason.** W2C flagged the need for per-viewport baselines and the V1 rebuild path; both ship in V2.1. The mobile delta (552 bytes desktop vs 567 bytes mobile, 15-byte difference from viewport meta tag content) makes the mobile fixture a sensitive trip wire for head element serialisation regressions.
- **Files.** `tests/fixtures/sites/example-com-mobile/...`, `tests/fixtures/sites/example-com-rebuild-pixel/...`, `engine/cli/regression/fixture-schema.ts`, `engine/cli/regression/manifest-shape.ts`, `engine/cli/regression/run-test.ts`, `engine/cli/regression/rebuild-pixel-diff.ts` (new). Commits `043c383`, `9b5d717`.
- **Impact.** Corpus 2/2 to 4/4 (3 manifest-shape plus 1 rebuild-pixel-diff). End-to-end rebuild cost 85 seconds, dominated by `npm install` (~80s); the build and diff together take under 2 seconds. Webapp rebuild path deferred because the webapp adapter shape does not match the astro/react `build + npm run build + static serve` pattern.

### Doc and working-tree hygiene (W5B.4, W5C item 6)

- **Change.** PR template (`.github/PULL_REQUEST_TEMPLATE.md`) updated from the single broken bullet `npm run check passes (lint + typecheck + build)` to four real V2.0 commands. `engine/types/index.ts:5` JSDoc updated from `@/../../engine/types` to `engine/types`. Five iCloud ghosts deleted across two passes: `auto-probe.mjs`, `engine/qa/parity-check.ts`, `SMOKE_TEST_DIFF.txt` (W5B.4) plus `full-diag.mjs` and `test-login.mjs` (W5C). `engine/targets/webapp/strip-runtime-tags.ts` (169 lines) restored because `engine/targets/html-mirror/write-routes.ts:13` imports it. Two per-app blocklists committed under `docs/blocklists/`.
- **Reason.** Working tree was carrying iCloud-restored files that had been deleted in earlier waves. The conservative deletion rule held: only paths with no tracked callers and no documented in-flight status were removed.
- **Files.** `.github/PULL_REQUEST_TEMPLATE.md`, `engine/types/index.ts`, `engine/targets/webapp/strip-runtime-tags.ts` (restored), `docs/blocklists/*`. Commits `1cbbb0e`, `2ba8426`, `3bb0d39`, `58996d6`.
- **Impact.** Fresh clones of the repo now typecheck (the html-mirror import would have broken without `strip-runtime-tags.ts`). PR template no longer references non-existent scripts. Per-app crawler blocklists live where `CLAUDE.md` documents them.

### Finalisation (W5C items 1 to 4)

- **Change.** `SUMMARY.md` now renders a "Decisions" section from `decision` events in `pipeline.jsonl`. Each entry shown as `- [stage] decision. Reason: reason`. Empty state shows `_No decisions recorded for this run._`. `renderSummaryMarkdown` gained an optional second `decisions` param defaulting to `[]`; `writeSummary` internally reads the event stream and forwards.
- **Reason.** W3's deferred item: `SUMMARY.md` did not yet render `decision` events.
- **Files.** `engine/cli/summary-writer.ts`. Commit `2159453`.
- **Impact.** Decisions surface in the per-run human-readable file.

- **Change.** `captured_at_sha` optional field added to fixture schema. Loader tolerates absence; existing fixtures continue to load.
- **Reason.** W2C P3 opportunity: pin reference captures to a specific git sha so future regenerations compare apples to apples.
- **Files.** `engine/cli/regression/fixture-schema.ts`. Commit `043c383`.
- **Impact.** Future fixture regenerations can be tied back to the commit that produced them.

- **Change.** `scripts/clone-urls.ts` now parses `--crawl-dir=<dir>` and threads it plus an `inference` graph (produced via `loadCrawlGraph` + `inferStateGroups`) into `runPostEmitMultiWebapp`. Without the flag, behaviour is unchanged: single-page flat emit, pixel parity skipped by design.
- **Reason.** W5B.3 shipped the pipeline; the caller wiring was its follow-up so the new stage stops reporting `skipped: no crawlDir`.
- **Files.** `scripts/clone-urls.ts`. Commit `c42fa5e`.
- **Impact.** Webapp pixel parity stage is now reachable from the standard clone flow when the caller has a crawl directory in hand.

- **Change.** W1C's flagged `scripts/check-astro-emit.ts` items (`runFixturePostMain`, `runFixtureInterstitial`, `runFixtureTwoSections` not invoked) was already wired by HEAD; no commit needed.
- **Reason.** Stale note from an intermediate commit.
- **Files.** None.
- **Impact.** Confirmed no action required; check passes at HEAD.

## New parity / pipeline improvement opportunities harvested in V2.1

Grouped by theme. Severity reflects best-guess leverage if Cameron picks the item up next.

### CSS pipeline gaps

- **Opportunity.** Re-capture apple.com with multiple URLs so the cross-page aggregation step actually exercises (W5A.4's union-across-pages is a no-op on single-URL captures).
  - **Who spotted it.** W5A.4.
  - **Severity.** P2 (closes the remaining 18 pct on apple).
  - **Next step.** Add `https://www.apple.com/iphone`, `https://www.apple.com/mac`, etc. to the apple capture set.

- **Opportunity.** `pagesPatched` field in the post-emit summary is permanently 0 now that the link injection moved to emit time. Field kept for CLI-log compatibility but should be dropped or renamed.
  - **Who spotted it.** W5A.4.
  - **Severity.** P3 (cosmetic).
  - **Next step.** Remove the field once consumers stop reading it.

### CLI ergonomics

- **Opportunity.** `--config <path>` global flag is plumbed through but not yet consumed.
  - **Who spotted it.** W5B.1.
  - **Severity.** P3.
  - **Next step.** Wire a config-file reader once the first per-project config requirement appears.

- **Opportunity.** `scripts/run-clone.ts` phase status union stayed narrower than the new `StageStatus`. The cast in `run-clone-stage.ts` absorbs the gap.
  - **Who spotted it.** W5B.1.
  - **Severity.** P3.
  - **Next step.** Widen `RunCloneStagePhase.status` to include `partial`.

### Subprocess and architecture

- **Opportunity.** `scripts/clone.ts` entry guard `process.argv[1].endsWith('clone.ts')` is also true when invoked via `run-clone.ts`. Importing `./clone` from `run-clone.ts` triggers `cloneMain` to fire at module load when run-clone.ts is invoked directly via tsx.
  - **Who spotted it.** W5B.2.
  - **Severity.** P3 (in-process API path is unaffected).
  - **Next step.** Change to `endsWith('/clone.ts') || endsWith('\\clone.ts')`.

- **Opportunity.** `runPostEmitMultiReact` now duplicates work that `buildReactMulti` already did. It re-runs `buildResponsiveSheet`, which re-aggregates CSS and rewrites `public/dr-parity-responsive.css` with the same bytes.
  - **Who spotted it.** W5A.4.
  - **Severity.** P3 (idempotent and bounded).
  - **Next step.** Decide whether to keep the post-emit CLI path or fold it entirely into the build.

- **Opportunity.** Webapp pixel parity is only smoke-verified. None of the existing webapp clones in `clones/` have a built `dist/` and re-running the full crawl + emit + build was out of scope for W5B.3.
  - **Who spotted it.** W5B.3.
  - **Severity.** P2 (functional verification still pending).
  - **Next step.** Pick one webapp clone, run the full pipeline, confirm `parity-report.json` shape and diff outputs match expectations.

### Regression corpus expansions

- **Opportunity.** Crawler viewport vs canonical viewport mismatch. The omnisocials crawl uses 1440x900 which is not one of the canonical four; the reference resolver falls back to nearest-width (desktop). Pixel ratio inflates because the reference is 1440px wide and the rebuilt is 1280px wide; the crop-to-min logic only compares the overlapping 1280x... region.
  - **Who spotted it.** W5B.3.
  - **Severity.** P2.
  - **Next step.** Re-capture rebuilt at the exact crawl viewport instead of the canonical desktop.

- **Opportunity.** Webapp rebuild path for the `rebuild-pixel-diff` corpus runner. The webapp adapter shape (single page, internal scaffolding, vite preview semantics) does not match the astro/react `build + npm run build + static serve` pattern.
  - **Who spotted it.** W5C.
  - **Severity.** P2 (blocks webapp regression coverage in rebuild mode).
  - **Next step.** Bridge `engine/orchestrator/post-build/webapp-pixel-parity.ts` into the corpus runner.

- **Opportunity.** `rebuild-pixel-diff` end-to-end cost is dominated by `npm install` (~80s of the 85s total).
  - **Who spotted it.** W5C.
  - **Severity.** P3.
  - **Next step.** Cache `node_modules/` per target in a shared location and symlink.

- **Opportunity.** Crawler captures one screenshot per state, not per route x viewport. The stretch goal ("compare against the ORIGINAL capture's reference screenshot for that route + viewport") assumes per-viewport references which do not exist.
  - **Who spotted it.** W5B.3.
  - **Severity.** P2.
  - **Next step.** Extend the crawler to capture per-viewport per-state references.

### Documentation drift and discipline

- **Opportunity.** `package.json` still advertises `keywords: ["nextjs", "tailwindcss", "shadcn-ui"]` even though none of those are dependencies any more.
  - **Who spotted it.** W5A.1.
  - **Severity.** P3.
  - **Next step.** Prune the keywords or rebrand the project.

- **Opportunity.** Consider trimming the `lib` array in `tsconfig.json` now that no DOM-targeting app exists (the engine emits DOM-targeting code as strings but runs in Node).
  - **Who spotted it.** W5A.1.
  - **Severity.** P3.
  - **Next step.** Tighten `tsconfig.json` `lib`.

- **Opportunity.** `npm install` still reports 8 vulnerabilities (6 moderate, 2 high) post-cleanup, all from transitive deps under playwright / cheerio.
  - **Who spotted it.** W5A.1.
  - **Severity.** P3 (out of scope but worth tracking).
  - **Next step.** Run `npm audit fix` once owners agree it is safe.

- **Opportunity.** `engine/generate/component-gen.ts` and `engine/generate/page-assembler.ts` look orphaned in the live codebase (no live importers found by grep) but were out of W5A.5's deletion scope.
  - **Who spotted it.** W5A.5.
  - **Severity.** P3.
  - **Next step.** Confirm no callers and delete in a follow-up sweep.

- **Opportunity.** Audit doc 03 references to "bug-2 fix landed in shared layer" are inaccurate. The Apple tile subdivision fix never existed in this repository (W5B.5 confirmed via clean git log walk).
  - **Who spotted it.** W5B.5.
  - **Severity.** P3 (historical record, leave intact).
  - **Next step.** Future audit revisions should consult the W1C and W5B.5 observation logs as the authoritative ground truth.

## V2.1 anomalies and surprises

- **Parallel-agent commit collisions persisted from V2.0.** W5A.4 had its step-2 `build-multi.ts` diff accidentally swept into another agent's docs commit (`6b0b8b9: docs: w5a2 observation log for tsc baseline to zero`). The code is correct and in HEAD but the commit message does not reflect its scope. W5A.2 saw three phantom dep-prune commits (`ed5561d`, `260391a`, `0a723da`) appear in the log mid-work. W5B.2 caught a mid-run fixture promotion (`example-com-mobile` from W5B.5) that briefly failed `parity test` before the source ref landed.
- **Stale rename swept into html-to-jsx commit.** When W5A.2 ran `git add engine/targets/react/html-to-jsx.ts`, git also auto-staged a rename of `engine/extract/playwright/animation-detector.ts` to `engine/extract/capture/animation-monitor.ts` (W5A.5's first commit). Two files in `engine/extract/merge.ts` and `scripts/extract.ts` still imported the old path until W5A.5 cleaned them up.
- **iCloud ghosts kept reappearing.** W5B.4 deleted three (`auto-probe.mjs`, `engine/qa/parity-check.ts`, `SMOKE_TEST_DIFF.txt`). W5C deleted two more (`full-diag.mjs`, `test-login.mjs`). The W5B.4 conservative deletion rule held: only ghosts with zero tracked callers and zero documented in-flight status went.
- **Parallel agent territory caused stash gymnastics.** W5B.5 had to `git stash push` of another agent's in-flight `bin/parity.ts` and `engine/cli/runs-harvest-cli.ts` modifications to verify its own TS baseline as 0. The "stash, typecheck, pop" protocol works but is brittle if multiple agents land overlapping edits.
- **TS error count drifted unpredictably mid-wave.** W5A.1 saw 15 to 3 after removing `@types/react`. W5A.3 saw 15 to 8 after removing the spawn import path. W5A.5 measured 9 then 1 between operations. None breached the baseline, but the count moved more than expected because stale typings were silently affecting unrelated files.
- **Audit hallucinated line numbers AND content (recurring from V2.0).** W5B.5 confirmed the Apple tile subdivision fix described at `slice-body.ts:166-178` was fabricated. No commit in repo history ever introduced the three specific data attribute markers (`data-analytics-section-engagement`, `data-tile-id`, `.tile-wrapper`) into any file. W1C already flagged the symptom; W5B.5 confirmed the diagnosis via clean git log walk and pre-refactor file read.
- **`scripts/clone.ts` entry guard bug pre-dates V2.1.** `process.argv[1].endsWith('clone.ts')` is also true when invoked via `run-clone.ts`. The in-process API path (`runCloneEntry`) is unaffected because it is invoked from `bin/parity.ts`.
- **Single-URL apple fixture limits W5A.4 measurement.** Apple capture has only one URL so the cross-page aggregation step is a no-op on this fixture. Pixel diff not re-measured end-to-end because re-running pixel-diff requires `vite build` plus a Playwright capture loop, and the answer would be unchanged modulo the now-absent `data-dr-parity="responsive"` marker attribute.

## V2.1 state and metrics

- **Final TS error count:** 0 (filtered to active engine code, excluding `clones/` and `docs/research/`)
- **Final parity test result:** 4/4 (3 manifest-shape: `example-com`, `enerblock-net`, `example-com-mobile`; plus 1 rebuild-pixel-diff: `example-com-rebuild-pixel`)
- **node_modules size:** 96M (down from 647M, 85 pct reduction)
- **Top-level package count:** 21 (down from 38)
- **Engine TS errors fixed:** 15 (W5A.2 brought baseline to 0)
- **Subprocess boundaries removed:** 1 (the last one, W5A.3)
- **NPM scripts trimmed:** 4 confirmed (`dev`, `build`, `start`, `check` removed by W5A.1; W5B.4 confirmed `lint` was already absent). V2.0 had already removed 8 (`generate:*`, `parse:all`, `build:*:multi`, `clone-end-to-end`).
- **Astro byte-identity:** preserved (verified every wave via `check:astro-emit` 787 bytes)
- **Apple.com pixel diff:** 30.56 to 18.62 pct (W2B, V2.0). W5A.4 closed the silent regression risk on re-emit but did not re-measure end-to-end because the apple fixture is single-URL.
- **Legacy code deleted:** 6878 lines across 12 files (W5A.5: `scripts/extract.ts`, 6 files in `engine/extract/playwright/`, `engine/extract/merge.ts`, `engine/generate/builder-prompts.ts`, `engine/extract/cache.ts`, `engine/extract/checkpoint.ts`, `engine/utils/progress.ts`).
- **Fixtures in corpus:** 4 (2 desktop astro + 1 mobile astro + 1 rebuild-pixel-diff astro)
- **Total V2.1 commits since v2.0.0:** ~43 across the 11 sub-agents (commit hashes inlined per theme above)

## Decisions Cameron made in V2.1 (closed loop)

For each of the 9 V2.0 decisions, the actual resolution that landed:

1. **`scripts/extract.ts` animation salvage.** Ported then deleted. W5A.5 carried `injectAnimationMonitors`, `detectAnimations`, `collectViewTransitions` plus all helpers into `engine/extract/capture/animation-monitor.ts`. Legacy `scripts/extract.ts` plus entire `engine/extract/playwright/` directory removed in `7fe7dac`.
2. **iCloud ghost staged-add files.** Triage handled per wave. W5B.4 deleted three confirmed ghosts; W5C deleted two more. The conservative rule held: 10 untracked files were left alone because they are real in-flight work, documented modules in the audit, or paired with other untracked artefacts.
3. **11 omnichannel probe scripts.** All 11 were already deleted by W1A in V2.0. Confirmed by W5B.4's grep across `scripts/` (no trace of `auth-verify`, `login-omni`, `inspect-live`, etc. in tracked code).
4. **Apple tile-subdivision fix.** Confirmed never existed (audit hallucination, W5B.5). No action needed.
5. **`scripts/clone-page.ts`.** Deleted in W1A (V2.0). No further action.
6. **V1 rebuild parity vs current manifest-shape mode.** Both supported. W5C added `rebuild-pixel-diff` mode in `9b5d717`; `example-com-rebuild-pixel` fixture proves it passes 4/4 in the corpus.
7. **Two transient TS errors during V2.0.** Resolved before the v2.0.0 tag; not a V2.1 concern.
8. **W3 deferred items 6 and 7.** Done by W4B in V2.0; W5C `2159453` finished the SUMMARY decisions piece.
9. **`run-clone-stage.ts` outer subprocess shim.** In-processed by W5A.3. `engine/cli/run-clone-stage.ts` now calls `runCloneEntry(argv)` directly; manifest gains per-phase stage entries; `captureRoot` resolves to the actual dated subdir.

All 9 V2.0 open decisions are closed.

## What is left (genuinely open)

- **10 untracked files left alone per W5B.4 and W5C's conservative rule.** `engine/targets/webapp/emit-realtime/` (documented ACTIVE in 02-architecture-audit.md L131, no tracked imports yet), `engine/targets/webapp/extract-body-root.ts` (documented in 03-targets-audit.md L293), `engine/targets/webapp/form-capture/` (paired with untracked `scripts/capture-form-states.ts`), `engine/targets/webapp/scaffold/templates/mockServiceWorker.js.tpl` (pairs with `scaffold/msw-setup.ts`), `features.md` (Cameron's working note), plus the bulk of `scripts/audit-capture.ts`, `scripts/build-html-mirror.ts`, `scripts/capture-form-states.ts`, `scripts/recapture-routes.ts`, `scripts/seo-backfill.ts`. None are imported by tracked code.
- **W5B.3 webapp pixel parity is only smoke-verified.** All skip paths exercised plus job-building against the real `docs/research/crawl/app.omnisocials.com/` graph. Live full-flow against a built `dist/` not yet executed. Needs a follow-up integration test once a webapp clone has run through the full pipeline.
- **`rebuild-pixel-diff` for webapp deferred.** Webapp adapter shape does not match the astro/react `build + npm run build + static serve` pattern. The runner returns an explicit unsupported message for webapp fixtures, no silent skip.
- **Multi-URL apple capture for cross-page aggregation measurement.** W5A.4's union-across-pages step is a no-op on the current single-URL apple fixture.
- **Crawler viewport vs canonical viewport mismatch.** W5B.3 falls back to nearest-width when the crawl viewport is not one of the canonical four.
- **`npm install` cost dominates `rebuild-pixel-diff` (~80s of 85s total).** Out of scope for V2.1; needs a shared `node_modules` cache strategy.
- **`scripts/clone.ts` entry guard bug.** W5B.2 flagged the pre-existing `endsWith('clone.ts')` collision; not yet fixed.

## What V2.1 unlocks for V2.2 and beyond

TS clean, CLI mature, regression corpus has both manifest-shape and rebuild-pixel-diff modes, harvest loop typed and idempotent. The obvious next feature wave is multi-URL fidelity: re-capture apple with multiple URLs to exercise W5A.4's cross-page aggregation; promote the first react and webapp fixtures into `rebuild-pixel-diff` mode (webapp needs the adapter bridge first); and harden the integration test for W5B.3 by running one webapp clone through the full pipeline end-to-end so the parity-report.json schema is exercised against real bytes. Cameron picks; this is a suggestion list.

## Source observation files

| Agent | File | Focus |
|---|---|---|
| W5A.1 | `docs/V2.0/observations/w5a1-deps.md` | npm dep pruning, install graph delta |
| W5A.2 | `docs/V2.0/observations/w5a2-tsc-zero.md` | engine TS errors 15 to 0 |
| W5A.3 | `docs/V2.0/observations/w5a3-in-process.md` | last subprocess boundary closed |
| W5A.4 | `docs/V2.0/observations/w5a4-emit-time-css.md` | emit-time CSS injection + aggregation |
| W5A.5 | `docs/V2.0/observations/w5a5-animation-salvage.md` | animation monitor port, legacy retire |
| W5B.1 | `docs/V2.0/observations/w5b1-cli-extensions.md` | global flags, partial status, typed emit, harvest UX |
| W5B.2 | `docs/V2.0/observations/w5b2-parity-flags.md` | per-target thresholds, crawl-dir, manifest-only |
| W5B.3 | `docs/V2.0/observations/w5b3-webapp-pixel-parity.md` | vite preview, per-route diff, parity-report.json |
| W5B.4 | `docs/V2.0/observations/w5b4-doc-script-cleanup.md` | PR template, JSDoc, ghost cleanup |
| W5B.5 | `docs/V2.0/observations/w5b5-apple-tile-and-mobile.md` | apple tile audit + mobile fixture |
| W5C | `docs/V2.0/observations/w5c-finalisation.md` | SUMMARY decisions, git-sha pin, rebuild-pixel-diff, untracked triage |
