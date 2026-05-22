# W5B.4 — Doc & Script Cleanup

Branch: prototype-mode. HEAD before: 9c663ca. v2.0.0 tagged. TS baseline 0. Parity 2/2.

## PR Template Diff Summary

`.github/PULL_REQUEST_TEMPLATE.md` checklist updated from the single broken bullet `npm run check passes (lint + typecheck + build)` to four real V2.0 commands:

- `npm run typecheck` passes (no new TS errors)
- `npx parity test` passes (Astro + React multi-viewport parity)
- `npm run check:astro-emit` passes (if touching Astro emitter)
- `npm run check:html-rewriter` passes (if touching HTML rewriter)

## Scripts Removed From package.json

Zero. Inspection found `dev`, `build`, `start`, `lint` are already absent from `package.json` `scripts` block. Previous waves dropped them. CI workflow (`.github/workflows/ci.yml`) already only runs `npx tsc --noEmit`. No further script edits required.

Other doc references audited:

- `README.md` only references real scripts (`build:astro`, `build:react`, `build:webapp`, `verify:parity`, `typecheck`, etc.).
- `AGENTS.md` only references `build:astro/react/webapp`, all real.
- `CHANGELOG.md:23` references `npm run check` but inside the historical `[0.3.0]` release block. Left intact as a historical record.
- `bugs.md`, `NEXT.md` only mention real scripts.
- `docs/V2.0/02-architecture-audit.md`, `04-cli-and-logging-design.md`, `05-action-plan.md`, `05a-reconciled-plan.md` mention the dropped scripts as the broken baseline they were designed to fix. Left intact as historical record.

## JSDoc Fixed

`engine/types/index.ts:5` JSDoc usage example changed from the stale Next.js path alias to a clean reference:

```diff
- *   import type { PageData, ComponentTree, QAReport } from '@/../../engine/types';
+ *   import type { PageData, ComponentTree, QAReport } from 'engine/types';
```

## Untracked Triage Table

Brief specified these targets explicitly. Triage outcome:

| Item | Tracked callers | Decision | Action |
|---|---|---|---|
| `SMOKE_TEST_DIFF.txt` | None. Scratch text dump of an earlier diff. | Delete | `rm` |
| `auto-probe.mjs` | None. Legacy Playwright diagnostic; W1A deleted earlier; iCloud restored. | Delete | `rm` |
| `docs/blocklists/` | Referenced in `CLAUDE.md` as canonical location for per-app crawler blocklists. | Leave untracked | (no action; real content, but per-app artefacts) |
| `docs/research/audit/` | None. Per-clone research outputs. | Leave untracked | (working scratch, like `clones/`) |
| `docs/research/crawl/` | None. Per-clone research outputs. | Leave untracked | (working scratch) |
| `engine/qa/parity-check.ts` | None. W5A.5 deleted; iCloud ghost. Contents header confirms it's the same earlier file. | Delete | `rm` |
| `engine/targets/webapp/emit-realtime/` | None. Self-consistent module, but no tracked code imports it. | Leave untracked | Flag for Cameron |
| `engine/targets/webapp/extract-body-root.ts` | None. | Leave untracked | Flag for Cameron |
| `engine/targets/webapp/form-capture/` | Only `scripts/capture-form-states.ts` (also untracked). | Leave untracked | Flag for Cameron |
| `engine/targets/webapp/scaffold/templates/mockServiceWorker.js.tpl` | None (so far). | Leave untracked | Flag for Cameron |
| `engine/targets/webapp/strip-runtime-tags.ts` | **`engine/targets/html-mirror/write-routes.ts` (tracked)**. | **Commit** | `git add` + commit |

## New Engine Modules Committed

One: `engine/targets/webapp/strip-runtime-tags.ts` (169 lines). It is imported by `engine/targets/html-mirror/write-routes.ts:13`, which is tracked. Without restoration the html-mirror target would fail to typecheck on a fresh clone of the repo.

## iCloud Ghosts Deleted

Three:

1. `auto-probe.mjs` — legacy Playwright diagnostic.
2. `engine/qa/parity-check.ts` — old QA harness retired by W5A.5.
3. `SMOKE_TEST_DIFF.txt` — scratch diff dump.

## Commits

- `1cbbb0e` docs: update PR template for V2.0 commands
- `2ba8426` fix(types): drop stale @/.. JSDoc reference
- `3bb0d39` feat(engine): restore strip-runtime-tags imported by html-mirror
- (this file) docs: w5b4 observation log for doc & script cleanup

## Quality Gates

- `npx tsc --noEmit` post-commit: 0 errors in W5B.4 territory.
- `npx parity test`: 2 passed, 0 failed, 0 skipped.
- `npm run check:astro-emit`: OK 787 bytes emitted.

## Anomalies / Surprises

1. **Parallel agent territory has unstaged modifications**. While running typecheck I found 7 TS errors in `bin/parity.ts` and `engine/cli/regression/run-test.ts`. Both are in the explicit no-touch zone per my brief constraints. The errors come from another agent's in-flight edits to citty `CommandDef` shapes and `ParityCloneInput`. Flagged here but not touched. The W5B.4 typecheck pass excludes these files.

2. **Many untracked scripts beyond the brief**. `git status` shows 16+ untracked `scripts/*.ts` (audit-capture, auth-verify, build-html-mirror, capture-form-states, inspect-live, inspect-selector-resolution, login-omni, recapture-routes, seo-backfill, verify-clone, verify-interactions, verify-key-clicks{,-v2}, verify-posts-menu, verify-tabs-and-toasts, verify-toast), plus `features.md`, `full-diag.mjs`, `test-login.mjs`. None of them are imported by tracked code (only a console.error string in `engine/targets/webapp/crawler/crawler.ts` mentions `scripts/login-omni.ts` as a hint to the user). All left untracked per brief's conservative-deletion rule. Cameron can sort them later.

3. **No `npm run` script removal commit needed**. The four scripts named in the brief (`dev`, `build`, `start`, `lint`) were already absent from `package.json`. Prior waves had removed them. The brief's commit `chore(scripts): drop dev/build/start/lint npm scripts` therefore did not happen because there was nothing to drop.
