# W1A — Cleanup Observations

Phase 1.A of Dr Parity V2.0. HEAD before work: `d33b4bd`. Branch: `prototype-mode`.

## Files Surveyed

| File / Path | Existed? | Inbound refs (live code) | Action | Reasoning |
|---|---|---|---|---|
| `Dockerfile` | yes | 1 (self-ref from `docker-compose.yml`) | deleted | Targets dead Next.js layer; no live script invokes it |
| `Dockerfile.dev` | yes | 1 (self-ref from `docker-compose.yml`) | deleted | Runs `npm run dev` which does not exist; dead |
| `docker-compose.yml` | yes | 0 | deleted | References the two Dockerfiles above; cascades cleanly |
| `.dockerignore` | yes | 0 | deleted | Paired with Docker layer; standalone has no purpose |
| `engine/analyze/css/classes.ts.bak` | yes | 0 | deleted | `.bak` clutter (commit `fd73b21`) |
| `engine/refactor/walk.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/scope-styles/index-components.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/targets/astro/build.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/targets/astro/is-inline.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/targets/react/build-multi.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/targets/react/build.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `engine/targets/react/html-to-jsx.ts.bak` | yes | 0 | deleted | `.bak` clutter |
| `scripts/extract-multi.ts` | yes | 0 live code (only docs) | deleted | No imports anywhere in engine/ or scripts/ |
| `scripts/download-assets.mjs` | yes | 0 live code | deleted | Old Next.js-era one-shot |
| `scripts/qa.ts` | yes | 0 live code (only SKILL.md doc ref) | deleted | No imports; doc cleanup deferred to Phase 1.B (per plan) |
| `scripts/qa-sections.ts` | yes | 0 live code (only SKILL.md, ROADMAP.md doc refs) | deleted | No imports; doc cleanup deferred |
| `docs/docs/research/prompts/` | yes (27 files) | 0 | deleted | Nested `docs/docs/` path bug; zero refs in code |
| `src/` (Next.js scaffold: layout.tsx, page.tsx, button.tsx, etc.) | yes | 1 (JSDoc comment in `engine/types/index.ts:5`, not a real import) | deleted | Pure Next.js boilerplate origin missed; not consumed by engine |
| `public/` (root) | yes (only `.gitkeep` files) | 0 (engine `public/...` strings emit INTO clone outputs, not root) | deleted | Pure Next.js scaffold; engine writes to clone-local `public/` only |
| `scripts/clone-page.ts` | yes | **1 LIVE** (`package.json:60`) | LEFT IN PLACE | Still wired as `npm run clone-page`; deletion blocked until script entry removed (Phase 1.B doc/config drift PR) |
| `scripts/extract.ts` | yes | 0 (only docs + SKILL.md) | LEFT IN PLACE | Reconciled plan flagged it "delete after salvage"; animation monitor port from `engine/extract/playwright/` is a Cameron decision (open question #2 in 05a) |
| `eslint.config.mjs` | yes | **1 LIVE** (`package.json:33 "lint": "eslint"`) | LEFT IN PLACE | The `lint` script still resolves to this config; deletion needs paired removal of the `lint` script (Phase 1.B) |

## Deletions Committed

| Commit | Message | Files removed |
|---|---|---|
| `89523d2` | `chore: remove dead Docker layer` | `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `.dockerignore` |
| `cccf16f` | `chore: remove .bak clutter under engine/` | 8 `.bak` files listed above |
| `3fa2015` | `chore: prune Next.js scaffold and dead legacy scripts` | `src/` (8 files), `public/` (4 `.gitkeep`s), `docs/docs/research/prompts/` (27 files), `scripts/extract-multi.ts`, `scripts/download-assets.mjs`, `scripts/qa.ts`, `scripts/qa-sections.ts` |

Total: **23 files committed across 3 atomic commits** (plus 27 doc prompt files in the third commit, so ~50 path deletions in total).

## Probe Script Classifications

| Script | Hardcoded site / abs path? | Verdict | Candidate for deletion? |
|---|---|---|---|
| `scripts/auth-verify.ts` | YES — `https://app.omnisocials.com` default | one-off omnisocials probe | YES (pending Cameron sign-off) |
| `scripts/login-omni.ts` | YES — `https://app.omnisocials.com` default | one-off omnisocials login probe | YES |
| `scripts/inspect-live.ts` | YES — hardcoded `http://localhost:5173/` | one-off Vite-dev-server probe | YES |
| `scripts/inspect-selector-resolution.ts` | YES — hardcoded `http://localhost:5173/` | one-off Vite-dev-server probe | YES |
| `scripts/verify-clone.ts` | YES — abs path `/Users/cameronmcallister/Github/omnichannel-clone/...` + `http://localhost:5173` | one-off omnichannel-clone probe | YES |
| `scripts/verify-interactions.ts` | YES — same abs path + `http://localhost:5173/posts.html` | one-off omnichannel-clone probe | YES |
| `scripts/verify-key-clicks.ts` | YES — same abs path | one-off omnichannel-clone probe | YES |
| `scripts/verify-key-clicks-v2.ts` | YES — same abs path | one-off (v2 supersedes v1) | YES |
| `scripts/verify-posts-menu.ts` | YES — same abs path + `posts.html` | one-off omnichannel-clone probe | YES |
| `scripts/verify-tabs-and-toasts.ts` | YES — same abs path + `approval.html` | one-off omnichannel-clone probe | YES |
| `scripts/verify-toast.ts` | YES — same abs path | one-off omnichannel-clone probe | YES |
| `scripts/crawl-webapp.ts` | NO — reads `startUrl` from argv, imports `engine/targets/webapp/crawler` | **generic infrastructure** | NO (registered as `npm run crawl:webapp`; first-class entry point) |

**Summary:** 11 scripts are one-off probes pinned to `omnisocials` or the now-external `/Users/cameronmcallister/Github/omnichannel-clone/` project. They write screenshots into a directory outside this repo, so they cannot function in-repo anyway. `crawl-webapp.ts` is the only generic one and stays.

All 11 candidates left on disk pending Cameron's go-ahead.

## Parity / Pipeline Improvement Opportunities Spotted

1. **Probe scripts pollute the `scripts/` directory.** 11 of ~70 scripts here are tied to an external clone project that does not exist in this repo. Recommend moving them into a `scripts/_omnichannel-probes/` subdirectory if Cameron wants to keep history but get them out of the main listing; otherwise delete all 11. Right now they make `ls scripts/` noisy and confuse new contributors.
   - **Why it matters for Dr Parity:** a clean `scripts/` listing is the single best signal of which entry points the engine actually supports. Every dead entry point dilutes that signal and increases the odds that future agents (and Cameron) run the wrong one.

2. **`package.json` still lists Next.js as a runtime dependency.** Lines 84-89 declare `next`, `react`, `react-dom`, `tailwind-merge`, `tw-animate-css`, `shadcn`, `lucide-react`, `geist`, `@base-ui/react`, `class-variance-authority`. None of these are required by `engine/` or by any active `scripts/` entry. They survive because the `dev`, `build`, `start`, `lint` scripts (lines 30-33) reference Next CLI tooling. Removing those scripts unblocks dropping ~10 dependencies from the install graph.
   - **Why:** a smaller install graph means faster `npm install` in CI, fewer false-positive security alerts, and smaller Docker images later when this engine does need a container surface.

3. **`docs/V2.0/05a-reconciled-plan.md` line 60-61 says "`src/` not found; assume already gone" and same for `public/`.** That was wrong at HEAD `d33b4bd` — both directories were still present with real Next.js source (`layout.tsx`, `page.tsx`, `button.tsx`, `globals.css`, `favicon.ico`). The reconciled plan needs a one-line correction so the next agent does not skip them again.
   - **Why:** the V2.0 plan is the single source of truth for this cleanup wave; uncorrected, it will mis-direct W1B.

4. **`engine/types/index.ts:5` JSDoc example uses `@/../../engine/types`** — a stale Next.js path-alias example. Should be updated to `engine/types` (relative from repo root) now that no `@/` alias exists.
   - **Why:** misleads agents into thinking the project supports tsconfig path aliases when it does not.

5. **`scripts/clone-page.ts` is an active `npm run` target (`clone-page`) but the reconciled plan flags it for deletion.** Either: (a) keep it and remove the deletion flag from the plan, or (b) delete the script and the package.json entry together in a single coordinated commit (Phase 1.B doc/config drift PR). Right now plan and reality disagree.
   - **Why:** disagreement between plan and package.json invites future regressions.

6. **Animation monitor salvage from `engine/extract/playwright/` is gated on Cameron's call (open question #2).** That call has been pending since at least audit 02 and is now blocking the deletion of `engine/extract/playwright/` (and `scripts/extract.ts`). Even a one-line "discard, the new `engine/extract/capture/` chain covers it" or "port to `capture/animation-monitor.ts` first" answer would unblock ~12 more file deletions.
   - **Why:** that folder is one of the largest legacy cruft surfaces left; pinning the decision unlocks meaningful repo simplification.

## Surprises / Anomalies

1. **`src/` and `public/` were NOT already gone.** The reconciled plan section 1.B treated them as "not found; assume already gone" but they were present at HEAD with full Next.js scaffolding (favicon, layout, page, button, globals.css, plus `.gitkeep` placeholders under `hooks/`, `lib/`, `types/`, `components/`, `images/`, `videos/`, `seo/`, `fonts/`). Origin's earlier cleanup commit (`3b4efd2`) missed them. Deleted in this phase under the "Group E" mandate, but the plan text needs the correction noted above.

2. **No git weirdness, no half-staged renames, no ghost files.** The working tree was clean before I started (only untracked: `clones/` and `docs/V2.0/05a-reconciled-plan.md`). Git operations went through normally.

3. **`scripts/clone-page.ts` is a live package.json target** but the reconciled plan treats it as deletable. Resolved by leaving it in place per the "if unsure, leave it" rule. Cameron's call.

4. **`eslint.config.mjs` is referenced by `package.json:33`**, same situation — left in place. The plan section 1.B says "no `lint` npm script consumes it" which is incorrect (line 33 says `"lint": "eslint"`). Another plan-vs-reality drift.

5. **`tsc --noEmit` shows 15 pre-existing engine errors** both before and after my deletions. Verified by checking out HEAD `d33b4bd` and re-running tsc: same 15 errors. My deletions surfaced no new compilation problems. The errors are in `engine/analyze/css/classes.ts`, `engine/analyze/css/parser.ts`, `engine/scope-styles/index-components.ts`, `engine/targets/astro/is-inline.ts`, `engine/targets/react/html-to-jsx.ts`, `engine/targets/webapp/inference/classify-toggle.ts` (cheerio namespace, implicit any, postcss type incompatibility). These are real issues but outside W1A scope; flagging them as another improvement opportunity (#7).

6. **Parallel agents are also working.** During this phase, `AGENTS.md` and `README.md` were modified, and `engine/cli/orchestrate.ts`, `engine/cli/stage.ts`, `scripts/_w1c-capture-baseline.ts`, `docs/research/INSPECTION_GUIDE.md`, `scripts/smoke-parity-cli.ts` appeared as new untracked / unstaged changes. I did NOT touch them. My commits include only my own staged deletions. Likely W1B (doc drift) and W1C (CLI scaffolding) running in parallel as the orchestrator intended.

## Additional improvement opportunity (#7)

**`engine/` has 15 unsolved tsc errors at HEAD.** They predate W1A. Owners are stable files in the active build path (CSS classifier, scope-styles, astro/react emitters, webapp toggle inference). Fixing these would un-block `tsc --noEmit` as a CI gate, which is exactly what the V2.0 plan section 1.D wants for `.github/workflows/ci.yml`. Without it, the CI gate cannot pass on a clean repo.
- **Why:** the planned "replace lint+build with `tsc --noEmit`" CI replacement in Phase 1.D is currently blocked. Surfacing this now means W1B (CI rewrite) and the eventual tsc-fix agent can coordinate rather than discover the breakage at deployment time.
