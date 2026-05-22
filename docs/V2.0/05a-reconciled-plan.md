# Dr Parity V2.0 — Reconciled Wave 1 Plan

> Reconciles `docs/V2.0/05-action-plan.md` against the actual post-pull disk state.
> HEAD: `d33b4bd`. Origin already shipped 3 commits (cleanup, .bak files, full webapp target) that the original audits did not see.
> Read-only audit performed 2026-05-22.

---

## 0. Headline reconciliation

| Original assumption | Disk reality at HEAD `d33b4bd` |
|---|---|
| `engine/qa/parity-check.ts` exists and is called from `scripts/clone-urls.ts:465` | **DOES NOT EXIST.** `engine/qa/` has 8 files (asset-waiter, hover-tester, dom-comparator, content-masker, screenshotter, pixel-diff, fix-loop, section-comparator) plus `.gitkeep`. No `parity-check.ts`. `clone-urls.ts` does not import a parity check at all. |
| Need to lift parity-check into `engine/verify/` | `engine/verify/` already exists with 6 files: `types.ts`, `ports.ts`, `screenshots.ts`, `diff.ts`, `report.ts`, `render.ts`. The lift is effectively done (or was never needed); the audit was looking at iCloud-ghost untracked state. |
| Phase 1 deletes `next.config.ts`, `postcss.config.mjs`, `components.json`, plus 10 AI assistant config dirs | All already gone (commit `3b4efd2`). |
| `crawlDir` smuggled in as structural cast on `engine/targets/webapp/index.ts:117` | The cast is still there at line 97. `TargetBuildOptions` in `engine/targets/types.ts` does NOT yet declare `crawlDir`. Still needs doing. |
| `slice-body.ts` emits Astro frontmatter at L193 to L204 | Lines 193 to 207 in current HEAD show node-slicing logic (header / main / footer / postamble), not the frontmatter string composition. The audit's line refs are stale. The frontmatter leak DOES still exist somewhere in this file but the line numbers must be re-pinned before refactor. |
| Phase 4 introduces `bin/` | `bin/` does not exist. Confirmed. |
| Phase 5 introduces `.runs/` | `.runs/` does not exist. Confirmed. |
| Phase 3 promotes fixtures into `tests/fixtures/sites/` | Directory does not exist. Confirmed. |
| Phase 6 harvests into `docs/parity-issues/` | Directory does not exist. Confirmed. |
| 8 `.bak` files are clutter | All 8 confirmed present (commit `fd73b21`). |
| `engine/orchestrator/post-build/post-emit-multi.ts` exists | Present. `emit-only.ts` also present. **NO** `post-emit-multi-react.ts` or `post-emit-multi-webapp.ts` on disk. Audit 03 referenced files that have never existed. |
| `engine/targets/react/extract-css` and `media-preserve` | Do NOT exist as react-target modules. `engine/scope-styles/media-preserve.ts` does exist as target-agnostic logic (imported at `engine/orchestrator/phases.ts:23`). |
| `engine/targets/astro/extract-css` | Does NOT exist as a discrete module. |
| `parityCheck` is a boolean phase flag, not a function | Confirmed. `engine/orchestrator/phases.ts:200,221` sets `parityCheck: true`. `scripts/rebuild-pro.ts:455` reads it. No standalone parity-check module is imported anywhere in `engine/` or `scripts/`. |

---

## 1. Phase 1 reconciliation (Cleanup of safe deletes)

### 1.A Already done by origin (8 of original 13 items)

| Item | State |
|---|---|
| `next.config.ts` | gone |
| `postcss.config.mjs` | gone |
| `components.json` | gone |
| `.aider`, `.amazonq`, `.augment`, `.cline`, `.codex`, `.continue`, `.cursor`, `.gemini`, `.opencode`, `.windsurf` | all gone |
| `engine/qa/parity-check.ts` | never existed at HEAD (was iCloud ghost) |
| `engine/extract/chrome-mcp/` | not enumerated; needs separate check |

### 1.B Still on disk (verified present)

| Path | Action | Notes |
|---|---|---|
| `Dockerfile` | delete | confirmed present |
| `Dockerfile.dev` | delete | confirmed present |
| `docker-compose.yml` | delete | confirmed present |
| `.dockerignore` | delete | confirmed present |
| `eslint.config.mjs` | delete | confirmed present, no `lint` npm script consumes it |
| `scripts/extract-multi.ts` | delete | present |
| `scripts/download-assets.mjs` | delete | present |
| `docs/docs/research/prompts/` | delete entire dir | 27 stale section prompt files |
| `scripts/extract.ts` | delete after salvage | present, animation monitor salvage call still pending Cameron review |
| `scripts/qa.ts` | delete | present |
| `scripts/qa-sections.ts` | delete | present |
| `scripts/clone-page.ts` | delete | present |
| `auto-probe.mjs`, `full-diag.mjs`, `test-login.mjs` | check root | not found at repo root; assume already gone |
| `src/` | check | not found; assume already gone |
| `public/` | check | not found; assume already gone |
| 8 `.bak` files in `engine/` | delete | full list below |

The 8 `.bak` files (commit `fd73b21`, pure clutter):

```
engine/analyze/css/classes.ts.bak
engine/refactor/walk.ts.bak
engine/scope-styles/index-components.ts.bak
engine/targets/astro/build.ts.bak
engine/targets/astro/is-inline.ts.bak
engine/targets/react/build-multi.ts.bak
engine/targets/react/build.ts.bak
engine/targets/react/html-to-jsx.ts.bak
```

### 1.C `verify-*.ts` re-evaluation (now larger after origin's d33b4bd)

| Script | Verdict | Reason |
|---|---|---|
| `scripts/verify-parity.ts` | KEEP | Real parity verifier, referenced from skill blockade list |
| `scripts/verify-clone.ts` | EVALUATE | Origin added it; check if functional testing infrastructure or one-off probe |
| `scripts/verify-interactions.ts` | EVALUATE | Origin added; likely webapp testing infrastructure |
| `scripts/verify-key-clicks.ts` | DELETE | one-off probe; superseded by `verify-key-clicks-v2.ts` |
| `scripts/verify-key-clicks-v2.ts` | EVALUATE | If part of webapp regression harness, keep; otherwise delete |
| `scripts/verify-posts-menu.ts` | DELETE | hard-coded omnisocials probe per audit pattern |
| `scripts/verify-tabs-and-toasts.ts` | DELETE | hard-coded omnisocials probe |
| `scripts/verify-toast.ts` | DELETE | hard-coded omnisocials probe |
| `scripts/auth-verify.ts` | DELETE | hard-coded omnisocials probe |
| `scripts/inspect-live.ts` | DELETE | one-off |
| `scripts/inspect-selector-resolution.ts` | DELETE | one-off |
| `scripts/login-omni.ts` | DELETE | hard-coded omnisocials login probe |
| `scripts/crawl-webapp.ts` | KEEP | Webapp target crawler driver; first-class entry point |

Acceptance gate for the "EVALUATE" rows: grep for inbound importers under `engine/` and `bin/`. If zero callers and script reads its target URL from CLI flags rather than hard-coded constants, it is real infrastructure. Otherwise delete.

### 1.D Doc drift cleanup PR

Files that reference removed or never-existed paths. Edits below are the minimum to stop the lies.

| File | Issue | Edit |
|---|---|---|
| `/Users/cameronmcallister/Github/dr-parity/AGENTS.md` | Project structure tree at top mentions `src/app/`, `src/components/ui/`, `public/images/`, `public/videos/`, `public/seo/` | Replace `## Project Structure` block with the real tree (no `src/`, no `public/`, no Next.js mention). Remove "Next.js 16 (App Router, React 19, TypeScript strict)" from tech stack. Replace with "TypeScript strict, Playwright CLI extraction, Astro and React target emitters, Vite webapp target." |
| `/Users/cameronmcallister/Github/dr-parity/AGENTS.md` | Commands block lists `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run check` | Delete every command that does not exist in `package.json` scripts. Replace with the real list. |
| `/Users/cameronmcallister/Github/dr-parity/AGENTS.md` | Top banner "This is NOT the Next.js you know" | Delete entirely; the repo is not Next.js. |
| `/Users/cameronmcallister/Github/dr-parity/CLAUDE.md` | `@AGENTS.md` import inherits the lies above | Resolved automatically once AGENTS.md is fixed. |
| `/Users/cameronmcallister/Github/dr-parity/README.md` | Likely repeats the Next.js framing | Rewrite from scratch around the CLI engine. No Next.js. |
| `/Users/cameronmcallister/Github/dr-parity/bugs.md` | May reference deleted scripts | Audit for stale references after Phase 1.B lands. |
| `/Users/cameronmcallister/Github/dr-parity/.github/workflows/ci.yml` | Originally specified `npm run lint` plus `npm run build` per audit 02 | Replace with `npx tsc --noEmit` and (once Phase 3 lands) `npx parity test`. |
| `/Users/cameronmcallister/Github/dr-parity/.claude/skills/clone-website/SKILL.md` | References to `scripts/extract.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`, `scripts/clone-page.ts`, Chrome MCP, `engine/qa/parity-check.ts` | Defer full rewrite to Phase 6; for now just strip the dead-script and `engine/qa/parity-check` mentions. |
| `/Users/cameronmcallister/Github/dr-parity/docs/research/INSPECTION_GUIDE.md` | References Chrome MCP under Phase 1 | Replace "Chrome MCP or browser DevTools" with "Playwright CLI capture or browser DevTools." |

After AGENTS.md edits, run `bash scripts/sync-agent-rules.sh`. After SKILL.md edits, run `node scripts/sync-skills.mjs`.

---

## 2. Phase 2 reconciliation (Lift active code)

**Almost entirely done by reality, not by us.** The audit was reading iCloud ghosts.

| Original task | Reconciled state |
|---|---|
| Move `engine/qa/parity-check.ts` to `engine/verify/parity-check.ts` | No such file at HEAD. `engine/verify/` already contains the verify pipeline (`types`, `ports`, `screenshots`, `diff`, `render`, `report`). Skip. |
| Update import at `scripts/clone-urls.ts:465` | No such import in current `clone-urls.ts`. Skip. |
| Delete `engine/qa/*` minus parity-check | Still 8 files in `engine/qa/` (asset-waiter, hover-tester, dom-comparator, content-masker, screenshotter, pixel-diff, fix-loop, section-comparator). Cross-check inbound imports before deletion. The phase-runner flag `parityCheck: true` in `engine/orchestrator/phases.ts:200,221` is a boolean phase metadata flag, not an importer of the qa folder, so those phase entries do not block deletion. |
| Delete `scripts/qa.ts`, `scripts/qa-sections.ts` | Both present. Delete after confirming nothing in `engine/` or `bin/` imports them. |
| Delete `scripts/extract.ts` | Present. Phase 2 step 5 salvage call stands. |
| Delete `engine/extract/playwright/*` | Needs separate audit; not enumerated this pass. |

**Net Phase 2 work remaining:** Just the engine/qa folder deletion (after import audit), the legacy script deletions (qa.ts, qa-sections.ts, extract.ts), and the extract/playwright cleanup. The headline "lift parity-check" task is moot.

---

## 3. Phase 3 reconciliation (Target reliability)

### 3.A `slice-body.ts` frontmatter leak

Audit said lines 193 to 204 emit `---` frontmatter. **Confirmed stale.** Lines 193 to 207 in current HEAD are node-slicing logic (interstitial / postMain / postamble). The frontmatter leak DOES still exist in the file (per audit 03 A.3) but its line range has shifted. Re-pin before edit: grep the file for `---` and `frontmatter` and rebuild the line refs.

### 3.B `crawlDir` smuggle

| Concern | State |
|---|---|
| `engine/targets/webapp/index.ts:117` structural cast | Real location: line 97. Cast still present: `(options as { crawlDir?: string }).crawlDir`. Refactor scope confirmed. |
| `TargetBuildOptions` lacks `crawlDir` | Confirmed. Current shape: `cloneDir`, `outDir`, `name?`, `force?`, `primitives?: unknown`. Adding `crawlDir?: string` is a one-line change in `engine/targets/types.ts`. |

### 3.C React post-emit modules

| Audit claim | Reality |
|---|---|
| `engine/orchestrator/post-build/post-emit-multi-react.ts` exists | **DOES NOT EXIST.** Only `post-emit-multi.ts` and `emit-only.ts` in that directory. |
| `engine/orchestrator/post-build/post-emit-multi-webapp.ts` exists | **DOES NOT EXIST.** |
| `engine/targets/react/{extract-css,media-preserve}` | Do not exist as react-target modules. `engine/scope-styles/media-preserve.ts` is the only media-preserve module (target-agnostic, imported from `engine/orchestrator/phases.ts:23`). |
| `engine/targets/astro/extract-css` | Not a module. |

**Implication:** The audit's line-by-line edits in `post-emit-multi-react.ts` (e.g. "lines 692 to 712", "lines 103 to 160") cannot be applied directly. The actual work is NEW FILE creation, not editing existing files. Re-scope Phase 3 step 2 from "insert phases" to "create `post-emit-multi-react.ts` from scratch, copying the proven shape of `post-emit-multi.ts` and weaving in media-preserve."

### 3.D `scripts/clone-urls.ts:48`

Confirmed: `type TargetName = 'astro' | 'react';`. Webapp not included in this CLI's target enum. Real Phase 3 step (extend to `'astro' | 'react' | 'webapp'`).

### 3.E `scripts/clone-urls.ts:46`

Imports `runPostEmitMulti` from `engine/orchestrator/post-build/post-emit-multi`. This is the single existing post-emit. There is no per-target post-emit pipeline today.

---

## 4. Phase 4 to 6 sanity checks

| Path | Exists? |
|---|---|
| `bin/` | NO |
| `.runs/` | NO |
| `tests/fixtures/sites/` | NO |
| `docs/parity-issues/` | NO |

All four are still future work. No reconciliation needed beyond confirming they remain greenfield.

---

## 5. Reconciled Wave 1 ordered task list

### Phase 1.A — Safe to delete now (no consumers, no salvage)

| # | Path | Acceptance |
|---|---|---|
| 1 | `/Users/cameronmcallister/Github/dr-parity/Dockerfile` | gone, `git status` clean |
| 2 | `/Users/cameronmcallister/Github/dr-parity/Dockerfile.dev` | gone |
| 3 | `/Users/cameronmcallister/Github/dr-parity/docker-compose.yml` | gone |
| 4 | `/Users/cameronmcallister/Github/dr-parity/.dockerignore` | gone |
| 5 | `/Users/cameronmcallister/Github/dr-parity/eslint.config.mjs` | gone, no `lint` script in package.json depends on it |
| 6 | `/Users/cameronmcallister/Github/dr-parity/scripts/extract-multi.ts` | gone, `grep -r "extract-multi" engine scripts` returns nothing |
| 7 | `/Users/cameronmcallister/Github/dr-parity/scripts/download-assets.mjs` | gone |
| 8 | `/Users/cameronmcallister/Github/dr-parity/docs/docs/research/prompts/` | dir gone (27 files) |
| 9 | 8 `.bak` files listed in section 1.B | all gone, `find engine -name '*.bak'` returns nothing |
| 10 | `/Users/cameronmcallister/Github/dr-parity/scripts/verify-key-clicks.ts` | gone |
| 11 | `/Users/cameronmcallister/Github/dr-parity/scripts/verify-posts-menu.ts` | gone |
| 12 | `/Users/cameronmcallister/Github/dr-parity/scripts/verify-tabs-and-toasts.ts` | gone |
| 13 | `/Users/cameronmcallister/Github/dr-parity/scripts/verify-toast.ts` | gone |
| 14 | `/Users/cameronmcallister/Github/dr-parity/scripts/auth-verify.ts` | gone |
| 15 | `/Users/cameronmcallister/Github/dr-parity/scripts/inspect-live.ts` | gone |
| 16 | `/Users/cameronmcallister/Github/dr-parity/scripts/inspect-selector-resolution.ts` | gone |
| 17 | `/Users/cameronmcallister/Github/dr-parity/scripts/login-omni.ts` | gone |

### Phase 1.A.bis — Conditional deletes (require import audit first)

| # | Path | Pre-check |
|---|---|---|
| 18 | `engine/qa/{asset-waiter,hover-tester,dom-comparator,content-masker,screenshotter,pixel-diff,fix-loop,section-comparator}.ts` | `grep -r "engine/qa/" engine scripts bin` returns zero, then delete. The boolean `parityCheck:true` flag in phases.ts is metadata, not an import. |
| 19 | `scripts/qa.ts`, `scripts/qa-sections.ts`, `scripts/clone-page.ts` | confirm no inbound importers; delete |
| 20 | `scripts/extract.ts` plus `engine/extract/playwright/*` | salvage animation monitor first (Cameron call), then delete |
| 21 | `scripts/verify-clone.ts`, `scripts/verify-interactions.ts`, `scripts/verify-key-clicks-v2.ts` | inspect heads; if reads target from CLI flags AND consumed by `engine/` test harness, keep; otherwise delete |

### Phase 1.B — Doc drift PR

See section 1.D table. Single PR with edits across:

- `/Users/cameronmcallister/Github/dr-parity/AGENTS.md`
- `/Users/cameronmcallister/Github/dr-parity/README.md` (full rewrite)
- `/Users/cameronmcallister/Github/dr-parity/bugs.md` (sweep for stale refs)
- `/Users/cameronmcallister/Github/dr-parity/.github/workflows/ci.yml`
- `/Users/cameronmcallister/Github/dr-parity/.claude/skills/clone-website/SKILL.md` (partial; full rewrite at Phase 6)
- `/Users/cameronmcallister/Github/dr-parity/docs/research/INSPECTION_GUIDE.md`

Acceptance: `grep -ri "next.js\|next.config\|chrome mcp\|engine/qa/parity-check" AGENTS.md README.md bugs.md .claude/skills/clone-website/SKILL.md docs/research/INSPECTION_GUIDE.md .github/workflows/ci.yml` returns zero matches.

### Phase 2 — Adjusted lift (minimal)

The headline "lift parity-check" is moot. Remaining lift work:

| # | Task | Acceptance |
|---|---|---|
| 1 | Verify nothing imports `engine/qa/*` (the 8 leftover files) | `grep -r "engine/qa/" engine scripts bin` returns nothing once Phase 1.A.bis row 18 lands |
| 2 | Confirm `engine/verify/` is the canonical verify pipeline by tracing one full call path from `scripts/build.ts` or `scripts/run-clone.ts` to a verify entry | `grep -rn "engine/verify" scripts engine` shows a real call site |
| 3 | Update `engine/orchestrator/phases.ts:200,221` boolean `parityCheck:true` flags so they reflect the active verify pipeline, not the deleted qa folder | comment or rename to `parityGate:true` for clarity |

### Phase 3a — Slice-body refactor (re-pinned)

| # | Task | Acceptance |
|---|---|---|
| 1 | Open `engine/targets/shared/slice-body.ts`, grep for `---` and `frontmatter`, re-pin actual line range of the frontmatter emit | new line range documented in PR description |
| 2 | Extend `engine/targets/shared/types.ts` `ComponentDef` with `wrapper: { openTag: string; closeTag: string } | null` and `childComponentNames?: string[]` | tsc passes |
| 3 | Refactor `slice-body.ts` to return structured wrapper plus children | astro and react emit paths consume structured shape |
| 4 | Update `engine/targets/astro/{emit,emit-multi}.ts` and `engine/targets/react/{emit,emit-multi}.ts` to consume the structured shape; delete `parseAstroFrontmatter`, `preservePascalTags`, `restorePascalTags` from react emitters | re-pin line refs first; old audit numbers are stale |
| 5 | Update `engine/targets/webapp/build.ts` and `webapp/emit.ts` to consume the same shape | tsc passes |
| 6 | Snapshot test of representative captured HTML before refactor, run after | snapshots stable |

### Phase 3b — `crawlDir` typing fix

| # | Task | Acceptance |
|---|---|---|
| 1 | Add `crawlDir?: string` to `TargetBuildOptions` in `engine/targets/types.ts` | tsc passes |
| 2 | Drop structural cast at `engine/targets/webapp/index.ts:97` | `grep -n "as { crawlDir" engine/targets/webapp/index.ts` returns nothing |
| 3 | Extend `type TargetName = 'astro' | 'react'` at `scripts/clone-urls.ts:48` to include `'webapp'` (or document the deliberate exclusion) | acceptance per Cameron |

### Phase 3c — React post-emit (new file, not edit)

| # | Task | Acceptance |
|---|---|---|
| 1 | Create `engine/orchestrator/post-build/post-emit-multi-react.ts` patterned on existing `post-emit-multi.ts` | exports a `runPostEmitMultiReact` callable |
| 2 | Wire `engine/scope-styles/media-preserve.ts` into the new react post-emit | tsc passes |
| 3 | Add `import './styles/responsive.css'` to react `writeMain` | clone produces the file and the import resolves |

### Phase 4 — CLI scaffolding (additive, no change)

Unchanged from original plan. `bin/`, `.runs/`, `tests/fixtures/sites/`, `docs/parity-issues/` all confirmed greenfield.

---

## 6. Open questions for Cameron

1. Are the four "EVALUATE" verify scripts (`verify-clone.ts`, `verify-interactions.ts`, `verify-key-clicks-v2.ts`, plus `crawl-webapp.ts`) part of the new webapp regression harness or one-off probes? Their classification gates Phase 1.A.bis row 21.
2. The animation monitor salvage from `engine/extract/playwright/` (Phase 2 step 5 in the original plan). Port or discard?
3. Phase 3c creates new files rather than editing existing ones (per the audit's stale line refs). Same outcome, different mechanic. Confirm direction.

End of reconciled plan.
