# Dr Parity V2.0 — Action Plan (Sequenced Execution)

> Synthesis of the four V2.0 audits into a single executable plan.
> Source audits: `docs/V2.0/01-pipeline-audit.md`, `docs/V2.0/02-architecture-audit.md`, `docs/V2.0/03-targets-audit.md`, `docs/V2.0/04-cli-and-logging-design.md`.
> Branch: `prototype-mode`. Owner: Cameron. Execution model: Claude Code orchestrating subagent teammates per worktree.

---

## 0. TL;DR

- One binary `parity`, one process, one log per run. Citty driven, in-process stages, no subprocess spawning.
- Every run writes `.runs/<id>/{manifest.json, pipeline.jsonl, stage-logs/, SUMMARY.md}` so Cameron can throw the heavy clone away and keep the durable record.
- A regression corpus at `tests/fixtures/sites/` runs on every engine change. Working clones never break. New successful clones get promoted into the corpus at the score they achieved.
- Playwright CLI does all extraction. Chrome MCP is retired everywhere. Claude observes the live Playwright run and writes anomalies into `SUMMARY.md`.
- Skills, CLAUDE.md, README, Dockerfile noise, and the dormant `extract.ts`/`qa.ts` pipeline are removed. One front door (`parity clone` / `parity clone-site`).
- React reaches Astro grade by porting `extract-css` and `media-preserve`. Webapp gets a post-emit pipeline of route smoke plus state assertions, with pixel parity tracked as a stretch goal.
- The harvest loop turns every clone into Dr Parity bug fixes. `parity runs harvest` emits tickets into `docs/parity-issues/`. The next Claude session picks them up.

---

## 1. End state vision

After V2.0, Cameron sits at a terminal and types `parity clone-site https://example.com --target=astro`. One process runs. The terminal streams stage timings and metrics in real time. Claude (watching through Claude Code) observes the trace, HAR, and console for anomalies. The run ends. A path to `.runs/<run-id>/SUMMARY.md` is printed.

Cameron opens that summary. He sees parity scores per viewport, the timing breakdown, issues encountered, and a USER block where he annotates anything Dr Parity got wrong. He runs `parity runs harvest`. Tickets land in `docs/parity-issues/INDEX.md`. The next Claude session picks the top ticket and ships a fix to the engine. Before merging, `parity test` runs the regression corpus against every previously promoted clone. Green means ship. Red means rollback.

When the new engine version proves itself on the next real clone (>=99% parity), that clone gets promoted into `tests/fixtures/sites/<name>/` at the score it achieved. The corpus grows. Confidence compounds.

There is no skill that bypasses the CLI. There is no doc that lies about the stack. There is no Dockerfile, no Next.js dashboard, no `scripts/extract.ts`, no Chrome MCP. There is the engine, the corpus, the loop.

---

## 2. Locked decisions

| # | Decision | Value | Source |
|---|---|---|---|
| 1 | Binary name | `parity` (no `dr-parity` alias) | 04 Round 2 A.1 (overridden by Cameron) |
| 2 | CLI library | `citty` | 04 B.6 |
| 3 | Distribution | `package.json#bin -> ./bin/parity.ts`; `npx parity` in-repo; `npm link` once for global; no npm publish | 04 Round 2 A.1 (Cameron override) |
| 4 | Stage boundary | In-process. No subprocess spawning. Playwright browsers cleaned up via `try/finally` in each stage. | 04 Round 2 A.2, C.1 |
| 5 | `.runs/` schema | `.runs/<run-id>/{manifest.json, pipeline.jsonl, stage-logs/, SUMMARY.md}`. Hard-fail on `schemaVersion` mismatch. | 04 Round 2 A.3, D.1 |
| 6 | Retention | `keep:50`, `olderThan:30d`. `SUMMARY.md` always preserved across prune. | 04 Round 2 A.3 |
| 7 | Canonical output | `clones/<target>/<iso-timestamp>/{captures, parsed, clones, sites/<target>, reports, logs}` | 01 Round 2 C.1 |
| 8 | Extraction tool | Playwright CLI only. Chrome MCP is explicitly retired. | Cameron override (audits previously assumed Chrome MCP) |
| 9 | Webapp parity bar | Route smoke and state assertions for v2.0 baseline. Pixel parity (~99%) tracked as stretch. | Cameron override |
| 10 | Worktree discipline | Every teammate works in its own worktree. Orchestrator (Claude Code main thread) merges and resolves conflicts. | `AGENTS.md` MOST IMPORTANT NOTES |

---

## 3. The no-regression discipline (load-bearing)

### Why it exists

Audit 03 documented that the React target had "one successful clone" that nobody could replicate because the success was a sampling artefact: five latent failure modes happened not to fire. The astro path is now stable, but every engine change risks breaking it the same way. The corpus prevents that. Each engine change either fixes a global bug (old behaviour was wrong everywhere) or is additive behind a capability check. Working clones must keep working.

### The regression corpus (V0, shipped in Phase 3d / W2C)

Location: `tests/fixtures/sites/<slug>/` for gating fixtures and `tests/fixtures/known-bad/<slug>/` for triage targets that the harvest loop reads.

Per-fixture layout (V0, shipped):

```
tests/fixtures/sites/<slug>/
  fixture.json          # metadata, locked threshold, comparison mode
  expected/             # the locked output we compare against
    clone-manifest.json # locked structural signature
    index.html          # (optional) HTML reference, first 200 lines for large clones
  capture-ref/
    source.txt          # path on disk to the live capture, relative to repo root
  README.md             # what this fixture proves, what a regression looks like
```

V1 (post-Phase 5) will extend `expected/` with frozen captures, parsed assets, and per-viewport baselines as the rebuild path lands. V0 ships the structural signature because that gives a stable gate without a full rebuild on every PR.

`fixture.json` schema (V0):

```json
{
  "slug": "example-com",
  "target": "astro",
  "url": "https://example.com/",
  "captured_at": "2026-05-14T12:54:35.266Z",
  "parity_threshold": 0.99,
  "comparison_mode": "manifest-shape",
  "notes": "Smallest deterministic astro baseline."
}
```

Fields:

- `slug`: filesystem safe identifier, matches the directory name.
- `target`: astro, react, or webapp.
- `url`: origin URL captured.
- `captured_at`: ISO timestamp of the source capture.
- `parity_threshold`: minimum acceptable score in [0, 1]. Locked at the score the fixture achieved when promoted.
- `comparison_mode`: V0 ships `manifest-shape` only. `bytes`, `pixel-diff`, and `both` land in V1.
- `notes`: free-form context.

### `parity test` command (shipped in Phase 3d / W2C)

- Walks `tests/fixtures/sites/*/` and reads every `fixture.json`.
- For each fixture, runs the configured comparison against the locked baseline. V0 supports `manifest-shape`: compares the clone manifest at `capture-ref/source.txt` against `expected/clone-manifest.json`. Pass when styles, scripts, assets, unresolvedExternal counts match exactly and htmlBytes is within 5 percent of the locked value.
- Output: one line per fixture (PASS, FAIL, or SKIP) plus a summary line.
- Exit code 0 pass, 1 regression. (Exit code 2 for missing fixture lands when V1 wires the rebuild path; today an unreadable capture-ref counts as a FAIL.)
- Implementation: `engine/cli/regression/{fixture-schema,manifest-shape,run-test}.ts`. The runner exposes a `Stage<RegressionTestInput, RegressionReport>` so it can plug into the orchestrator in Phase 5.

Invocation:

```
npx parity test
```

Sample output on `prototype-mode` HEAD after W2C:

```
PASS enerblock-net  target=astro score=100.0% threshold=99.0% manifest-shape match (5/5)
PASS example-com    target=astro score=100.0% threshold=99.0% manifest-shape match (5/5)

parity test summary: 2 passed, 0 failed, 0 skipped, 2 total
```

Wired into:

- Pre-merge: every PR runs `parity test` in CI (intent documented below; CI integration lands in Phase 5 / 6).
- Local: developers run `npx parity test` before pushing.
- Engine changes: agents run `npx parity test` after the change, paste results into the PR.

### Known-bad catalogue (shipped in Phase 3d / W2C)

`tests/fixtures/known-bad/<slug>/` holds fixtures that document representative bug shapes. They are NOT run by `parity test`. The harvest loop (Phase 6) reads them to seed tickets, and contributors looking for failure baselines read them to pick triage targets.

V0 ships one known-bad fixture: `apple-com-react` (current desktop pixel diff 30.56 percent, source `docs/research/captures/www.apple.com/react-site-urls/parity-report.json`).

A fixture moves from `known-bad/` to `sites/` once a fix lands and the clone reproduces above the parity threshold.

### Promotion rule

A clone is eligible for promotion when its `qa-verify` outcome shows every targeted viewport at >=99 percent parity. Promotion command (deferred, V2.1 polish): `parity runs promote <run-id> --as=<slug>`. Until that exists, promotion is manual:

1. Pick a slug. Lowercase, hyphenated, no dots. Example: `enerblock-net`.
2. Create `tests/fixtures/sites/<slug>/expected/` and copy the load-bearing files from the run output. V0 picks `clone-manifest.json` plus the first 200 lines of `index.html`. V1 will widen this to frozen captures, parsed assets, and per-viewport baselines.
3. Write `capture-ref/source.txt` pointing at the live capture directory (relative to repo root).
4. Write `fixture.json` with the achieved score as `parity_threshold`.
5. Write `README.md` describing what the fixture proves and what a regression in this fixture would look like.
6. Commit. Future `parity test` runs gate against the new fixture.

V0 fixtures (locked at promotion):

| Slug | Target | Threshold | Notes |
|---|---|---|---|
| example-com | astro | 0.99 | Deterministic floor. Single page, zero external assets. |
| enerblock-net | astro | 0.99 | Real-world astro success. 161 assets, 14 scripts, 1 style. |

### Triaging harvested fixes against the corpus

Every harvested ticket (Phase 7 loop) includes `affectedRuns` in its front matter. When an engine change lands to fix a ticket, the developer:

1. Runs `npx parity test` to confirm no fixture regressed.
2. Re-runs `parity clone` against one of the affected runs' URLs and verifies the ticket's failure no longer reproduces.
3. Closes the ticket with `resolvedIn: <git-sha>` in its front matter.

### CI hook (planned, not yet wired)

`.github/workflows/ci.yml` will run (Phase 5 / 6):

```yaml
- run: npm install
- run: npx playwright install chromium --with-deps
- run: npx parity --version
- run: npx tsc --noEmit
- run: npx parity test
```

No more `npm run lint` or `npm run build` (neither exists). Audit 02 §3 catalogued this as broken today. CI wiring is deferred until the in-process pipeline lands so the same command surface runs in CI as on the laptop.

---

## 4. Phases 1 to 7 (sequenced execution)

Each phase ends with a green `npx tsc --noEmit` plus a green `parity test` (once the corpus exists from Phase 3 onward).

### Phase 1: Cleanup of safe deletes plus doc drift PR

**Goal:** Remove the dead pipeline so the repo matches its real identity.

**Tasks:**

1. Delete files (audit 02 Round 2 A.13 confirms zero inbound callers).
   - `/Users/cameronmcallister/Github/dr-parity/Dockerfile`
   - `/Users/cameronmcallister/Github/dr-parity/Dockerfile.dev`
   - `/Users/cameronmcallister/Github/dr-parity/docker-compose.yml`
   - `/Users/cameronmcallister/Github/dr-parity/.dockerignore`
   - `/Users/cameronmcallister/Github/dr-parity/scripts/extract-multi.ts`
   - `/Users/cameronmcallister/Github/dr-parity/scripts/download-assets.mjs`
   - `/Users/cameronmcallister/Github/dr-parity/docs/docs/research/prompts/` (path bug from audit 02 §3)
   - `/Users/cameronmcallister/Github/dr-parity/scripts/seo-backfill.mts` (hard-coded user paths)
   - The 11 hard-coded `scripts/verify-*.ts` files plus `scripts/inspect-live.ts`, `scripts/inspect-selector-resolution.ts`, `scripts/login-omni.ts`, `scripts/auth-verify.ts` (audit 02 §3).
2. Rewrite docs that lie about the stack (audit 02 §2.1, audit 01 Round 2 E.1).
   - `/Users/cameronmcallister/Github/dr-parity/README.md`: rewrite from scratch to describe the CLI engine. No Next.js claims.
   - `/Users/cameronmcallister/Github/dr-parity/AGENTS.md`: strip Next.js claims, remove `src/` and `public/` from project structure, document the real CLI pipeline.
   - `/Users/cameronmcallister/Github/dr-parity/docs/ROADMAP.md`: refresh stats (audit 02 §1 notes "26 engine files" is now 254). Strip `scripts/extract.ts` and `engine/qa/*` references.
   - `/Users/cameronmcallister/Github/dr-parity/.github/workflows/ci.yml`: replace `npm run lint` and `npm run build` with `npx tsc --noEmit` (audit 02 §3, §7).
   - `/Users/cameronmcallister/Github/dr-parity/.gitignore`: strip `.next/`, `clone-prototype/`, `clone-astro/` legacy entries.
3. Move the omnisocials clones leak: anything under `clones/app.omnisocials.com-*/node_modules/` gets moved out of the repo per `AGENTS.md` policy (audit 02 §7 item 9).
4. Sweep `engine/tests/out/` for accidentally tracked artefacts. If `git ls-files engine/tests/out` returns anything, untrack it and add to `.gitignore`.

**Acceptance:**

- `git status` clean after deletions.
- `npx tsc --noEmit` passes.
- `grep -r "scripts/extract.ts" .` returns only matches inside `docs/V2.0/` (audit references).
- `grep -ri "next.js" README.md AGENTS.md` returns nothing claiming it as the stack.
- CI workflow passes the typecheck step.

**Risk:** Doc files referenced by other doc files. Mitigation: run `bash scripts/sync-agent-rules.sh` and `node scripts/sync-skills.mjs` after edits so all generated copies update together.

**Subagent assignment:**

- Teammate A (worktree `cleanup-deletes`): file deletions plus `.gitignore` update.
- Teammate B (worktree `cleanup-docs`): README, AGENTS.md, ROADMAP, CI workflow rewrites.
- Run in parallel. Main thread merges.

---

### Phase 2: Lift active code out of legacy folders

**Goal:** Move `engine/qa/parity-check.ts` to its real home, then delete the rest of `engine/qa/`. Stop maintaining two parallel pipelines.

**Tasks:**

1. Move `/Users/cameronmcallister/Github/dr-parity/engine/qa/parity-check.ts` to `/Users/cameronmcallister/Github/dr-parity/engine/verify/parity-check.ts`. Audit 02 Round 2 A.5 confirms it is called from `scripts/clone-urls.ts:465` and is the ACTIVE parity gate.
2. Update the dynamic import at `/Users/cameronmcallister/Github/dr-parity/scripts/clone-urls.ts:465` from `'../engine/qa/parity-check'` to `'../engine/verify/parity-check'`.
3. Delete the rest of `engine/qa/` (audit 02 Round 2 A.5): `screenshotter.ts`, `pixel-diff.ts`, `content-masker.ts`, `section-comparator.ts`, `hover-tester.ts`, `dom-comparator.ts`, `fix-loop.ts`, `asset-waiter.ts`.
4. Delete `/Users/cameronmcallister/Github/dr-parity/scripts/qa.ts` and `/Users/cameronmcallister/Github/dr-parity/scripts/qa-sections.ts` (audit 02 Round 2 A.8, A.9).
5. Delete `/Users/cameronmcallister/Github/dr-parity/scripts/extract.ts` after porting any salvageable logic from `engine/extract/playwright/animation-detector.ts`, `font-extractor.ts`, `asset-collector.ts` into `engine/extract/capture/` (audit 02 Round 2 A.6, A.12). Cameron's call on what to port.
6. Delete the entire `engine/extract/playwright/` folder once the port from step 5 lands (audit 02 Round 2 A.12).
7. Delete `engine/extract/multi-page.ts`, `engine/extract/merge.ts`, `engine/extract/cache.ts`, `engine/extract/checkpoint.ts` (audit 02 Round 2 A.12).
8. Delete `engine/extract/chrome-mcp/` (empty except for `.gitkeep`; never implemented per audit 02 §3).
9. Delete `engine/analyze/behavior-model.ts`, `engine/generate/component-gen.ts`, `engine/generate/page-assembler.ts`, `engine/generate/foundation.ts`, `engine/generate/builder-prompts.ts`, `engine/generate/templates/` (audit 02 §3, A.12).
10. Update every `clone-website` skill markdown across `.claude`, `.codex`, `.augment`, `.continue`, `.cursor`, `.gemini`, `.opencode`, `.windsurf`, `.github/skills` so they no longer reference the deleted files. Regenerate via `node scripts/sync-skills.mjs` after editing the source `.claude/skills/clone-website/SKILL.md`.

**Acceptance:**

- `npx tsc --noEmit` passes.
- `npm run clone-urls -- --urls=docs/V2.0/test-urls.txt --target=astro` still works end to end against a known-good URL (Phase 3 corpus will then assert this).
- `find engine/qa -type f` returns nothing.
- `find engine/extract/playwright -type f` returns nothing.
- `grep -r "engine/qa/parity-check" engine scripts` returns only the new `engine/verify/parity-check` path.

**Risk:** Salvage from `engine/extract/playwright/*` is tricky. Mitigation: do the port in a dedicated commit before deletion. If anything is unclear, leave the folder in place and revisit in Phase 3.

**Subagent assignment:**

- Teammate A (worktree `lift-parity-check`): move parity-check.ts and update the import. Single PR.
- Teammate B (worktree `delete-legacy-qa`): delete `engine/qa/*` (minus parity-check), `scripts/qa.ts`, `scripts/qa-sections.ts`. Run after A merges.
- Teammate C (worktree `delete-legacy-extract`): port from `engine/extract/playwright/*` then delete. Run after A merges, in parallel with B.
- Teammate D (worktree `sync-skills`): update SKILL.md references and run the sync scripts. Run last, after A, B, C merge.

---

### Phase 3: Target reliability and regression corpus genesis

**Goal:** Stabilise the three targets. Lay down the first fixtures so future engine changes have a gate.

**Tasks:**

1. Fix the Astro frontmatter leak (audit 03 Round 2 A.3).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/slice-body.ts` lines 189 to 204: replace the string-composition that emits `---` frontmatter with the structured `{ wrapper, childComponentNames }` return shape from audit 03 A.3.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/types.ts`: extend `ComponentDef` with `wrapper: { openTag: string; closeTag: string } | null` and `childComponentNames?: string[]`.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/astro/emit.ts`: consume the structured shape; drop the frontmatter splitter at lines 38 to 46 and 53 to 55.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/astro/emit-multi.ts`: same shape; drop lines 191 to 193 and 202 to 214.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/react/emit.ts`: delete `parseAstroFrontmatter` (49 to 68), `preservePascalTags` (77 to 90), `restorePascalTags` (92 to 102). Rewrite `writeComponent` to consume `wrapper` plus `childComponentNames`.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/react/emit-multi.ts`: delete the duplicate `parseAstroFrontmatter` (210 to 224), `preservePascalTags` (226 to 238), `restorePascalTags` (240 to 250). Rewrite `writeReactComponentFile` (257 to 285).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/webapp/build.ts` lines 264 to 265: replace the literal frontmatter leak with a real composition emit through `engine/targets/webapp/emit.ts`.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/webapp/emit.ts`: `writeComponent` learns to take `wrapper` plus `childComponentNames`.
2. Port `extract-css` and `media-preserve` into the React post-emit (audit 03 Round 2 B.3).
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/media-preserve-react.ts` (or reuse `engine/scope-styles/media-preserve.ts` directly which is target-agnostic).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/post-emit-multi-react.ts` lines 692 to 712: insert two new phases (extract-css aggregation, media-preserve) before `npm install`.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/react/emit.ts` (the `writeMain` at 206 to 240): add a single `import './styles/responsive.css'` line.
3. Quick wins on React parity (audit 03 Round 2 B punch list items 5, 6).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/react/html-to-jsx.ts` line 463: collapse className whitespace via `.replace(/\s+/g, ' ').trim()` for the `class` attribute branch only.
   - Verify `html-to-jsx.ts` lines 548 to 566 (`serialiseStyleValue`) correctly routes `url(`, backslash, and unbalanced quotes through a backtick literal. Add a snapshot test fixture if missing.
4. Tighten React verify-render's ignorable error filter (audit 03 Round 2 B punch list item 2).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/post-emit-multi-react.ts` lines 103 to 160: log a count of suppressed errors per page; narrow the whitelist from broad path prefix to an explicit allow list.
5. Webapp post-emit baseline (audit 03 §9 gaps 1 and 2).
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/post-emit-webapp.ts`: `npm install` plus `npm run build` plus a route-smoke pass that boots `vite preview`, navigates to each inferred route, asserts `#root` populated and at least one MSW handler responded.
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/verify/state-assertions.ts`: per-route state-toggle assertions derived from the crawl graph (click each captured toggle target, snapshot DOM, diff against captured state).
   - Edit `/Users/cameronmcallister/Github/dr-parity/scripts/build.ts` lines 283 to 290 (webapp branch): call `runPostEmitWebapp` after `webappAdapter.build` returns.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/verify/parity-check.ts:38`: extend the `ParityTarget` union to include `'webapp'`. Pixel parity remains stretch-goal; smoke plus state gate the v2.0 acceptance.
6. Unified `PostEmitPipeline` interface (audit 03 §7 critique).
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/types.ts`: `interface PostEmitPipeline { run(input): Promise<PostEmitResult> }`. Implementations: `post-emit-multi.ts` (astro), `post-emit-multi-react.ts` (react), `post-emit-webapp.ts` (webapp).
   - Each target's `index.ts` exports a `postEmit` member alongside `build` and `buildMulti`.
7. Eliminate the `crawlDir` smuggle on webapp (audit 03 §7 finding 1).
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/types.ts`: extend `TargetBuildOptions` with optional `crawlDir?: string`.
   - Edit `/Users/cameronmcallister/Github/dr-parity/engine/targets/webapp/index.ts:117`: drop the structural cast.
8. Genesis fixtures. Promote three known-good clones into `tests/fixtures/sites/`.
   - `enerblock` (audit 03 §3.6 references this as a finished Astro rebuild).
   - One react fixture: re-run `vivre.agency` per audit 03 Round 2 C ("hypothesis"). If it passes, promote. If it fails, file a ticket and try the next simplest captured site at `docs/research/captures/vivre.agency/`.
   - One webapp fixture: smoke-and-state baseline of `app.omnisocials.com` per audit 03 §5.6 (13 clones on disk).
9. Build the `parity test` command skeleton (will be wired into the CLI in Phase 4, but the runner logic lands here so the corpus can be exercised manually via `npx tsx scripts/parity-test.ts`).

**Acceptance:**

- `npx tsc --noEmit` passes.
- Re-running the astro enerblock clone produces parity within 0.005 of the previously locked score.
- Re-running apple.com on the react path drops below 5% pixel diff (audit 03 Round 2 B item 10 baseline was 30.56%).
- Webapp post-emit smoke gate runs against the latest omnisocials clone and passes.
- `tests/fixtures/sites/` contains at least three fixtures, each with `fixture.json` plus `baseline/expected-summary.json`.
- `npx tsx scripts/parity-test.ts` runs and reports pass.

**Risk:** The frontmatter refactor touches 9 files. Mitigation: snapshot tests on representative captured HTML before refactor (audit 03 Round 2 B item 3). Land snapshots first, refactor second, verify snapshots second.

**Subagent assignment:**

- Teammate A (worktree `slice-body-refactor`): frontmatter leak removal across the 9 files. Single PR.
- Teammate B (worktree `react-media-preserve`): port extract-css plus media-preserve into react post-emit. Run after A merges.
- Teammate C (worktree `webapp-post-emit`): post-emit-webapp.ts plus state-assertions.ts plus parity-check union extension. Run after A merges.
- Teammate D (worktree `corpus-genesis`): re-run the three target clones, promote them, write fixtures. Run after B and C merge.
- Teammate E (worktree `parity-test-runner`): build the `parity test` runner logic. Run in parallel with D once fixture format is finalised.

---

### Phase 4: parity CLI scaffolding plus in-process stage interface

**Goal:** Stand up the `parity` binary. Every existing capability stays accessible under a new name. No behaviour change yet.

**Tasks:**

1. Add `/Users/cameronmcallister/Github/dr-parity/bin/parity.ts` plus `package.json#bin: { "parity": "bin/parity.ts" }`. Add citty as a dependency.
2. Build the command tree skeleton at `/Users/cameronmcallister/Github/dr-parity/src/cli/index.ts` per audit 04 B.2.
3. For each row in audit 04 Round 2 B (67 rows), create a thin command handler that imports the existing script's `main(argv)` function and forwards. Refactor each script to export `main(argv: string[])` instead of running on import.
4. Build the `Stage<I, O>` interface and `RunContext` at `/Users/cameronmcallister/Github/dr-parity/engine/runtime/` per audit 04 C.1 and C.2.
5. Build the orchestrator at `/Users/cameronmcallister/Github/dr-parity/engine/runtime/orchestrate.ts` per audit 04 C.3.
6. Wrap the first stage (`capture`) into the new `Stage<I, O>` shape as a proof of concept. Both `parity capture` and the old `npm run capture` should route through it identically.
7. Run `npm link` and verify `parity --version`, `parity --help`, `parity capture <url>` work.
8. Add `parity doctor`: check Node, Playwright (`/Users/cameronmcallister/.local/bin/playwright --version` or `npx playwright --version`), chromium install, ffmpeg presence.
9. Wire `parity test` to the runner built in Phase 3.

**Acceptance:**

- `parity --help` prints the command tree.
- Every command in audit 04 Round 2 B works under both its old and new name.
- `parity capture <url>` runs through the new `Stage<I, O>` shape.
- `parity doctor` passes on Cameron's laptop.
- `parity test` runs the corpus and passes.
- `npx tsc --noEmit` passes.

**Risk:** Refactoring 56 scripts to export `main(argv)` is mechanical but tedious. Mitigation: a single sweeping codemod commit that touches every file the same way.

**Subagent assignment:**

- Teammate A (worktree `cli-skeleton`): bin/parity.ts, citty wiring, command tree, doctor, version.
- Teammate B (worktree `script-main-export`): codemod every `scripts/*.ts` to export `main(argv)`. Land before A's command handlers go live.
- Teammate C (worktree `stage-interface`): Stage, RunContext, orchestrator. Land in parallel with A.
- Teammate D (worktree `capture-stage`): wrap capture as the first `Stage<I, O>`. Land after C merges.

---

### Phase 5: Unified logging (`.runs/`) plus canonical output convention adoption

**Goal:** Every run leaves a durable, machine-readable record. Every script writes outputs under one root.

**Tasks:**

1. Build `engine/logging/` plus `engine/runtime/with-run.ts` per audit 04 D.1 and D.2.
2. Refactor each stage to the `Stage<I, O>` shape (audit 04 C.1). Capture done in Phase 4; remaining: `parse-har`, `parse-trace`, `complete-assets`, `clone`, `build`, `qa-verify`.
3. Rewrite `/Users/cameronmcallister/Github/dr-parity/scripts/clone-site.ts`, `clone-urls.ts`, `run-clone.ts` as composed pipelines that no longer spawn subprocesses (audit 04 B.7 step 5). They become thin command handlers calling `createPipeline().pipe(...).run()`.
4. Adopt the canonical output convention (audit 01 Round 2 C.1 and C.4). Update default output paths in 18 scripts plus the SKILL.md (table at audit 01 Round 2 C.4). The new root is `clones/<target>/<iso-timestamp>/`.
5. Write `manifest.json`, `pipeline.jsonl`, `SUMMARY.md`, `.runs/index.jsonl` per audit 04 D.1, D.2, D.3.
6. Schema hard-fail per locked decision 5. Bump `schemaVersion` to 1.
7. Implement retention. `parity runs prune` enforces `keep:50 / olderThan:30d`. `SUMMARY.md` always preserved.
8. Add `parity runs list`, `parity runs show`, `parity runs open`, `parity logs tail` per audit 04 B.2.
9. Symlink `clones/<target>/<iso>/.run-id -> .runs/<run-id>/` so any clone traces to its log (audit 04 C.2).
10. Update `parity.config.ts` resolution per audit 04 B.5.

**Acceptance:**

- A full `parity clone-site https://enerblock.com --target=astro` produces a single `.runs/<id>/` directory with manifest, pipeline.jsonl, summary, and per-stage stdout logs.
- Every output (capture, parsed, clone, sites, reports) lives under `clones/<target>/<iso-timestamp>/`.
- `parity runs list` shows the new run.
- `parity test` still passes against the corpus.
- `npx tsc --noEmit` passes.

**Risk:** Switching from spawn to in-process can pollute global state between stages (audit 04 Round 2 A.2). Mitigation: `try/finally` around every Playwright browser; `RunContext.onDispose()` LIFO registry; teardown on both success and failure.

**Subagent assignment:**

- Teammate A (worktree `logging-runtime`): `engine/logging/`, `with-run.ts`, `RunLogger`, `ManifestWriter`.
- Teammate B (worktree `stage-wraps`): convert remaining stages to `Stage<I, O>`. Runs in parallel with A.
- Teammate C (worktree `pipeline-compose`): rewrite clone-site, clone-urls, run-clone as composed pipelines. Runs after A and B merge.
- Teammate D (worktree `canonical-output`): update default output paths in 18 scripts plus SKILL.md. Runs in parallel with C.
- Teammate E (worktree `runs-cli`): `parity runs list|show|open|prune` plus `parity logs tail`. Runs after A merges.

---

### Phase 6: Harvest loop (`parity runs harvest`) plus shim removal plus skill rewrite

**Goal:** Close the self-improvement loop. Delete the legacy npm script aliases. Replace the skill.

**Tasks:**

1. Build `parity runs harvest` per audit 04 E.
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/harvest/scan.ts`: walks `.runs/`, aggregates by `stage + kind`, applies `--min-frequency` filter.
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/harvest/emit-tickets.ts`: writes markdown tickets to `docs/parity-issues/<date>-<kind>-<hash>.md` with the front matter from audit 04 E.3.
   - New file `/Users/cameronmcallister/Github/dr-parity/engine/harvest/index.ts`: rewrites `docs/parity-issues/INDEX.md`, preserves the `<!-- USER-NOTES -->` block.
   - New folder `/Users/cameronmcallister/Github/dr-parity/docs/parity-issues/` with a starter `INDEX.md`.
2. Delete deprecated npm script aliases. Per audit 01 Round 2 E (the keep-vs-delete table):
   - Delete `generate:prototype`, `generate:prototype:fixture`, `generate:astro`, `generate:astro:fixture`, `clone-page`, `parse:all`, `build:react:multi`, `build:astro:multi` from `package.json`.
   - Alias remaining npm scripts to `parity ...` invocations so muscle memory keeps working (audit 04 G Phase 3 step "deprecation warnings"). Emit a one-line `[deprecated]` to stderr from each alias.
3. Delete `/Users/cameronmcallister/Github/dr-parity/scripts/clone-site.ts`, `clone-urls.ts`, `run-clone.ts`, `clone-page.ts` after their pipelines are live under `engine/pipelines/` (Phase 5 work).
4. Rewrite `/Users/cameronmcallister/Github/dr-parity/.claude/skills/clone-website/SKILL.md` with the content from audit 04 F. Strip every Chrome MCP reference. The replacement skill: thin wrapper over `parity clone-site`, "what NOT to do" blockade list of legacy entry points, post-run guidance to read SUMMARY.md and run harvest.
5. Regenerate every sister skill file (`.codex`, `.augment`, `.continue`, `.cursor`, `.gemini`, `.opencode`, `.windsurf`, `.github/skills`, `.amazonq`) via `node scripts/sync-skills.mjs`.
6. Update `/Users/cameronmcallister/Github/dr-parity/.claude/commands/clone-website.md` to invoke `parity clone-site` directly.
7. Add tab completion: `parity completion zsh > ~/.parity-completions.zsh` (citty provides this for free per audit 04 B.6).

**Acceptance:**

- `parity runs harvest` against existing `.runs/` produces at least one ticket if any warnings exist.
- `docs/parity-issues/INDEX.md` lists open tickets in priority order.
- Running `npm run capture -- <url>` emits `[deprecated] use parity capture instead` to stderr but still works.
- `cat .claude/skills/clone-website/SKILL.md | grep -i "chrome mcp"` returns nothing.
- `cat .claude/skills/clone-website/SKILL.md | grep -i "scripts/extract.ts"` returns only the "what NOT to do" line.
- `parity test` still passes.
- `npx tsc --noEmit` passes.

**Risk:** Deleting the old script files breaks anyone who has shell aliases pointing at them. Mitigation: announce in `docs/V2.0/05-action-plan.md` (this file) the cutover date; keep the npm aliases for one minor version cycle.

**Subagent assignment:**

- Teammate A (worktree `harvest-engine`): `engine/harvest/*` plus `parity runs harvest` command.
- Teammate B (worktree `shim-removal`): delete legacy npm aliases, delete old `clone-*.ts` scripts. Runs after Phase 5 confirms in-process pipelines work.
- Teammate C (worktree `skill-rewrite`): SKILL.md rewrite plus sync-skills regeneration. Runs in parallel with A.
- Teammate D (worktree `completion`): tab completion ship. Runs in parallel with A.

---

### Phase 7: Operate the loop

**Goal:** Use the engine in earnest. Promote new fixtures. File and fix bugs against the harvested queue.

**Tasks (ongoing, not bounded):**

1. For every real-world clone Cameron runs:
   - Inspect `.runs/<id>/SUMMARY.md` immediately after completion.
   - Annotate the USER block in SUMMARY.md with any findings Claude or Cameron observed during the live Playwright run (anomalies in the trace, HAR, console).
   - Run `parity runs harvest` weekly (or after a batch of clones) to file tickets.
2. For every harvested ticket:
   - Pick from `docs/parity-issues/INDEX.md` top down.
   - Read the ticket front matter for `suggestedTargetFiles` and `affectedRuns`.
   - Open one of the affected runs' `manifest.json` to verify the diagnosis.
   - Implement the fix in a feature branch.
   - Run `parity test` locally. Green means PR; red means rollback.
   - On merge, set `status: closed` and `resolvedIn: <git-sha>` in the ticket front matter.
3. For every clone that achieves >=99% parity across all targeted viewports:
   - Promote into `tests/fixtures/sites/<slug>/` per the rule in section 3.
   - Lock the score at the achieved value.
   - Commit the fixture in a dedicated PR so the corpus growth is auditable.
4. Cameron's "throw the heavy clone away" workflow:
   - Move `clones/<target>/<iso>/` out of the repo (or delete).
   - The `.runs/<id>/SUMMARY.md` plus `manifest.json` survive as the durable record.
   - `parity runs prune` keeps `.runs/` lean per retention policy.

**Acceptance (steady state):**

- New clones produce SUMMARY.md within the canonical layout.
- Corpus grows by at least one fixture per fortnight of active cloning.
- Open ticket count trends down over time (more closed than opened on a rolling 30-day basis).
- Engine never regresses against a locked fixture without an explicit `tolerance` bump.

**Risk:** The loop stalls if Cameron stops annotating SUMMARY.md. Mitigation: build a `parity runs review <id>` command in V2.1 that drops Cameron into the SUMMARY USER block via `$EDITOR` immediately after each clone.

**Subagent assignment:** This phase is human-in-the-loop. No standing teammate. Each ticket-driven fix uses the standard subagent dispatch (debugger or specialist as appropriate).

---

## 5. The Playwright capture spec (V2.0)

All extraction runs through the Playwright CLI. Chrome MCP is retired. Claude observes the live run through Claude Code and writes anomalies into `SUMMARY.md`.

### Capture targets and modules

| Capture target | What it is | Module (current or new) |
|---|---|---|
| HTML | Captured `document.html` per viewport | `engine/extract/capture/network-recorder.ts` (already wires the response listener) |
| All CSS (computed plus raw plus media rules) | Every stylesheet linked or inlined, plus `getComputedStyle` snapshots for representative elements | `engine/extract/capture/recording.ts` (HAR), `engine/scope-styles/media-preserve.ts` (media rules), new `engine/extract/capture/computed-styles.ts` for the runtime snapshot pass |
| All JS | Every script byte transferred, deduped by sha8 | `engine/extract/capture/recording.ts` (HAR) plus `scripts/parse-har.ts` |
| All assets | Images, fonts, videos, JSON, anything else over the wire | Same as JS |
| Modals (discovered via interaction tour) | Programmatic click on common modal triggers (buttons with `aria-haspopup`, links containing `#`, elements with `data-modal-trigger`); capture modal DOM and overlay state | `engine/extract/capture/tour.ts` extended with a `modal-discovery` pass |
| Auto-found pages (link graph plus sitemap) | BFS of same-origin links, robots-aware, plus `sitemap.xml` parse | `engine/extract/site-crawler.ts` (already does BFS); new `engine/extract/sitemap.ts` for the xml fetch |
| API responses (HAR) | Every XHR / fetch response body captured into HAR | Native Playwright HAR recording in `engine/extract/capture/recording.ts` |
| Animation easing and timing | CSS animations parsed from stylesheets; JS animations captured via `Element.animate` shim plus trace events | `engine/animations/parser.ts` (CSS), new `engine/extract/capture/animation-monitor.ts` (JS shim, ported from the salvageable bits of `scripts/extract.ts` per Phase 2 step 5) |
| Full functional state | DOM snapshots before, during, after each interaction in the tour | `scripts/parse-trace.ts` already parses `trace.zip` into `dom-snapshots.jsonl`; tour extension expands the interaction sequence |
| Per-viewport recordings | Video for `launch` mode, screenshot plus trace.zip for all modes | `engine/extract/capture/recording.ts` |

### What Claude does during a live run

Cameron always runs Dr Parity through Claude Code. Claude is in the loop the whole time. While `parity clone-site` executes:

1. Stream `pipeline.jsonl` events (Claude can `tail -f .runs/<id>/pipeline.jsonl` or watch the console).
2. Watch for `warning` and `error` events. Note the `stage + kind` pair. If a stage takes more than 2x the median for that host (audit 04 E.2 item 5), flag it.
3. Read `decision` events. If a stage branches unexpectedly (e.g. `mode-selected: persistent` when `launch` was expected), surface that to Cameron in chat.
4. On run completion, open `.runs/<id>/SUMMARY.md`. Read the AUTO blocks. Propose annotations for the USER blocks based on observed anomalies.
5. If the parity gate failed any viewport, propose targeted fixes (component, viewport, stage) and offer to run `parity qa verify` against the failed viewport only.

Claude does not run Chrome MCP. Claude does not click around the live page in a separate browser. Every observation flows through the Playwright run's structured output.

---

## 6. The replacement `/clone-website` skill (SHIPPED Phase 6, agent W4A)

### Status

Shipped on `prototype-mode`. Source of truth: `.claude/skills/clone-website/SKILL.md`. Sister copy regenerated to `.github/skills/clone-website/SKILL.md` via `node scripts/sync-skills.mjs`.

### The skill's role

Thin wrapper over `npx parity clone`. The skill does not compose its own pipeline, does not call `scripts/*.ts` directly, does not invoke any browser MCP. It validates URLs, dispatches one `parity clone` per URL (in parallel when independent), then reads `.runs/<runId>/SUMMARY.md` and presents the outcome to Cameron.

### Canonical command sequence

The skill prescribes exactly one sequence:

```bash
npx playwright --version
npx parity version
npx parity clone "<url>" --target=<target>
cat .runs/<runId>/SUMMARY.md
npx parity qa verify "<project-dir>" --viewport=<failed-viewport>   # only if parity failed
npx serve "<project-dir>"
```

### Edge case flag table (shipped)

| Situation | Flag |
|---|---|
| Login required SPA | `--mode=persistent` |
| Single viewport | `--viewport=desktop` (comma separated subset also accepted) |
| Skip lazy load tour | `--no-tour` |
| Skip parity gate (development only) | `--no-parity` |
| Headed browser | `--headed` |
| Custom parity threshold | `--parity-threshold=0.03` |
| Resume an existing run record | `--run-id=<existing-id>` |

### What NOT to do (shipped blockade list)

The skill's blockade list, in the order it appears in SKILL.md:

- `npx tsx scripts/extract.ts` (legacy, deprecated)
- `npx tsx scripts/capture.ts` (replaced by `parity capture`)
- `npx tsx scripts/clone-site.ts` (replaced by `parity clone-site`)
- `npx tsx scripts/clone-urls.ts` (replaced by `parity clone-urls`)
- `npx tsx scripts/run-clone.ts` (replaced by `parity clone`)
- `npx tsx scripts/clone-page.ts` (replaced by `parity clone`)
- `npx tsx scripts/parse-har.ts` (replaced by `parity parse <dir> --har`)
- `npx tsx scripts/parse-trace.ts` (replaced by `parity parse <dir> --trace`)
- `npx tsx scripts/complete-assets.ts` (replaced by `parity complete-assets`)
- `npx tsx scripts/build.ts` (replaced by `parity build`)
- `npx tsx scripts/rebuild-pro.ts` (replaced by `parity rebuild-pro`)
- `npx tsx scripts/verify-parity.ts` (replaced by `parity qa verify`)
- `npx tsx scripts/qa.ts` (replaced by `parity qa run`)
- `npm run capture -- ...` and other npm aliases (work via shim, always prefer `parity`)
- Chrome MCP for any visual pass (retired)
- Any browser MCP (Playwright CLI is the only extraction surface)
- Hand writing JSX or Astro from screenshots (let the engine emit components)
- Hand composing pipelines step by step (use `parity clone`)

### Verification

- `cat .claude/skills/clone-website/SKILL.md | grep -i "chrome mcp"` returns only blockade mentions
- `cat .claude/skills/clone-website/SKILL.md | grep "scripts/extract.ts"` returns only the blockade line
- `grep -c "—" .claude/skills/clone-website/SKILL.md` returns 0
- `parity test` continues to pass 2/2

---

## 7. The harvest plus bug-fix loop (SHIPPED Phase 6, agent W4A)

### Status

Shipped on `prototype-mode`. Command surface: `npx parity runs harvest`. Smoke test: `npx tsx scripts/smoke-parity-harvest.ts` (asserts the harvest picks up recurring-warning, repeat-error, parity-regression, and stuck-warning from a synthetic .runs fixture).

### Shipped files

- `engine/cli/runs-harvest.ts` (scanner + aggregator + ticket writer + INDEX writer)
- `engine/cli/runs-harvest-cli.ts` (citty handler wrapping `harvestRuns`)
- `engine/cli/run-manifest-read.ts` (path based manifest reader, surfaces `ManifestSchemaError`)
- `engine/cli/event-stream-read.ts` (jsonl reader that tolerates aborted runs)
- `scripts/smoke-parity-harvest.ts` (synthetic fixture + assertions)
- `docs/parity-issues/INDEX.md` (seeded empty triage queue)
- `bin/parity.ts` (`runs harvest` subcommand wired under the `runs` group)

### Finding kinds emitted

| Kind | Surface trigger |
|---|---|
| `recurring-warning` | Same stage + warning message in N+ runs (default N = 2) |
| `repeat-error` | Same stage + error message in N+ runs |
| `parity-regression` | Parity score dropped across consecutive runs for the same target |
| `duration-drift` | Stage duration > 1.5x rolling median across 2+ runs |
| `stuck-warning` | Warning with a `hint` field present in latest run AND repeated in earlier runs |

### Severity classification

| Type | Threshold | Severity |
|---|---|---|
| parity-regression | surface >= 3 | P1, else P2 |
| repeat-error | surface >= 3 | P1, else P2 |
| stuck-warning | surface >= 4 | P1, else P2 |
| recurring-warning | surface >= 5 | P2, else P3 |
| duration-drift | surface >= 4 | P2, else P3 |

### Ticket schema (locked)

Every ticket under `docs/parity-issues/<slug>.md` carries:

```markdown
# <finding-slug>

**Severity:** P1 | P2 | P3
**Type:** recurring-warning | repeat-error | parity-regression | duration-drift | stuck-warning
**First seen:** <iso>
**Last seen:** <iso>
**Surface count:** N
**Affected targets:** astro | react | webapp | all

## Symptom
<auto-generated paragraph from manifest + jsonl>

## Affected Runs
- `<runId>` (parity NN.N%, excerpt)
- ...

## Suggested Triage
<heuristic suggestion keyed by finding type>

## Status
- [ ] Triaged by Cameron
- [ ] Linked to fix PR
- [ ] Resolved (which run confirmed)
```

### Idempotency

The harvest writer is keyed by finding slug. A second harvest run updates the existing ticket in place rather than creating duplicates. The slug formula is `<finding-type>-<slugified-stage>-<slugified-message>` truncated to 96 chars.

### After every real-site clone

1. Cameron runs `npx parity clone <url> --target=<t>` (multi page crawl arrives later).
2. The run prints the run id and the path to `.runs/<runId>/SUMMARY.md`.
3. Cameron and Claude open SUMMARY.md and review:
   - Parity outcome table (per viewport diff vs threshold)
   - Pipeline timing (any stage well over budget)
   - Issues encountered (auto populated from stages' issues arrays)
4. Cameron annotates the USER block with human observations.
5. When Cameron has accumulated a handful of clones, he runs `npx parity runs harvest`. Tickets land in `docs/parity-issues/`.
6. `docs/parity-issues/INDEX.md` lists open tickets sorted by severity then surface count. The next Claude session picks the top ticket and implements the fix.
7. Every fix runs `parity test` before merge.

### Where promoted fixtures live

`tests/fixtures/sites/<slug>/` per section 3. Promotion is manual in v2.0 (copy directories, write `fixture.json`), automated in v2.1 via `parity runs promote <id> --as=<slug>`.

### How Cameron throws the heavy clone away but keeps SUMMARY.md

```
# Heavy artefacts go elsewhere
mv clones/<target>/<iso-timestamp>/ ~/Archive/parity-clones/

# Or just delete them
rm -rf clones/<target>/<iso-timestamp>/

# The durable record stays
ls .runs/<run-id>/
# manifest.json, SUMMARY.md, pipeline.jsonl, stage-logs/
```

`parity runs prune` enforces the retention policy. `SUMMARY.md` and `manifest.json` survive prune. `pipeline.jsonl` and per-stage stdout logs get deleted once a run is older than 30 days, unless `parity runs archive <id>` has been called (archived runs survive forever).

---

## 8. Open questions and tabled scope

### Tabled to V2.1

1. **Webapp pixel parity beyond smoke.** V2.0 ships route-smoke plus state assertions for webapp. Pixel parity (~99% matching astro) stays in scope but lower priority. The `engine/verify/parity-check.ts` union already extends to webapp in Phase 3; the harness for SPA pixel diffs needs a route-by-route render plus capture comparison that does not exist yet.
2. **`parity runs promote <id> --as=<slug>` command.** Manual promotion in v2.0; automated promotion in v2.1.
3. **`parity runs review <id>` command** that drops Cameron into the SUMMARY USER block via `$EDITOR` immediately after each clone. Workflow polish.
4. **Per-viewport parity thresholds in `parity.config.ts`.** Audit 04 D.9 flagged this. Default to global in v2.0; per-viewport in v2.1.
5. **npm publish.** v2.0 distributes via `npm link`. v2.1 may publish to npm once the schema has cooked.
6. **Native compile.** `bun build --compile` ruled out for v2.0 per locked decision 3. Revisit if cold-start latency ever becomes a problem.
7. **Salvage from `engine/extract/playwright/*`.** Phase 2 step 5 leaves the port-vs-discard call to Cameron. The animation monitor shim is the most likely keeper.

### Needs Cameron's input later

1. **What constitutes the third react fixture if vivre.agency does not pass on the current engine.** Audit 03 Round 2 C suggests vivre as the most likely "one successful clone" candidate.
2. **The first webapp fixture's state-assertion budget.** How many toggles, how many routes, how many MSW handlers must respond? Phase 3 step 5 ships a sensible default but Cameron may want to tighten.
3. **Whether `parity rebuild` keeps the `--url=` flag.** Audit 01 Round 2 D.4 recommended removing it. Cameron's call.

---

## 9. Cross-references

| Decision or task | Source audit | Section |
|---|---|---|
| Five overlapping clone routes mapped | 01 | §2, §5, §6 |
| Winner: `scripts/run-clone.ts` becomes `parity clone` | 01 Round 2 | A.2, A.3 |
| Canonical output `clones/<target>/<iso>/{...}` | 01 Round 2 | C.1, C.4 |
| npm scripts keep-vs-delete table (48 scripts) | 01 Round 2 | E |
| `/clone-website` skill drift and rewrite plan | 01 Round 2 | B.1 to B.4 |
| Two parallel pipelines, dormant vs active | 02 | §2.2 |
| Safe-deletes with grep proof | 02 Round 2 | A.1 to A.13 |
| `engine/qa/parity-check.ts` is ACTIVE, must be lifted | 02 Round 2 | A.5 |
| `TargetAdapter` v2 proposal | 02 Round 2 | C |
| Adding a new target today (10 touchpoints) vs v2.0 (3 touchpoints) | 02 | §5, §6 |
| Astro frontmatter leak in `slice-body.ts` | 03 Round 2 | A.1 to A.5 |
| React needs `extract-css` plus `media-preserve` port | 03 Round 2 | B.1 to B.3 |
| React punch list (11 items) | 03 Round 2 | B (table) |
| Webapp gap list (10 items) | 03 | §9 |
| Unified `PostEmitPipeline` interface | 03 | §7 |
| "One successful react clone" mystery | 03 Round 2 | C |
| `parity` CLI command tree | 04 | B.2 |
| Locked decisions (citty, in-process, schema, retention) | 04 Round 2 | A.1, A.2, A.3 |
| `Stage<I, O>` interface | 04 | C.1 |
| `RunContext` plus orchestrator | 04 | C.2, C.3 |
| Worked pipeline example | 04 | C.4 |
| `.runs/` schema (manifest.json, pipeline.jsonl, SUMMARY.md) | 04 | D.1, D.2, D.3 |
| 67-row migration table | 04 Round 2 | B |
| `parity runs harvest` design | 04 | E |
| Replacement SKILL.md body | 04 | F |
| Four-phase rollout (now seven in this plan) | 04 | G |

End of action plan.
